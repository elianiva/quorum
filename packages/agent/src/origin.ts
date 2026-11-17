export const QUORUM_ORIGIN = 'https://playquorum.dev'

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

export const isAllowedOrigin = (origin: string | null): boolean => {
  if (origin === null) return true
  if (origin === QUORUM_ORIGIN) return true
  try {
    return LOOPBACK.has(new URL(origin).hostname)
  } catch {
    return false
  }
}
