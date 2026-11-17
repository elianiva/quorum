const UNITS = ['', 'k', 'M', 'B', 'T'] as const

export const compact = (value: number): string => {
  const sign = value < 0 ? '−' : ''
  let rest = Math.abs(value)
  let unit = 0
  while (rest >= 1000 && unit < UNITS.length - 1) {
    rest /= 1000
    unit += 1
  }
  const digits =
    unit === 0 ? (rest < 10 && rest % 1 !== 0 ? 1 : 0) : rest < 10 ? 2 : rest < 100 ? 1 : 0
  return `${sign}${rest.toFixed(digits)}${UNITS[unit] ?? ''}`
}

export const money = (value: number): string => {
  const sign = value < 0 ? '−' : ''
  const rest = Math.abs(value)
  return `${sign}$${rest < 1000 ? (rest < 10 ? rest.toFixed(2) : Math.round(rest)) : compact(rest)}`
}

export const priceLabel = (sandbox: boolean, value: number): string => (sandbox ? '' : money(value))

export const rate = (value: number): string =>
  value === Number.POSITIVE_INFINITY ? '∞' : value < 100 ? value.toFixed(1) : compact(value)

export const ms = (value: number): string =>
  value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)} s`

export const sharePercent = (share: number): string => `${(share * 100).toFixed(1)}%`

export const queueWait = (seconds: number | null): string =>
  seconds === null
    ? '—'
    : seconds === Number.POSITIVE_INFINITY
      ? 'stalled'
      : seconds < 60
        ? `${Math.round(seconds)} s`
        : seconds < 3600
          ? `${Math.round(seconds / 60)} min`
          : `${Math.round(seconds / 3600)} h`

export const alertText = (
  rule: 'errors' | 'latency' | 'saturation' | 'queue' | 'budget',
  threshold: number,
): string =>
  rule === 'errors'
    ? `Error rate above ${threshold * 100}%`
    : rule === 'latency'
      ? `p99 above ${threshold}× the Apdex target`
      : rule === 'queue'
        ? `A Queue's oldest task older than ${threshold} s`
        : rule === 'budget'
          ? `Error budget burning above ${threshold}×`
          : `A Node above ${Math.round(threshold * 100)}% load`

export const duration = (seconds: number): string =>
  seconds < 60 ? `${seconds} s` : seconds < 3600 ? `${seconds / 60} min` : `${seconds / 3600} h`

export const clock = (seconds: number): string => {
  const whole = Math.floor(seconds)
  const hours = Math.floor(whole / 3600)
  const minutes = Math.floor((whole % 3600) / 60)
  const rest = String(whole % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`
}
