/* ==========================================================================
   The listening bars follow the microphone. Moonshine owns the capture and
   reports no level of its own, so the bars read the stream it opened: the
   loudness of the room, trailed a few frames behind for each bar, so the row
   moves like a waveform instead of pulsing in place.
   ========================================================================== */

/** How many frames each bar trails the one before it, at 60 frames a second. */
const TRAIL = 3
/** A short history, so a loud syllable keeps showing after it is over. */
const HISTORY = 40
/** Below this RMS the room is quiet: bars sit at rest rather than flicker. */
const FLOOR = 0.004
/** Full height arrives at this RMS, which is ordinary speech with the gain on. */
const CEILING = 0.09

const bars = (): ReadonlyArray<HTMLElement> =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-dictation] [data-wave]'))

/** The stream a running transcriber captured, which it keeps to itself. */
const streamOf = (transcriber: unknown): MediaStream | null => {
  const internal = transcriber as { mediaStream?: MediaStream }
  return internal.mediaStream ?? null
}

/** The loudness of one frame, from a quiet room (0) to a full bar (1). */
export const loudness = (rms: number): number =>
  Math.min(1, Math.sqrt(Math.max(0, rms - FLOOR) / (CEILING - FLOOR)))

/**
 * Paints the microphone's level on the dictation bars until the returned
 * function runs. The fallback breathing animation stays on the bars until the
 * first frame arrives, so a meter that cannot start changes nothing.
 */
export const watchMic = (stream: MediaStream): (() => void) => {
  const context = new AudioContext()
  // A context made after the mic click still starts suspended in some builds.
  void context.resume()
  const analyser = context.createAnalyser()
  analyser.fftSize = 1024
  // The analyser's own smoothing is enough for the room; the bars smooth again per bar.
  analyser.smoothingTimeConstant = 0.35
  const source = context.createMediaStreamSource(stream)
  source.connect(analyser)
  const samples = new Float32Array(analyser.fftSize)
  const history: Array<number> = Array.from({ length: HISTORY }, () => 0)
  let level = 0
  let frame = 0
  let shown: ReadonlyArray<HTMLElement> = []
  const panel = () => document.querySelector<HTMLElement>('[data-dictation]')

  const draw = (): void => {
    frame = requestAnimationFrame(draw)
    analyser.getFloatTimeDomainData(samples)
    let sum = 0
    for (const sample of samples) sum += sample * sample
    const rms = Math.sqrt(sum / samples.length)
    // The square root keeps quiet speech visible, so the bars answer a normal voice,
    // not only a shout.
    const target = loudness(rms)
    // Fast attack, slow release: the row jumps on the syllable and settles after it.
    level += (target - level) * (target > level ? 0.55 : 0.12)
    history.push(level)
    history.shift()
    if (shown.length === 0 || shown[0]?.isConnected !== true) {
      shown = bars()
      // The bars stop breathing once the meter has something real to show.
      if (shown.length > 0) panel()?.setAttribute('data-live', '')
    }
    if (shown.length === 0) return
    for (const [index, bar] of shown.entries()) {
      const past = history[history.length - 1 - index * TRAIL] ?? 0
      bar.style.transform = `scaleY(${(0.12 + past * 0.88).toFixed(3)})`
    }
  }
  frame = requestAnimationFrame(draw)
  return () => {
    cancelAnimationFrame(frame)
    for (const bar of shown) bar.style.transform = ''
    panel()?.removeAttribute('data-live')
    source.disconnect()
    void context.close()
  }
}

/**
 * Starts the meter on the stream a transcriber opened. Metering never costs the
 * microphone: if the stream is out of reach, the bars keep their own motion.
 */
export const meterOf = (transcriber: unknown): (() => void) | null => {
  const stream = streamOf(transcriber)
  if (stream === null) return null
  try {
    return watchMic(stream)
  } catch {
    return null
  }
}
