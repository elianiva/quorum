export { ACHIEVEMENT_IDS } from '../generated/achievements.ts'
import { ACHIEVEMENT_IDS } from '../generated/achievements.ts'
export { ACHIEVEMENTS } from '../generated/achievements.ts'

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number]

export type AchievementDef = Readonly<{
  id: AchievementId
  name: string
  condition: string
}>
