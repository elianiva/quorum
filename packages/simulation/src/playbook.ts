import { Effect, Option, Result, Schema } from 'effect'
import { COMPONENTS, HOME_REGION, RESEARCH } from './catalog.ts'
import {
  Refusal,
  connect,
  place,
  placeBox,
  resize,
  setFamily,
  rollRestore,
  setFramework,
  setRuntime,
  type Action,
} from './actions.ts'
import { decodeText, encodeText } from './codec.ts'
import { placeRefusal, retryRefusal } from './founding.ts'
import { isUnlocked } from './lookups.ts'
import { ComponentId, GameLink, GameNode, type Game, type RegionId, type Retries } from './state.ts'

export const PlaybookNode = Schema.Struct({
  key: Schema.String,
  type: ComponentId,
  dx: Schema.Finite,
  dy: Schema.Finite,
  settings: Schema.Record(Schema.String, Schema.Unknown),
})
export type PlaybookNode = typeof PlaybookNode.Type

export const PlaybookBox = Schema.Struct({
  name: Schema.String,
  keys: Schema.Array(Schema.String),
})
export type PlaybookBox = typeof PlaybookBox.Type

export const Playbook = Schema.Struct({
  name: Schema.String,
  nodes: Schema.Array(PlaybookNode),
  boxes: Schema.Array(PlaybookBox).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([] as ReadonlyArray<PlaybookBox>)),
  ),
  links: Schema.Array(
    Schema.Struct({
      from: Schema.String,
      to: Schema.String,
      settings: Schema.Record(Schema.String, Schema.Unknown),
    }),
  ),
})
export type Playbook = typeof Playbook.Type

export const NODE_SETTINGS = [
  'workers',
  'sampleRate',
  'retention',
  'compress',
  'recycle',
  'policy',
  'checkEvery',
  'deepCheck',
  'ttl',
  'engine',
  'dbEngine',
  'topology',
  'iops',
  'parts',
  'shards',
  'storageClass',
  'keep',
  'lifecycle',
  'cacheStrategy',
  'refresh',
  'sticky',
  'slowStart',
  'purge',
  'cacheKey',
  'earlyExpiry',
  'swr',
  'shardKey',
  'sync',
  'searchVariant',
  'searchShards',
  'searchReplicas',
  'heap',
  'storeVariant',
  'pm',
  'mode',
  'dlq',
  'attempts',
  'maxLength',
  'prefetch',
  'coalesce',
  'warming',
  'paranoia',
  'rateLimit',
  'authEdge',
  'merge',
  'strategy',
  'presence',
  'backoff',
  'clustering',
  'standby',
  'signal',
  'target',
  'minCopies',
  'maxCopies',
  'gpu',
  'gpuModel',
  'collector',
  'gogc',
  'shed',
  'ryw',
  'n',
  'r',
  'w',
  'spread',
  'backup',
  'fanout',
  'split',
  'pricing',
] as const
export const STACK_SETTINGS = ['size', 'family', 'runtime', 'framework'] as const
export const LINK_SETTINGS = ['timeout', 'retries', 'kinds', 'breaker'] as const

export const pick = (from: object, keys: ReadonlyArray<string>): Record<string, unknown> =>
  Object.fromEntries(
    keys.filter((key) => key in from).map((key) => [key, (from as Record<string, unknown>)[key]]),
  )

export const SHARED: ReadonlyArray<GameNode['type']> = ['users', 'payments', 'analytics']

const fixedKey = (node: GameNode): string => `@${node.type}`

export const capture = (game: Game, ids: ReadonlyArray<string>, name: string): Playbook | null => {
  const chosen = game.nodes.filter(
    (node) => ids.includes(node.id) && !COMPONENTS[node.type].fixed && !SHARED.includes(node.type),
  )
  if (chosen.length === 0) return null
  const left = Math.min(...chosen.map((node) => node.x))
  const top = Math.min(...chosen.map((node) => node.y))
  const keys = new Map(chosen.map((node) => [node.id, node.id]))
  const endOf = (id: string): string | null => {
    if (keys.has(id)) return id
    const node = game.nodes.find((entry) => entry.id === id)
    return node && SHARED.includes(node.type) ? fixedKey(node) : null
  }
  const contained = new Set(chosen.map((node) => node.id))
  return {
    name,
    nodes: chosen.map((node) => ({
      key: node.id,
      type: node.type,
      dx: node.x - left,
      dy: node.y - top,
      settings: pick(node, [...STACK_SETTINGS, ...NODE_SETTINGS]),
    })),
    boxes: game.boxes
      .filter((box) => box.nodes.every((id) => contained.has(id)))
      .map((box) => ({ name: box.name, keys: [...box.nodes] })),
    links: game.links.flatMap((link) => {
      const from = endOf(link.from)
      const to = endOf(link.to)
      if (!from || !to || (!keys.has(link.from) && !keys.has(link.to))) return []
      return [{ from, to, settings: pick(link, LINK_SETTINGS) }]
    }),
  }
}

export const ghostReason = (game: Game, node: PlaybookNode, region: RegionId): string | null => {
  const def = COMPONENTS[node.type]
  if (def.fixed) return `${def.name} is already on the Board.`
  if (!isUnlocked(game, node.type) && def.unlock) return RESEARCH[def.unlock].name
  return placeRefusal(game, node.type, region)
}

export type Placed = Readonly<{
  game: Game
  placed: number
  ghosts: ReadonlyArray<PlaybookNode>
  ids: ReadonlyMap<string, string>
}>

const decodeNode = Schema.decodeUnknownOption(GameNode)
const decodeLink = Schema.decodeUnknownOption(GameLink)

const configure = (game: Game, id: string, settings: Record<string, unknown>): Game => {
  let next = game
  const tryAction = (action: Action) => {
    if (Result.isSuccess(action)) next = action.success
  }
  const node = () => next.nodes.find((entry) => entry.id === id)
  const rawParts = settings.parts
  if (rawParts !== null && typeof rawParts === 'object') {
    const p = rawParts as Record<string, unknown>
    if (typeof p.cpu === 'boolean' && typeof p.ram === 'boolean' && typeof p.disk === 'boolean')
      next = {
        ...next,
        nodes: next.nodes.map((entry) =>
          entry.id === id
            ? { ...entry, parts: { cpu: p.cpu, ram: p.ram, disk: p.disk } as GameNode['parts'] }
            : entry,
        ),
      }
  }
  if (typeof settings.family === 'string')
    tryAction(setFamily(next, id, settings.family as GameNode['family']))
  if (typeof settings.size === 'number')
    for (let guard = 0; guard < 12 && (node()?.size ?? 0) < settings.size; guard += 1) {
      const before = node()?.size
      tryAction(resize(next, id, 1))
      if (node()?.size === before) break
    }
  if (typeof settings.runtime === 'string')
    tryAction(setRuntime(next, id, settings.runtime as GameNode['runtime']))
  if (typeof settings.framework === 'string')
    tryAction(setFramework(next, id, settings.framework as GameNode['framework']))
  const current = node()
  if (!current) return next
  const merged = decodeNode({ ...current, ...pick(settings, NODE_SETTINGS) })
  if (Option.isSome(merged))
    next = { ...next, nodes: next.nodes.map((entry) => (entry.id === id ? merged.value : entry)) }
  if (typeof settings.backup === 'string' && settings.backup !== 'none')
    next = rollRestore(next, id)
  return next
}

const linkWith = (game: Game, from: string, to: string, settings: object): Game => {
  const linked = connect(game, from, to)
  if (Result.isFailure(linked)) return game
  const made = linked.success.links.find((entry) => entry.from === from && entry.to === to)
  const shared: Record<string, unknown> = { ...pick(settings, LINK_SETTINGS) }
  if (typeof shared.retries === 'string' && retryRefusal(linked.success, shared.retries as Retries))
    delete shared.retries
  const merged = made ? decodeLink({ ...made, ...shared }) : null
  return merged !== null && Option.isSome(merged)
    ? {
        ...linked.success,
        links: linked.success.links.map((entry) => (entry === made ? merged.value : entry)),
      }
    : linked.success
}

export const placePlaybook = (
  game: Game,
  playbook: Playbook,
  x: number,
  y: number,
  region: RegionId = HOME_REGION,
): Result.Result<Placed, Refusal> => {
  let next = game
  const ids = new Map<string, string>()
  const ghosts: Array<PlaybookNode> = []
  for (const entry of playbook.nodes) {
    if (ghostReason(next, entry, region)) {
      ghosts.push(entry)
      continue
    }
    const id = `n${next.nextId}`
    const placed = place(next, entry.type, x + entry.dx, y + entry.dy, region)
    if (Result.isFailure(placed)) return Result.fail(placed.failure)
    next = configure(placed.success, id, entry.settings)
    ids.set(entry.key, id)
  }
  if (ids.size === 0)
    return Result.fail(
      Refusal.NotAllowed({
        reason: `Nothing in ${playbook.name} can be built yet: ${ghosts
          .map((ghost) => ghostReason(game, ghost, region))
          .filter((reason, index, all) => reason && all.indexOf(reason) === index)
          .join(', ')}.`,
      }),
    )
  const endOf = (key: string): string | undefined => {
    if (!key.startsWith('@')) return ids.get(key)
    const type = key.slice(1)
    return (
      next.nodes.find((node) => node.type === type && node.region === region) ??
      next.nodes.find((node) => node.type === type)
    )?.id
  }
  for (const link of playbook.links) {
    const from = endOf(link.from)
    const to = endOf(link.to)
    if (from && to) next = linkWith(next, from, to, link.settings)
  }
  for (const box of playbook.boxes) {
    const members = box.keys.flatMap((key) => {
      const id = ids.get(key)
      return id ? [id] : []
    })
    if (members.length >= 2) next = placeBox(next, members, box.name)
  }
  return Result.succeed({ game: next, placed: ids.size, ghosts, ids })
}

export const duplicate = (
  game: Game,
  playbook: Playbook,
  x: number,
  y: number,
  region: RegionId = HOME_REGION,
): Result.Result<Placed, Refusal> =>
  Result.map(placePlaybook(game, playbook, x, y, region), (placed) => {
    const outside = (id: string) =>
      !placed.ids.has(id) &&
      game.nodes.some((node) => node.id === id && !SHARED.includes(node.type))
    const owners = new Map(
      [...placed.ids].flatMap(([key, id]) => {
        const serviceId = game.nodes.find((node) => node.id === key)?.serviceId
        return serviceId ? [[id, serviceId] as const] : []
      }),
    )
    let next: Game = {
      ...placed.game,
      nodes: placed.game.nodes.map((node) => {
        const serviceId = owners.get(node.id)
        return serviceId ? { ...node, serviceId } : node
      }),
    }
    for (const link of game.links) {
      const from = placed.ids.get(link.from)
      const to = placed.ids.get(link.to)
      if (from && outside(link.to)) next = linkWith(next, from, link.to, link)
      else if (to && outside(link.from)) next = linkWith(next, link.from, to, link)
    }
    return { ...placed, game: next }
  })

const PREFIX = 'QPB1:'

export const encodePlaybook = (playbook: Playbook): string =>
  encodeText(PREFIX, Schema.encodeSync(Playbook)(playbook))

const decode = Schema.decodeUnknownOption(Playbook)

export const decodePlaybook = (text: string): Result.Result<Playbook, Refusal> => {
  const parsed = decode(decodeText(PREFIX, text))
  return Option.match(parsed, {
    onNone: () => Result.fail(Refusal.NotAllowed({ reason: 'That is not a Playbook.' })),
    onSome: (value) => Result.succeed(value),
  })
}
