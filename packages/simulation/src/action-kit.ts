import { Data, Result } from 'effect'
import {
  GATES,
  RESEARCH,
  type ComponentId,
  type GateDef,
  type GateKey,
  type GateValue,
} from './catalog.ts'
import type { IncidentId } from './catalog.ts'
import { has } from './lookups.ts'
import type { Game, GameNode, Incident } from './state.ts'
import { activeIncident } from './state.ts'
import { ackIncident, updateIncident, type IncidentState } from './incident-machine.ts'

export type Refusal = Data.TaggedEnum<{
  Locked: { readonly what: string; readonly research: string }
  TooEarly: { readonly what: string; readonly era: string }
  Unaffordable: {
    readonly what: string
    readonly price: number
    readonly currency: 'cash'
  }
  NotAllowed: { readonly reason: string }
  Missing: {}
}>

export const Refusal = Data.taggedEnum<Refusal>()

export const describeRefusal = (refusal: Refusal): string =>
  Refusal.$match(refusal, {
    Locked: ({ what, research }) => `${what} needs ${research}.`,
    TooEarly: ({ what, era }) => `${what} opens in ${era}.`,
    Unaffordable: ({ what, price }) =>
      `${what} costs $${Math.round(price).toLocaleString('en-US')}.`,
    NotAllowed: ({ reason }) => reason,
    Missing: () => 'That is gone.',
  })

export type Action = Result.Result<Game, Refusal>

export const ok = (game: Game): Action => Result.succeed(game)
export const no = (refusal: Refusal): Action => Result.fail(refusal)
export const notAllowed = (reason: string): Action => no(Refusal.NotAllowed({ reason }))

/** The refusal for setting a gated field to `value` before its research, from `GATES`. */
export const locked = (game: Game, key: GateKey, value: GateValue): Action | undefined => {
  const gate: GateDef = GATES[key]
  const open = gate.free ? gate.free.includes(value) : !(gate.locked ?? []).includes(value)
  return open || has(game, gate.research)
    ? undefined
    : no(
        Refusal.Locked({
          what: gate.what ?? gate.labels?.[String(value)]?.name ?? String(value),
          research: RESEARCH[gate.research].name,
        }),
      )
}

export const withNode = (game: Game, id: string, apply: (node: GameNode) => Action): Action => {
  const node = game.nodes.find((entry) => entry.id === id)
  return node ? apply(node) : no(Refusal.Missing())
}

/// What a generated setter may do: refuse another Component, check the allowed values, apply the
/// field's gate, and either patch one Node or every Node of the Component.
export type FieldSetterOptions<V> = Readonly<{
  only?: string
  values?: ReadonlyArray<V>
  what?: string
  locked?: GateKey
  scope?: 'all-of-type'
}>

export const fieldSetter = <K extends keyof GameNode>(
  component: ComponentId,
  field: K,
  options: FieldSetterOptions<GameNode[K]>,
): ((game: Game, id: string, value: GameNode[K]) => Action) => {
  return (game, id, value) => {
    if (options.scope === 'all-of-type')
      return ok({
        ...game,
        nodes: game.nodes.map((node) =>
          node.type === component ? ({ ...node, [field]: value } as GameNode) : node,
        ),
      })
    return withNode(game, id, (node) => {
      if (node.type !== component)
        return notAllowed(options.only ?? 'That setting belongs to another Component.')
      if (options.values && !options.values.includes(value))
        return notAllowed(`${options.what ?? 'The values'} are ${options.values.join(', ')}.`)
      const refused = options.locked
        ? locked(game, options.locked, value as unknown as GateValue)
        : undefined
      if (refused) return refused
      return node[field] === value
        ? ok(game)
        : ok(patch(game, id, { [field]: value } as Partial<GameNode>))
    })
  }
}

export const patch = (game: Game, id: string, change: Partial<GameNode>): Game => ({
  ...game,
  nodes: game.nodes.map((node) => (node.id === id ? { ...node, ...change } : node)),
})

export const spend = (
  game: Game,
  price: number,
  what: string,
  apply: (game: Game) => Game,
): Action =>
  game.cash < price
    ? no(Refusal.Unaffordable({ what, price, currency: 'cash' }))
    : ok(apply({ ...game, cash: game.cash - price }))

export const answering = (game: Game): IncidentState => ackIncident(game.incident, game.time)

export const answered = (game: Game, change: Partial<Incident>): IncidentState =>
  updateIncident(answering(game), change)

export const endIncident = (game: Game, kind: IncidentId, refusal: string): Action =>
  activeIncident(game)?.kind === kind
    ? ok({ ...game, incident: answered(game, { remaining: 0 }) })
    : notAllowed(refusal)
