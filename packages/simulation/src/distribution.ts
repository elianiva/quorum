export const ERROR_CAUSES = [
  'stranded',
  'dropped',
  'refused',
  'down',
  'stale',
  'oom',
  'timeout',
  'crash',
  'blocked',
  'upstream',
  'throttled',
  'duplicate',
  'misrouted',
] as const
export type ErrorCause = (typeof ERROR_CAUSES)[number]
export type Failures = Readonly<Record<ErrorCause, number>>
