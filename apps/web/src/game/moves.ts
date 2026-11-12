import { Result, Schema } from 'effect'
import {
  COMPONENT_IDS,
  COMPONENTS,
  ERAS,
  REGION_INFO,
  RESEARCH,
  RESEARCH_IDS,
  SIZES,
  type ComponentId,
  type ResearchId,
} from '@quorum/simulation/catalog'
import { connect, place, resize, shortOfCash, type Refusal } from '@quorum/simulation/actions'
import { researchReady } from '@quorum/simulation/lookups'
import { nodeLabel } from '@quorum/simulation/labels'
import { regionView } from '@quorum/simulation/regions'
import { solveFlow } from '@quorum/simulation/solve'
import {
  ComponentId as ComponentIdSchema,
  ResearchId as ResearchIdSchema,
  type Game,
  type GameNode,
  type Region,
} from '@quorum/simulation/state'
import { CARD_W, CLEARANCE, boxOf, freeSpot, heightOf } from '@quorum/ui/board/geometry'
import type { IntentAnswers, IntentChoice, IntentQuestion, IntentRequest } from '@quorum/rpc'
import type { Panel } from './model.ts'
import { BOARD_MOVES, commandsFor, optionsFor } from './move-options.ts'
import type { Message } from './message.ts'

/* ==========================================================================
   Moves: what the player can ask for in words. A Move is one intent, and one
   intent can take more than one Message (Study opens the panel, focuses the
   item, and queues it). The options a move is chosen from come from the Game,
   so the model can only pick a move the board allows right now.

   One clause of dictation, one decision, one Move. Clauses run in order
   against the Board each move left, which is how "that" finds the Node the
   clause before just bought.
   ========================================================================== */

export const PANEL_IDS = [
  'research',
  'team',
  'dashboard',
  'inbox',
  'churn',
  'cost',
  'vitals',
  'help',
  'menu',
  'settings',
] as const
export type PanelId = (typeof PANEL_IDS)[number]

export const isPanel = (id: string): id is PanelId =>
  (PANEL_IDS as ReadonlyArray<string>).includes(id)

export type Move =
  | Readonly<{ _tag: 'Place'; type: ComponentId }>
  | Readonly<{ _tag: 'Connect'; from: string; to: string }>
  | Readonly<{ _tag: 'Resize'; nodeId: string; direction: 1 | -1 }>
  | Readonly<{ _tag: 'Study'; id: ResearchId }>
  | Readonly<{ _tag: 'Research'; id: ResearchId }>
  | Readonly<{ _tag: 'Node'; nodeId: string }>
  | Readonly<{ _tag: 'Panel'; panel: PanelId }>
  /** A Node setting or command, already resolved to the Message the board answers. */
  | Readonly<{ _tag: 'Setting'; message: Message; focus: string | null }>
  | Readonly<{ _tag: 'Nothing' }>

/** A Move, what to call it, and whether the answers were sure enough to act. */
export type Resolved = Readonly<{
  move: Move
  label: string
  confident: boolean
}>

const NOTHING: Resolved = { move: { _tag: 'Nothing' }, label: '', confident: false }

export type Clause = Readonly<{ text: string; start: number; end: number }>

const CUES = ['and then', 'after that', 'then', 'also', 'next'] as const

const wordChar = (at: string | undefined): boolean => at !== undefined && /[a-z0-9]/i.test(at)

/** The places a clause can start: a cue word, or the space after a full stop. */
const cutsIn = (utterance: string): ReadonlyArray<number> => {
  const lower = utterance.toLowerCase()
  const cuts = new Set<number>()
  for (const cue of CUES) {
    let at = lower.indexOf(cue)
    while (at !== -1) {
      const before = lower[at - 1]
      const after = lower[at + cue.length]
      if (at > 0 && !wordChar(before) && !wordChar(after)) cuts.add(at)
      at = lower.indexOf(cue, at + cue.length)
    }
  }
  for (let at = 1; at < utterance.length; at += 1) {
    if (/[.!?]/.test(utterance[at - 1] ?? '') && /\s/.test(utterance[at] ?? '')) cuts.add(at)
  }
  return [...cuts].toSorted((a, b) => a - b)
}

/**
 * One utterance as the clauses it holds, with the span each occupies so the bar
 * can turn a clause black once its move has landed. A cue word stays at the
 * start of its clause: "then" is how the order is known.
 */
export const clauses = (utterance: string): ReadonlyArray<Clause> => {
  const bounds = [0, ...cutsIn(utterance), utterance.length]
  const spans: Array<Clause> = []
  for (let index = 0; index < bounds.length - 1; index += 1) {
    const low = bounds[index] ?? 0
    const high = bounds[index + 1] ?? utterance.length
    let start = low
    while (start < high && /[\s,;]/.test(utterance[start] ?? '')) start += 1
    let end = high
    while (end > start && /[\s,;.!?]/.test(utterance[end - 1] ?? '')) end -= 1
    if (end - start < 2) continue
    spans.push({ text: utterance.slice(start, end), start, end })
  }
  return spans
}

/** The free corner a Component buys, below the Design, keeping clear of every card. */
export const spotFor = (
  game: Game,
  region: Region,
  type: ComponentId,
): Readonly<{ x: number; y: number }> => {
  const boxes = regionView(game, region).nodes.map(boxOf)
  // Beside the Design rather than under it: the action bar owns the bottom of the screen.
  const top = boxes.length > 0 ? Math.min(...boxes.map((box) => box.y)) : 0
  const right = boxes.length > 0 ? Math.max(...boxes.map((box) => box.x + box.w)) : 0
  return freeSpot(boxes, { x: right + CLEARANCE, y: top, w: CARD_W, h: heightOf(type) })
}

const sizeOf = (node: GameNode): string =>
  COMPONENTS[node.type].sized
    ? (SIZES[node.size]?.name ?? `size ${node.size}`)
    : `step ${node.size}`

const nodeLine = (
  game: Game,
  load: Readonly<Record<string, Readonly<{ utilization: number; status: string }>>>,
  node: GameNode,
  just: string | null,
): string => {
  const ledger = load[node.id]
  const mark = node.id === just ? ' (just created)' : ''
  return `${node.id} ${nodeLabel(game, node)}${mark}: ${COMPONENTS[node.type].name}, ${sizeOf(node)}, ${Math.round((ledger?.utilization ?? 0) * 100)}% load, ${ledger?.status ?? 'ok'}, ${REGION_INFO[node.region].name}`
}

/** The Board in words, small enough for the model's context, complete enough to point at a Node. */
export const stateOf = (
  game: Game,
  region: Region,
  clause: string,
  just: string | null,
): string => {
  const ledger = solveFlow(game)
  const studies = game.studies.map((study) => RESEARCH[study.id]?.name ?? study.id)
  return [
    `Era: ${ERAS[game.stage]?.name ?? 'Garage'}. Cash: $${Math.round(game.cash)}. Apdex: ${game.apdex.toFixed(2)}. Users: ${Math.round(game.users)}.`,
    `Board region: ${REGION_INFO[region].name}.`,
    'Nodes:',
    ...(game.nodes.length === 0
      ? ['(none)']
      : game.nodes.map((node) => `- ${nodeLine(game, ledger.nodes, node, just)}`)),
    `Links: ${game.links.length === 0 ? 'none' : game.links.map((link) => `${link.from} -> ${link.to}`).join(', ')}`,
    `Study queue: ${studies.length === 0 ? 'empty' : studies.join(', ')}`,
    `Player said: "${clause}"`,
  ].join('\n')
}

const choice = (instructions: string, criteria: Record<string, string>): IntentQuestion => ({
  type: 'choice',
  instructions,
  criteria,
})

const nodeCriteria = (
  game: Game,
  load: Readonly<Record<string, Readonly<{ utilization: number; status: string }>>>,
  just: string | null,
): Record<string, string> =>
  Object.fromEntries(game.nodes.map((node) => [node.id, nodeLine(game, load, node, just)]))

const componentCriteria = (game: Game, region: Region): Record<string, string> => {
  const criteria: Record<string, string> = {}
  for (const type of COMPONENT_IDS) {
    if (COMPONENTS[type].fixed) continue
    // The Component is offered only if the Game would take it now: Cash, Era, and Research.
    if (!Result.isSuccess(place(game, type, 0, 0, region))) continue
    const def = COMPONENTS[type]
    criteria[type] = `${def.name}: ${def.blurb} Cost $${Math.round(def.cost)}.`
  }
  return criteria
}

const words = (text: string): ReadonlyArray<string> =>
  (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) => word.length > 2)

/**
 * The Research a clause can mean. A clause that names one narrows the list to
 * the items it named plus a few near neighbours: 200 options spread the answer
 * too thin, and the one named item wins a list that holds it and little else.
 * A clause that names none gets what the Company can study now.
 */
const researchCriteria = (game: Game, clause: string): Record<string, string> => {
  const owned = new Set(game.researched)
  const open = RESEARCH_IDS.filter((id) => !owned.has(id))
  const said = new Set(words(clause))
  const named = open.filter((id) =>
    words(`${id} ${RESEARCH[id].name}`).some((word) => said.has(word)),
  )
  const ready = open.filter((id) => researchReady(game, id))
  const later = open.filter((id) => !researchReady(game, id))
  const pick =
    named.length > 0
      ? [...named, ...ready.filter((id) => !named.includes(id)).slice(0, 4)]
      : [...ready, ...later].slice(0, 40)
  const criteria: Record<string, string> = {}
  for (const id of pick) {
    const def = RESEARCH[id]
    criteria[id] = `${def.name}: ${def.blurb} ${def.cost} Insight.`
  }
  return criteria
}

const PANELS: ReadonlyArray<Readonly<{ id: PanelId; what: string }>> = [
  { id: 'research', what: 'The Research tree and the Study queue' },
  { id: 'team', what: 'Engineers, work, and migrations' },
  { id: 'dashboard', what: 'Charts of Users, latency, and Apdex, and the alert rules' },
  { id: 'inbox', what: 'Mail' },
  { id: 'churn', what: 'What takes Apdex, by Request kind and cause' },
  { id: 'cost', what: 'What the Design costs to run' },
  { id: 'vitals', what: 'The health of the running Company' },
  { id: 'help', what: 'How to play' },
  { id: 'menu', what: 'The game menu' },
  { id: 'settings', what: 'Sound, language, and display settings' },
]

const steps = (game: Game, node: GameNode): boolean =>
  Result.isSuccess(resize(game, node.id, 1)) || Result.isSuccess(resize(game, node.id, -1))

/**
 * Why a move the player named cannot happen, when the Simulation says so. A
 * clause that names a Component the Game will not take ("buy a cache" before
 * its Research) answers with that reason, not with a shrug.
 */
export const blockedOf = (game: Game, region: Region, clause: string): Refusal | null => {
  // Names with spaces, and punctuation in the sentence, both fall away here.
  const said = ` ${clause.toLowerCase().replace(/[^a-z]+/g, ' ')} `
  for (const type of COMPONENT_IDS) {
    const def = COMPONENTS[type]
    if (def.fixed) continue
    const name = def.name.toLowerCase()
    if (!said.includes(` ${name} `) && !said.includes(` ${name}s `)) continue
    const placed = place(game, type, 0, 0, region)
    if (Result.isSuccess(placed)) continue
    return Result.match(placed, { onSuccess: () => null, onFailure: (refusal) => refusal })
  }
  return null
}

export type MoveInput = Readonly<{
  game: Game
  region: Region
  clause: string
  /** The Node the clause before this one placed, so "that" has something to point at. */
  just: string | null
}>

/**
 * One clause as a request. Every option is checked against the Game first, so
 * an answer is a legal move by construction. A question is only sent when it
 * has at least two options, and the model is always offered `nothing`.
 */
export const moveRequest = (input: MoveInput): IntentRequest => {
  const { game, region, clause, just } = input
  const ledger = solveFlow(game)
  const components = componentCriteria(game, region)
  const research = researchCriteria(game, clause)
  const nodes = nodeCriteria(game, ledger.nodes, just)

  const verbs: Record<string, string> = {
    nothing: 'No clear move in what the player said',
  }
  if (Object.keys(components).length >= 2)
    verbs.place =
      'Buy a Component such as a Cache, a Queue, a Database, or an App Server, and put a copy on the Board'
  if (game.nodes.length >= 2) verbs.connect = 'Draw a Link from one Node to another'
  if (game.nodes.some((node) => steps(game, node)))
    verbs.resize = 'Upsize or downsize one Node: make it bigger, give it more room, scale it'
  if (Object.keys(research).length >= 2) {
    verbs.study =
      'Get a Research item by name, such as Stripe or Caching, and queue it to Study. This opens Research on it too'
    verbs.research = 'Open the Research panel and read it, without buying anything'
  }
  if (game.nodes.length >= 2) verbs.node = 'Open one Node and show its Inspector'
  verbs.panel = 'Open a panel, such as Research, Team, or the Dashboard'
  if (game.nodes.length > 0) {
    verbs.setting =
      'Change a setting on one Node: its TTL, size family, runtime, engine, zone, standby, backups, or any other option'
    verbs.command =
      'Do something to one Node: restart it, sell it, drain it, fail it over, replace it, promote it'
  }
  verbs.board =
    'Act on the whole Company: open a region, fail a zone or region over, raise or decline a round, acknowledge the incident'

  const questions: Record<string, IntentQuestion> = {
    verb: choice('Which single move does the player want?', verbs),
  }
  if (Object.keys(components).length >= 2)
    questions.component = choice(
      'Which Component does the player want to buy and place?',
      components,
    )
  if (game.nodes.length >= 2) {
    questions.node = choice('Which Node is the player talking about?', nodes)
    questions.from = choice(
      'Which Node does a Link start at? "That" or "it" is the Node marked just created.',
      nodes,
    )
    questions.to = choice('Which Node does a Link go to?', nodes)
  }
  if (Object.keys(research).length >= 2) {
    questions.research = choice('Which Research item does the player mean?', research)
  }
  const settings: Record<string, string> = {}
  const commands: Record<string, string> = {}
  for (const node of game.nodes) {
    for (const option of optionsFor(game, node)) {
      for (const each of option.values(game, node)) {
        settings[`${option.id}|${each.id}`] = `${option.label}: ${each.label}`
      }
    }
    for (const command of commandsFor(node)) commands[command.id] = command.label
  }
  if (Object.keys(settings).length >= 2)
    questions.setting = choice(
      'Which Node setting, and which value for it, does the player want?',
      settings,
    )
  if (Object.keys(commands).length >= 2)
    questions.command = choice('Which command on the Node does the player want?', commands)
  questions.board = choice(
    'Which Company-wide action does the player want?',
    Object.fromEntries(BOARD_MOVES.map((move) => [move.id, move.label])),
  )

  questions.direction = choice('Does the player want one size bigger or smaller?', {
    up: 'Bigger: upsize, scale up, grow, more room. The Node is slow, hot, or bottlenecked',
    down: 'Smaller: downsize, shrink, save money, go back one size',
  })
  questions.panel = choice(
    'Which panel does the player want to open?',
    Object.fromEntries(PANELS.map((panel) => [panel.id, panel.what])),
  )

  return { state: stateOf(game, region, clause, just), questions }
}

/**
 * Whether the verb answer is a decision rather than a coin flip: a real lead
 * over the next option. Options differ in count, so a fixed floor says little.
 */
const decisive = (answer: IntentChoice): boolean => {
  const ranked = Object.values(answer.probabilities).toSorted((a, b) => b - a)
  const [first, second] = ranked
  if (first === undefined) return false
  return first >= 0.4 && first - (second ?? 0) >= 0.15
}

const top = (answer: IntentChoice | undefined): Readonly<{ id: string; p: number }> | null => {
  if (answer === undefined) return null
  const ranked = Object.entries(answer.probabilities).toSorted(([, a], [, b]) => b - a)
  const best = ranked[0]
  return best === undefined ? null : { id: best[0], p: best[1] }
}

/**
 * The best option, skipping `avoid`: a Link cannot start and end at the same
 * Node. The probability is renormalized over the options that remain, because
 * dropping an impossible option leaves a smaller choice than the model saw.
 */
const topOf = (
  answer: IntentChoice | undefined,
  avoid: string | null = null,
): Readonly<{ id: string; p: number }> | null => {
  if (answer === undefined) return null
  const ranked = Object.entries(answer.probabilities)
    .filter(([id]) => id !== avoid)
    .toSorted(([, a], [, b]) => b - a)
  const best = ranked[0]
  if (best === undefined) return null
  const total = ranked.reduce((sum, [, p]) => sum + p, 0)
  return { id: best[0], p: total > 0 ? best[1] / total : 0 }
}

const floorOf = (answer: IntentChoice): number =>
  Object.keys(answer.probabilities).length <= 4 ? 0.6 : 0.4

const sure = (answer: IntentChoice | undefined, pick: Readonly<{ p: number }> | null): boolean =>
  answer !== undefined && pick !== null && pick.p >= floorOf(answer)

/**
 * The answers as one Move. Ties are repaired against the Game (a Link into
 * itself becomes the next best end), and anything the answers were not sure
 * enough about resolves to Nothing, so a held clause is never applied.
 */
/** The question the player is being asked to settle, and the option they chose. */
export type Forced = Readonly<{ question: string; id: string }>

export const resolve = (game: Game, answers: IntentAnswers, forced?: Forced): Resolved => {
  const verb = answers.verb
  if (verb === undefined || verb.choice === 'nothing') return NOTHING
  const ranked = Object.entries(verb.probabilities).toSorted(([, a], [, b]) => b - a)
  const [first, second] = ranked
  // "Look at Research, then get Stripe" is both: queuing the item opens Research on it too, so a
  // tie between them resolves to the move that covers both readings.
  const tie =
    first !== undefined &&
    second !== undefined &&
    ((first[0] === 'research' && second[0] === 'study') ||
      (first[0] === 'study' && second[0] === 'research')) &&
    first[1] - second[1] < 0.12
  const choice = tie ? 'study' : verb.choice

  /** A forced choice wins over the probabilities, so a chip can settle an ambiguous question. */
  const forcedPick = (question: string, answer: IntentChoice | undefined) =>
    forced?.question === question && answer !== undefined
      ? { id: forced.id, p: answer.probabilities[forced.id] ?? 0 }
      : top(answer)

  const forcedTop = (
    question: string,
    answer: IntentChoice | undefined,
    avoid: string | null = null,
  ) =>
    forced?.question === question && answer !== undefined
      ? { id: forced.id, p: 1 }
      : topOf(answer, avoid)

  const sureOf = (
    question: string,
    answer: IntentChoice | undefined,
    pick: Readonly<{ p: number }> | null,
  ): boolean => (forced?.question === question ? pick !== null : sure(answer, pick))

  /** A Node setting, when the Node, the option, and its value are all sure. */
  const settingMove = (): Resolved | null => {
    const node = forcedPick('node', answers.node)
    if (node === null || !sureOf('node', answers.node, node)) return null
    const entry = game.nodes.find((candidate) => candidate.id === node.id)
    if (!entry) return null
    const pick = forcedTop('setting', answers.setting)
    if (pick === null || !sureOf('setting', answers.setting, pick)) return null
    const [optionId, valueId] = pick.id.split('|')
    const option = optionsFor(game, entry).find((each) => each.id === optionId)
    const chosen = option?.values(game, entry).find((each) => each.id === valueId)
    if (option === undefined || chosen === undefined) return null
    const head = option.label.split(':')[0] ?? option.label
    return {
      move: { _tag: 'Setting', message: chosen.message(entry.id), focus: entry.id },
      label: `${head}: ${chosen.label} on ${nodeLabel(game, entry)}`,
      confident: true,
    }
  }

  /** A Node command, when the Node and the command are both sure. */
  const commandMove = (): Resolved | null => {
    const node = forcedPick('node', answers.node)
    if (node === null || !sureOf('node', answers.node, node)) return null
    const entry = game.nodes.find((candidate) => candidate.id === node.id)
    if (!entry) return null
    const pick = forcedTop('command', answers.command)
    if (pick === null || !sureOf('command', answers.command, pick)) return null
    const command = commandsFor(entry).find((each) => each.id === pick.id)
    if (command === undefined) return null
    return {
      move: { _tag: 'Setting', message: command.message(entry.id), focus: entry.id },
      label: `${command.label} (${nodeLabel(game, entry)})`,
      confident: true,
    }
  }

  /** A Company-wide action. */
  const boardMove = (): Resolved | null => {
    const pick = forcedTop('board', answers.board)
    if (pick === null || !sureOf('board', answers.board, pick)) return null
    const move = BOARD_MOVES.find((each) => each.id === pick.id)
    if (move === undefined) return null
    return {
      move: { _tag: 'Setting', message: move.message, focus: null },
      label: move.label,
      confident: true,
    }
  }

  if (choice === 'setting') return settingMove() ?? NOTHING
  if (choice === 'command') return commandMove() ?? NOTHING
  if (choice === 'board') return boardMove() ?? NOTHING
  if (!decisive(verb) && !tie) {
    // The verb split across the three wide branches. Each branch names what it needs, so the one
    // whose own answer is surest is the reading: "open Europe" beats a Node command every time.
    const decided: Array<Readonly<{ resolved: Resolved; p: number }>> = []
    const setting = settingMove()
    if (setting !== null)
      decided.push({ resolved: setting, p: forcedPick('setting', answers.setting)?.p ?? 0 })
    const command = commandMove()
    if (command !== null)
      decided.push({ resolved: command, p: forcedPick('command', answers.command)?.p ?? 0 })
    const board = boardMove()
    if (board !== null)
      decided.push({ resolved: board, p: forcedPick('board', answers.board)?.p ?? 0 })
    decided.sort((a, b) => b.p - a.p)
    const best = decided[0]
    return best === undefined ? NOTHING : best.resolved
  }

  switch (choice) {
    case 'place': {
      const answer = answers.component
      const pick = top(answer)
      if (!sure(answer, pick) || pick === null) return NOTHING
      if (!Schema.is(ComponentIdSchema)(pick.id)) return NOTHING
      return {
        move: { _tag: 'Place', type: pick.id },
        label: `Place ${COMPONENTS[pick.id].name}`,
        confident: true,
      }
    }
    case 'connect': {
      const from = forcedTop('from', answers.from)
      if (from === null || !sureOf('from', answers.from, from)) return NOTHING
      const to = forcedTop('to', answers.to, from.id)
      if (to === null || !sureOf('to', answers.to, to)) return NOTHING
      // A Link carries traffic one way, and a spoken one names both ends without a direction:
      // the Game decides which end calls the other.
      const forward = Result.isSuccess(connect(game, from.id, to.id))
      const backward = !forward && Result.isSuccess(connect(game, to.id, from.id))
      if (!forward && !backward) return NOTHING
      const start = game.nodes.find((node) => node.id === (backward ? to.id : from.id))
      const end = game.nodes.find((node) => node.id === (backward ? from.id : to.id))
      if (!start || !end) return NOTHING
      return {
        move: { _tag: 'Connect', from: start.id, to: end.id },
        label: `Connect ${nodeLabel(game, start)} to ${nodeLabel(game, end)}`,
        confident: true,
      }
    }
    case 'resize': {
      const node = forcedPick('node', answers.node)
      if (node === null || !sureOf('node', answers.node, node)) return NOTHING
      const entry = game.nodes.find((candidate) => candidate.id === node.id)
      if (!entry) return NOTHING
      const wanted: 1 | -1 = answers.direction?.choice === 'down' ? -1 : 1
      const other: 1 | -1 = wanted === 1 ? -1 : 1
      // A size the Company cannot pay for is still the size the player asked for: keep the
      // direction, and let the board say why it did not happen. Only a size the Node cannot take
      // turns the answer around.
      const direction: 1 | -1 | null = Result.match(resize(game, entry.id, wanted), {
        onSuccess: () => wanted,
        onFailure: (refusal) =>
          // Out of Cash refuses every size the same way: the direction is not the problem.
          refusal._tag === 'Unaffordable' || shortOfCash(game)
            ? wanted
            : Result.isSuccess(resize(game, entry.id, other))
              ? other
              : null,
      })
      if (direction === null) return NOTHING
      return {
        move: { _tag: 'Resize', nodeId: entry.id, direction },
        label: `${direction === 1 ? 'Upsize' : 'Downsize'} ${nodeLabel(game, entry)}`,
        confident: true,
      }
    }
    case 'study':
    case 'research': {
      const pick = forcedPick('research', answers.research)
      if (pick === null || !sureOf('research', answers.research, pick)) return NOTHING
      if (!Schema.is(ResearchIdSchema)(pick.id)) return NOTHING
      const name = RESEARCH[pick.id].name
      return verb.choice === 'study'
        ? { move: { _tag: 'Study', id: pick.id }, label: `Study ${name}`, confident: true }
        : {
            move: { _tag: 'Research', id: pick.id },
            label: `Open Research: ${name}`,
            confident: true,
          }
    }
    case 'node': {
      const pick = forcedPick('node', answers.node)
      if (pick === null || !sureOf('node', answers.node, pick)) return NOTHING
      const entry = game.nodes.find((node) => node.id === pick.id)
      if (!entry) return NOTHING
      return {
        move: { _tag: 'Node', nodeId: entry.id },
        label: `Show ${nodeLabel(game, entry)}`,
        confident: true,
      }
    }
    case 'panel': {
      const pick = forcedPick('panel', answers.panel)
      if (pick === null || !sureOf('panel', answers.panel, pick)) return NOTHING
      if (!isPanel(pick.id)) return NOTHING
      const panel: Panel = pick.id
      return { move: { _tag: 'Panel', panel }, label: `Open ${panel}`, confident: true }
    }
    default:
      return NOTHING
  }
}

export type Candidate = Readonly<{ resolved: Resolved; question: string; id: string }>

/**
 * The readings to offer when an answer was not sure enough: force each likely option of the
 * question that failed and keep the ones that resolve into a move. The bar shows their labels,
 * so "which database" becomes a choice instead of a refusal.
 */
export const candidates = (game: Game, answers: IntentAnswers): ReadonlyArray<Candidate> => {
  const questions = [
    'setting',
    'command',
    'board',
    'node',
    'component',
    'from',
    'to',
    'research',
    'panel',
  ]
  for (const question of questions) {
    const answer = answers[question]
    if (answer === undefined) continue
    const best = top(answer)
    if (best === null || sure(answer, best)) continue
    // Only readings worth showing: the top one, and the ones close enough to be a real choice.
    const ranked = Object.entries(answer.probabilities)
      .toSorted(([, a], [, b]) => b - a)
      .slice(0, 3)
    const floor = Math.max(0.15, (ranked[0]?.[1] ?? 0) * 0.5)
    const offered: Array<Candidate> = []
    const labels = new Set<string>()
    for (const [id, p] of ranked) {
      if (p < floor) continue
      const resolved = resolve(game, answers, { question, id })
      if (!resolved.confident || labels.has(resolved.label)) continue
      labels.add(resolved.label)
      offered.push({ resolved, question, id })
    }
    if (offered.length > 1) return offered
  }
  return []
}
