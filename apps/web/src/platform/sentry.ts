import * as Sentry from '@sentry/browser'
import { Option, Schema } from 'effect'
import { API_PREFIX, ApiError } from '@quorum/rpc'
import { SIM_VERSION } from '@quorum/simulation/version'
import { PREFS_KEY, readStored } from '../game/storage.ts'

const DSN = import.meta.env.VITE_SENTRY_DSN
const RELEASE = import.meta.env.VITE_SENTRY_RELEASE

const TRACES_SAMPLE_RATE = 0.1
const PROFILE_SESSION_SAMPLE_RATE = 0.05

const optedOut = (): boolean => {
  if (navigator.doNotTrack === '1') return true
  const raw = readStored(PREFS_KEY)
  if (raw === null) return false
  try {
    return (JSON.parse(raw) as { analytics?: unknown }).analytics === false
  } catch {
    return false
  }
}

export const setSentryConsent = (next: boolean): void => {
  if (!next) void Sentry.close()
}

export const startSentry = (): void => {
  if (!DSN || !import.meta.env.PROD || optedOut()) return
  Sentry.init({
    dsn: DSN,
    release: RELEASE,
    integrations: [Sentry.browserTracingIntegration(), Sentry.browserProfilingIntegration()],
    tracesSampleRate: TRACES_SAMPLE_RATE,
    profileSessionSampleRate: PROFILE_SESSION_SAMPLE_RATE,
    profileLifecycle: 'trace',
    tracePropagationTargets: [`${API_PREFIX}/`],
    initialScope: { tags: { service: 'web', sim_version: SIM_VERSION } },
  })
}

export const reportBoardFailure = (error: unknown): void => {
  if (!DSN) return
  Sentry.captureException(error, {
    level: 'error',
    tags: { board: 'start-failed' },
  })
}

export const reportSurveyFailure = (
  error: { readonly _tag: string; readonly message: string },
  exit: { readonly exit: string; readonly stage: number },
): void => {
  if (!DSN) return
  const rejected = Option.isSome(Schema.decodeUnknownOption(ApiError)(error))
  const report = new Error(rejected ? error.message : 'The API Worker could not be reached.')
  report.name = rejected ? 'SurveyRejected' : 'SurveyUnreachable'
  Sentry.captureException(report, {
    level: 'error',
    tags: {
      survey: rejected ? 'rejected' : 'unreachable',
      exit: exit.exit,
      era: String(exit.stage),
    },
    fingerprint: ['survey-submit', rejected ? 'rejected' : 'unreachable', exit.exit],
  })
}

export const traced = <Result>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  run: () => Result,
): Result => (DSN ? Sentry.startSpan({ name, op: 'game', attributes }, run) : run())

export const annotateSpan = (attributes: Record<string, string | number | boolean>): void => {
  if (DSN) Sentry.getActiveSpan()?.setAttributes(attributes)
}
