import { canRaise } from '@quorum/simulation/actions'
import { senderOf } from './mail.ts'
import type { Message } from './message.ts'
import { clockPaused, placingOf, boardSandbox, type Model, type Tone } from './model.ts'
import { onBoard } from './route.ts'
import type { Sound } from './sound.ts'

export type Cue = Readonly<{ sound: Sound; pitch: number; spatial: boolean }>

const TONE_SOUND: Record<Tone, Sound> = {
  plain: 'notify',
  primary: 'notify',
  ok: 'success',
  warn: 'warn',
  danger: 'error',
}

const SPEED_PITCH: Record<number, number> = { 1: 1, 2: 1.5, 4: 2.25 }

export const BIG_PURCHASE_CASH = 1_000

const gesture = (sound: Sound, pitch = 1): Cue => ({ sound, pitch, spatial: true })
const event = (sound: Sound): Cue => ({ sound, pitch: 1, spatial: false })

const gestureCue = (before: Model, message: Message, after: Model): Cue | null => {
  const game = before.board.game
  const next = after.board.game
  switch (message._tag) {
    case 'PanelOpened':
      if (after.panel === before.panel) return null
      if (after.panel === 'none') return gesture('close')
      return before.panel === 'none' ? gesture('open') : gesture('switch')
    case 'PanelClosed':
    case 'TitleOpened':
    case 'RoundDeclined':
      return gesture('close')
    case 'BuildGroupChosen':
      if (after.board.buildGroup === null) return gesture('close')
      return before.board.buildGroup === null ? gesture('open') : gesture('switch')
    case 'PlacingChosen':
      return placingOf(after) ? gesture('pick') : gesture('close')
    case 'NodePlaced':
      return next.nodes.length > game.nodes.length ? gesture('place') : null
    case 'NodeTapped':
      return after.board.selected !== before.board.selected ? gesture('tick') : null
    case 'EmptyTapped':
      return after.board.selected !== before.board.selected ? gesture('tick', 0.8) : null
    case 'NodeMoved':
      return gesture('drop')
    case 'LinkRequested':
      return next.links.length > game.links.length ? gesture('connect') : null
    case 'LinkCut':
      return gesture('cut')
    case 'NodeSold':
    case 'SellConfirmed':
      return gesture('remove')
    case 'ResizeChosen':
      if (message.direction < 0) return gesture('downgrade')
      return game.cash - next.cash >= BIG_PURCHASE_CASH ? event('purchase') : gesture('upgrade')
    case 'FamilyChosen':
    case 'PricingChosen':
    case 'RuntimeChosen':
    case 'FrameworkChosen':
    case 'WorkersChosen':
    case 'SampleChosen':
    case 'MixChosen':
    case 'FullscreenToggled':
      return gesture('toggle')
    case 'PoolSliderChanged':
      return null
    case 'VolumeSliderChanged':
      return message.message._tag === 'MovedDragPointer' ? null : gesture('tick')
    case 'DemandStepped':
      return gesture('tick', message.direction > 0 ? 1.25 : 0.8)
    case 'ReplaceBought':
    case 'RestartChosen':
    case 'FailedOver':
    case 'ZoneFailedOver':
    case 'RegionFailedOver':
      return gesture('reboot')
    case 'IndexAdded':
      return gesture('success')
    case 'Collected':
    case 'CheatCash':
    case 'CheatInsight':
      return gesture('coin')
    case 'UndoChosen':
      return next !== game ? gesture('undo') : null
    case 'ResearchChanged':
      return message.message._tag === 'Bought'
        ? gesture('unlock')
        : after.board.research.focus !== before.board.research.focus
          ? gesture('tick')
          : null
    case 'RoundRaised':
      return gesture('fanfare')
    case 'PostmortemFiled':
      return message.take ? gesture('unlock') : gesture('close')
    case 'PauseToggled':
      return after.prefs.easyMode ? gesture('toggle', clockPaused(after) ? 0.8 : 1.15) : null
    case 'SpeedCycled':
      if (!after.prefs.easyMode) return null
      return gesture('tick', SPEED_PITCH[after.board.clock.speed] ?? 1)
    case 'SpeedChosen':
      return gesture('tick', SPEED_PITCH[after.board.clock.speed] ?? 1)
    case 'KeyPressed':
      return message.key === 'Escape' &&
        (placingOf(after) !== placingOf(before) ||
          after.board.buildGroup !== before.board.buildGroup ||
          after.panel !== before.panel)
        ? gesture('close')
        : null
    case 'BoardFitted':
    case 'BoardTidied':
    case 'FreeSandboxReset':
    case 'StressBoardLoaded':
    case 'CompanyCopied':
      return gesture('switch')
    default:
      return null
  }
}

const tickCue = (before: Model, after: Model): Cue | null => {
  if (after.panel === 'passed' && before.panel !== 'passed') return event('fanfare')
  if (!boardSandbox(before.board) && canRaise(after.board.game) && !canRaise(before.board.game))
    return event('ready')
  const urgent = after.board.inbox.mail.some(
    (mail) =>
      mail.time > (before.board.inbox.mail.find((old) => old.id === mail.id)?.time ?? -Infinity) &&
      !mail.read &&
      !mail.spam &&
      ['cloud', 'monitoring', 'security'].includes(senderOf(mail.sender).kind),
  )
  if (urgent) return event('warn')
  const delta =
    after.board.change._tag === 'Settled' || after.board.change._tag === 'Lasting'
      ? after.board.change.delta
      : null
  const beforeDelta =
    before.board.change._tag === 'Settled' || before.board.change._tag === 'Lasting'
      ? before.board.change.delta
      : null
  if (delta && delta.id !== beforeDelta?.id) return delta.worse ? event('warn') : event('settle')
  return null
}

export const cueOf = (before: Model, message: Message, after: Model): Cue | null => {
  if (!onBoard(before.route)) return null
  const raised = after.toast && after.toast.id !== before.toast?.id ? after.toast : null
  if (raised && (raised.tone === 'warn' || raised.tone === 'danger')) {
    const refused = raised.tone === 'warn' && after.board.game === before.board.game
    return {
      sound: refused ? 'refuse' : TONE_SOUND[raised.tone],
      pitch: 1,
      spatial: message._tag !== 'Ticked',
    }
  }
  const cue =
    message._tag === 'Ticked' ? tickCue(before, after) : gestureCue(before, message, after)
  if (cue) return cue
  return raised ? event(TONE_SOUND[raised.tone]) : null
}
