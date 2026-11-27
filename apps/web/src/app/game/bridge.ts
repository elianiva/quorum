import { Command } from '@effect/ui'
import { Effect, Schema } from 'effect'
import { ApiRpc } from '@/platform/rpc.ts'
import { Message } from '../../game/message.ts'

/* The game's update returns its effects as plain command values. Effect UI
   runs its own commands, so this service carries one across without changing
   the effect: the same work, the same message, one layer. Remove it when the
   game commands are declared as Effect UI commands. */
const EffectArg = Schema.declare<Effect.Effect<Message, never, ApiRpc>>(
  (input): input is Effect.Effect<Message, never, ApiRpc> => Effect.isEffect(input),
)

export class RunCommand extends Command.Service<RunCommand>()('RunCommand', {
  args: { name: Schema.String, effect: EffectArg },
  success: Message,
}) {
  static readonly layer = this.toLayer(
    Effect.succeed(({ effect }: { effect: Effect.Effect<Message, never, ApiRpc> }) =>
      effect.pipe(Effect.provide(ApiRpc.layer)),
    ),
  )
}

type GameCommand = Readonly<{
  name: string
  effect: Effect.Effect<Message, never, ApiRpc>
}>

export const runCommands = (commands: ReadonlyArray<GameCommand> | undefined) =>
  (commands ?? []).map((command) => RunCommand.make({ name: command.name, effect: command.effect }))
