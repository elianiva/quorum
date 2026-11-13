/* ==========================================================================
   Why a request fails, in the order the Ledger lists the causes. The kernel
   (`kernel/`) writes each cause's share in this order.
   ========================================================================== */

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
] as const
export type ErrorCause = (typeof ERROR_CAUSES)[number]
export type Failures = Readonly<Record<ErrorCause, number>>
