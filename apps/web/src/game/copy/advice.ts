import type { AdviceLetters } from './letter.ts'
import { ALERTS } from './advice-alerts.ts'
import { INFRA } from './advice-infra.ts'
import { PEOPLE } from './advice-people.ts'

export const ADVICE: AdviceLetters = { ...INFRA, ...ALERTS, ...PEOPLE }
