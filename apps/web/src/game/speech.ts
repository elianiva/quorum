import { ASR_PATH, ASR_SAMPLE_RATE } from '@quorum/rpc'
import { watchMic } from './mic-meter.ts'

/* ==========================================================================
   The microphone, while dictation is on. The page owns the capture: it reads
   the microphone in an AudioWorklet, keeps one channel, and sends 16 kHz PCM
   to the dev server, which forwards it to Nova-3. Words come back as they are
   recognised; a line the model ends is one utterance.
   ========================================================================== */

export type SpeechSink = Readonly<{
  /** The line as it stands, including words the model has not finalised. */
  heard: (text: string) => void
  /** A line the model finished: the player stopped, or paused. */
  uttered: (text: string) => void
  /** The microphone or the socket could not start. */
  failed: (reason: string) => void
}>

/** An AudioWorklet that posts the raw microphone frames, once per render quantum. */
const CAPTURE = `
class Capture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (channel) this.port.postMessage(channel.slice(0))
    return true
  }
}
registerProcessor('capture', Capture)
`

/** One frame of floats, averaged down to 16 kHz and written as little-endian 16-bit PCM. */
const pcm = (frame: Float32Array, rate: number): ArrayBuffer => {
  const step = Math.max(1, Math.round(rate / ASR_SAMPLE_RATE))
  const samples = Math.floor(frame.length / step)
  const buffer = new ArrayBuffer(samples * 2)
  const view = new DataView(buffer)
  for (let at = 0; at < samples; at += 1) {
    let sum = 0
    for (let inside = 0; inside < step; inside += 1) sum += frame[at * step + inside] ?? 0
    const value = Math.max(-1, Math.min(1, sum / step))
    view.setInt16(at * 2, Math.round(value * 0x7fff), true)
  }
  return buffer
}

/** What the gateway sends: Deepgram's results, one JSON message at a time. */
type Result = Readonly<{
  type?: string
  is_final?: boolean
  speech_final?: boolean
  channel?: Readonly<{ alternatives?: ReadonlyArray<Readonly<{ transcript?: string }>> }>
}>

/** How long a line stays unchanged before the player is read as finished. */
export const QUIET_MS = 900

/** The line being recognised: what is settled, and the words after it that still change. */
export type Line = Readonly<{ settled: string; current: string; changedAt: number }>

export const EMPTY_LINE: Line = { settled: '', current: '', changedAt: 0 }

/**
 * One result from the model. A transcript that no longer starts with what was
 * settled is a new line, and only the words after the settled part are the
 * player's current ones.
 */
export const heardIn = (
  line: Line,
  text: string,
  now: number,
): Readonly<{ line: Line; heard: string | null }> => {
  const settled = line.settled !== '' && !text.startsWith(line.settled) ? '' : line.settled
  const tail = settled === '' ? text : text.slice(settled.length).trim()
  const changed =
    tail !== line.current
      ? { ...line, settled, current: tail, changedAt: now }
      : { ...line, settled }
  return { line: changed, heard: tail === '' ? null : tail }
}

/** The line as a whole, when the player has finished it. Null while there is nothing to send. */
export const finishOf = (line: Line): Readonly<{ line: Line; said: string | null }> => {
  const said = [line.settled, line.current]
    .filter((part) => part !== '')
    .join(' ')
    .trim()
  return said === ''
    ? { line, said: null }
    : { line: { ...line, settled: said, current: '', changedAt: 0 }, said }
}

/** True while a line has stood still long enough to be a finished sentence. */
export const quietAt = (line: Line, now: number): boolean =>
  line.current !== '' && now - line.changedAt > QUIET_MS

const transcriptOf = (result: Result): string =>
  result.channel?.alternatives?.[0]?.transcript?.trim() ?? ''

/** Opens the microphone and the socket. Resolves to the function that closes both. */
export const listen = async (sink: SpeechSink): Promise<() => Promise<void>> => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  })
  const unwatch = watchMic(stream)
  const context = new AudioContext()
  const source = context.createMediaStreamSource(stream)
  // A silent sink keeps the worklet pulling frames in every browser.
  const silence = context.createGain()
  silence.gain.value = 0
  const module = URL.createObjectURL(new Blob([CAPTURE], { type: 'text/javascript' }))
  await context.audioWorklet.addModule(module)
  URL.revokeObjectURL(module)
  const capture = new AudioWorkletNode(context, 'capture')
  source.connect(capture).connect(silence).connect(context.destination)

  const socket = new WebSocket(
    `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${ASR_PATH}`,
  )
  socket.binaryType = 'arraybuffer'
  let open = false
  let line = EMPTY_LINE

  const finish = (): void => {
    const done = finishOf(line)
    line = done.line
    if (done.said !== null) sink.uttered(done.said)
  }

  socket.addEventListener('open', () => {
    open = true
  })
  socket.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') return
    let result: Result
    try {
      result = JSON.parse(event.data) as Result
    } catch {
      return
    }
    if (result.type === 'UtteranceEnd') {
      finish()
      return
    }
    if (result.type !== 'Results') return
    const text = transcriptOf(result)
    if (text === '') return
    const read = heardIn(line, text, performance.now())
    line = read.line
    if (read.heard !== null) sink.heard(read.heard)
    if (result.speech_final === true) finish()
  })
  socket.addEventListener('close', () => {
    // A socket that never opened means no token, or no gateway: say so instead of waiting.
    if (!open) sink.failed('The microphone did not connect.')
    open = false
  })
  socket.addEventListener('error', () => {
    if (!open) sink.failed('The microphone did not connect.')
  })
  // The model sends no end-of-line marker over this transport, so a line that stops
  // changing is a line the player finished saying.
  const quiet = window.setInterval(() => {
    if (quietAt(line, performance.now())) finish()
  }, 200)
  capture.port.onmessage = (event: MessageEvent<Float32Array>) => {
    if (socket.readyState !== WebSocket.OPEN) return
    socket.send(pcm(event.data, context.sampleRate))
  }

  return async () => {
    window.clearInterval(quiet)
    capture.port.onmessage = null
    socket.close()
    source.disconnect()
    capture.disconnect()
    silence.disconnect()
    for (const track of stream.getTracks()) track.stop()
    unwatch()
    await context.close()
  }
}
