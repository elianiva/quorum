import { Result } from 'effect'
import { CHALLENGES, runChallenge } from '../src/challenges.ts'
import { referenceReplay } from '../test/fixtures/challenges.ts'
import { GOLDEN_STEPS, goldenGame, replay } from '../test/fixtures/golden.ts'
import { hashGame } from '../src/hash.ts'

export type Report = Readonly<{ golden: string; challenges: Readonly<Record<string, string>> }>

export const report = (): Report => ({
  golden: hashGame(replay(goldenGame(), GOLDEN_STEPS)),
  challenges: Object.fromEntries(
    CHALLENGES.map((challenge) => {
      const result = runChallenge(challenge, referenceReplay(challenge))
      return [challenge.id, Result.isSuccess(result) ? result.success.hash : result.failure]
    }),
  ),
})
