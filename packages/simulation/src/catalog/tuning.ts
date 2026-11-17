export const PLAYTEST_PACE = 2
export const INCIDENT_GAP_SECONDS = 400
export const FIRST_INCIDENT_AFTER_SECONDS = 90
export const CALENDAR_PACE = 24

export type Tuning = Readonly<{
  pace: number
  incidentGap: number
  firstIncidentAfter: number
  calendarPace: number
}>

export const LIVE_TUNING: Tuning = {
  pace: PLAYTEST_PACE,
  incidentGap: INCIDENT_GAP_SECONDS,
  firstIncidentAfter: FIRST_INCIDENT_AFTER_SECONDS,
  calendarPace: CALENDAR_PACE,
}

export const CHALLENGE_TUNING: Tuning = {
  pace: 1,
  incidentGap: 720,
  firstIncidentAfter: 600,
  calendarPace: CALENDAR_PACE,
}
