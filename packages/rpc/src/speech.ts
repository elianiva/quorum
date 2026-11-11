/**
 * Speech to text: the browser captures the microphone and streams 16 kHz PCM
 * over a WebSocket. The dev server proxies the socket to Deepgram's Nova-3 on
 * Workers AI, so the account token stays on the server. A finished line is an
 * utterance; the text still in flight is the grey part of the bar.
 */

/** Where the browser opens the microphone socket. Served by the dev server in a local prototype. */
export const ASR_PATH = '/api/asr'

/** The model the proxy asks for. */
export const ASR_MODEL = '@cf/deepgram/nova-3'

/** What the socket expects of the audio it is sent. */
export const ASR_SAMPLE_RATE = 16_000

/**
 * Keyterm prompting: the game's own words, so the model hears them the way the
 * board spells them instead of as ordinary English.
 */
export const ASR_KEYTERMS: ReadonlyArray<string> = [
  'App Server',
  'Worker',
  'Database',
  'Postgres',
  'MySQL',
  'Cache',
  'Redis',
  'Queue',
  'CDN',
  'WAF',
  'Load Balancer',
  'Autoscaler',
  'Replica',
  'Pooler',
  'Search Engine',
  'Object Storage',
  'Stripe',
  'Research',
  'Team',
  'Dashboard',
  'Bottleneck',
  'Upsize',
  'Downsize',
]

/** The query the proxy adds to the gateway socket. Silence is 400 ms, so a pause ends a clause. */
export const asrQuery = (): string => {
  const query = new URLSearchParams({
    model: ASR_MODEL,
    encoding: 'linear16',
    sample_rate: String(ASR_SAMPLE_RATE),
    interim_results: 'true',
    endpointing: '400',
    vad_events: 'true',
    language: 'en',
  })
  for (const term of ASR_KEYTERMS) query.append('keyterm', term)
  return query.toString()
}
