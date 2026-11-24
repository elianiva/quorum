export {
  PLAYTEST_PACE,
  INCIDENT_GAP_SECONDS,
  FIRST_INCIDENT_AFTER_SECONDS,
  CALENDAR_PACE,
  LIVE_TUNING,
  CHALLENGE_TUNING,
} from '../generated/tuning.ts'

export type Tuning = Readonly<{
  pace: number
  incidentGap: number
  firstIncidentAfter: number
  calendarPace: number
}>
