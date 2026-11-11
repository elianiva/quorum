import { ASR_MODEL } from '@quorum/rpc'

/**
 * Speech to text, from anywhere. The browser streams 16 kHz PCM to this route,
 * and the route holds a socket to Deepgram's Nova-3 on Workers AI, copying
 * frames each way. The `AI` binding does the authentication, so no account
 * token reaches the page.
 *
 * The model finalises a line when the player stops talking, and the page reads
 * the same results the model sends: interim words, then the finished line.
 */
export const asrSocket = async (request: Request, ai: Ai): Promise<Response> => {
  if (request.headers.get('Upgrade') !== 'websocket')
    return new Response('Upgrade required', { status: 426 })
  const pair = new WebSocketPair()
  const client = pair[0]
  const server = pair[1]
  server.accept()

  let recognizer: WebSocket
  try {
    const upstream = await ai.run(
      ASR_MODEL,
      // The binding types its input as the batch form. Over a socket the audio is
      // the frames themselves, so the request carries only the parameters.
      {
        encoding: 'linear16',
        sample_rate: '16000',
        interim_results: true,
        // 400 ms of silence ends a line, so a paused sentence runs as one clause chain.
        endpointing: '400',
        vad_events: true,
        language: 'en',
      } as never,
      { websocket: true },
    )
    const socket = upstream.webSocket
    if (socket === null) return new Response('Speech to text is not available.', { status: 502 })
    recognizer = socket
  } catch {
    return new Response('Speech to text is not available.', { status: 502 })
  }
  recognizer.accept()

  const send = (socket: WebSocket, data: string | ArrayBuffer): void => {
    if (socket.readyState !== WebSocket.OPEN) return
    try {
      socket.send(data)
    } catch {
      // The other end went away between the check and the send.
    }
  }

  server.addEventListener('message', (event) => send(recognizer, event.data))
  recognizer.addEventListener('message', (event) => send(server, event.data))
  server.addEventListener('close', () => recognizer.close())
  recognizer.addEventListener('close', () => server.close())
  server.addEventListener('error', () => recognizer.close())
  recognizer.addEventListener('error', () => server.close())

  return new Response(null, { status: 101, webSocket: client })
}
