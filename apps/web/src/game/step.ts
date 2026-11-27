import { Command } from '@effect/ui'
import { Option } from 'effect'

export type IssuedCommand<Message, R = never> = Extract<
  Command.Command<Message, R>,
  { readonly _tag: 'Effect' }
>

export type UpdateReturn<Model, Message, R = never> = Readonly<{
  model: Model
  commands?: ReadonlyArray<IssuedCommand<Message, R>>
}>

export type UpdateReturnWithOutMessage<Model, Message, OutMessage, R = never> = Readonly<{
  model: Model
  commands?: ReadonlyArray<IssuedCommand<Message, R>>
  outMessage?: OutMessage
}>

export type Step<Model, Message, R = never> = (model: Model) => UpdateReturn<Model, Message, R>

type ChildFold<ParentModel, ParentMessage, ChildModel, Input, ChildMessage, ChildOutMessage> =
  Readonly<{
    update: (
      childModel: ChildModel,
      input: Input,
    ) => UpdateReturnWithOutMessage<ChildModel, ChildMessage, ChildOutMessage>
    read: (model: ParentModel) => Option.Option<ChildModel>
    write: (model: ParentModel, nextChildModel: ChildModel) => ParentModel
    toParentMessage: (message: ChildMessage) => ParentMessage
    foldOutMessage?: (
      outMessage: ChildOutMessage,
      context: Readonly<{
        liftCommand: (command: IssuedCommand<ChildMessage>) => IssuedCommand<ParentMessage>
        liftCommands: (
          commands: ReadonlyArray<IssuedCommand<ChildMessage>>,
        ) => ReadonlyArray<IssuedCommand<ParentMessage>>
      }>,
    ) => Step<ParentModel, ParentMessage>
  }>

const joined = <Model, Message>(
  model: Model,
  commands: ReadonlyArray<IssuedCommand<Message>>,
): UpdateReturn<Model, Message> => (commands.length === 0 ? { model } : { model, commands })

export const combine = <Model, Message>(
  model: Model,
  steps: ReadonlyArray<Step<Model, Message>>,
): UpdateReturn<Model, Message> => {
  let current: Model = model
  const commands: Array<IssuedCommand<Message>> = []
  for (const step of steps) {
    const result = step(current)
    current = result.model
    if (result.commands !== undefined) commands.push(...result.commands)
  }
  return joined(current, commands)
}

export const foldChild = <
  ParentModel,
  ParentMessage,
  ChildModel,
  Input,
  ChildMessage,
  ChildOutMessage,
>(
  config: ChildFold<ParentModel, ParentMessage, ChildModel, Input, ChildMessage, ChildOutMessage>,
): {
  (model: ParentModel, input: Input): UpdateReturn<ParentModel, ParentMessage>
  (input: Input): Step<ParentModel, ParentMessage>
} => {
  const liftCommand = (command: IssuedCommand<ChildMessage>): IssuedCommand<ParentMessage> =>
    Command.map(command, config.toParentMessage) as IssuedCommand<ParentMessage>
  const liftCommands = (
    commands: ReadonlyArray<IssuedCommand<ChildMessage>>,
  ): ReadonlyArray<IssuedCommand<ParentMessage>> => commands.map(liftCommand)

  const run = (model: ParentModel, input: Input): UpdateReturn<ParentModel, ParentMessage> => {
    const child = config.read(model)
    if (Option.isNone(child)) return { model }
    const result = config.update(child.value, input)
    const written = config.write(model, result.model)
    const commands: Array<IssuedCommand<ParentMessage>> = [
      ...(result.commands === undefined ? [] : liftCommands(result.commands)),
    ]
    if (result.outMessage === undefined || config.foldOutMessage === undefined)
      return joined(written, commands)
    const folded = config.foldOutMessage(result.outMessage, { liftCommand, liftCommands })(written)
    if (folded.commands !== undefined) commands.push(...folded.commands)
    return joined(folded.model, commands)
  }

  const call = (modelOrInput: ParentModel | Input, input?: Input): unknown =>
    input === undefined
      ? (model: ParentModel) => run(model, modelOrInput as Input)
      : run(modelOrInput as ParentModel, input)
  return call as {
    (model: ParentModel, input: Input): UpdateReturn<ParentModel, ParentMessage>
    (input: Input): Step<ParentModel, ParentMessage>
  }
}
