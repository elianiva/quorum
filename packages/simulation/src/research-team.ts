import { RESEARCH, TEAM_TRACKS, type ResearchId, type ResearchTrack } from './catalog.ts'
import type { Game, Team } from './state.ts'

export const teamReady = (game: Game, team: Team): boolean =>
  team.kindAt === undefined || game.time >= team.kindAt

export const teamHasEngineers = (game: Game, team: Team): boolean =>
  game.teams[0]?.id === team.id || game.engineers.some((engineer) => engineer.team === team.id)

export const teamTracks = (team: Team): ReadonlyArray<ResearchTrack> => TEAM_TRACKS[team.kind] ?? []

export const canBoost = (game: Game, team: Team, id: ResearchId): boolean => {
  if (!teamReady(game, team) || !teamHasEngineers(game, team)) return false
  if (team.kind === 'product') return true
  return teamTracks(team).includes(RESEARCH[id].track)
}

export const teamBoosting = (game: Game, team: Team): boolean => {
  const study = game.studies[0]
  return study !== undefined && game.researchTeam === team.id && canBoost(game, team, study.id)
}

export const boosterFor = (
  game: Game,
  teamId: string | null,
  id: ResearchId | undefined,
): string | null => {
  if (teamId === null || id === undefined) return null
  const team = game.teams.find((entry) => entry.id === teamId)
  if (!team || !canBoost(game, team, id)) return null
  return teamId
}
