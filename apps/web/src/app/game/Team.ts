import { Component, Mount } from '@effect/ui'
import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { Effect, Option, Queue, Result, Stream } from 'effect'
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Bot,
  Bug,
  Check,
  ChevronRight,
  Container,
  Database,
  Crown,
  Gem,
  GraduationCap,
  Hourglass,
  Lock,
  Pencil,
  Play,
  Plus,
  Rabbit,
  Rocket,
  Scissors,
  Scale,
  Shield,
  Siren,
  FlaskConical,
  Trash2,
  UserMinus,
  X,
  Zap,
  type IconNode,
} from 'lucide'
import {
  CONTENT_MOOD,
  KINDS,
  REQUEST_KINDS,
  FEATURES,
  FEATURE_IDS,
  LANGUAGES,
  LAYOFF_MORALE,
  LEVER_KINDS,
  POLICY_IDS,
  RESEARCH,
  RUNTIMES,
  TASKS,
  TASK_IDS,
  type ComponentId,
  type FeatureId,
  type FrameworkId,
  type IncidentId,
  type LeverKind,
  type RequestKind,
  type ResearchId,
  type PolicyId,
  type RuntimeId,
  type TaskId,
  PATCH_GRACE,
  POLICY_LEVEL,
} from '@quorum/simulation/catalog'
import { MAX_NAME_CHARS } from '@quorum/simulation/work'
import { perkLevel } from '@quorum/simulation/founding'
import { has, sreStaffed } from '@quorum/simulation/lookups'
import { openRegions } from '@quorum/simulation/regions'
import {
  activeIncident,
  type BlockKind,
  type Engineer,
  type LanguageId,
  type Game,
  type GameNode,
  type Service,
  type Team,
  type TeamKind,
  type WorkItem,
  type WorkKind,
} from '@quorum/simulation/state'
import {
  daysUntil,
  deployEvery,
  devHoursRate,
  doraMetrics,
  languagesInUse,
  learnTargetOf,
  membersOf,
  nextBadDeployChance,
  offsiteCost,
  ownerOf,
  payrollOf,
  policyNow,
  rampSeconds,
  pipelineOf,
  salaryOf,
  serviceBurnOf,
  serviceOf,
  serviceOfKind,
  stackOf,
  sharesDatabase,
  signingOf,
  teamOutputs,
  trainCost,
  trainSeconds,
  trainingOf,
  unhappy,
  upkeepShare,
} from '@quorum/simulation/team'
import { overdueBy } from '@quorum/simulation/cve'
import { boostRateOf } from '@quorum/simulation/studies'
import { currentStudy } from '@quorum/simulation/study-machine'
import type { Ledger } from '@quorum/simulation/ledger'
import {
  canBoost,
  teamBoosting,
  teamHasEngineers,
  teamReady,
} from '@quorum/simulation/research-team'
import { speedFactorOf } from '../../game/research.ts'
import {
  adoptionShareOf,
  awaitingFeatures,
  isBuilt,
  isFeatureLive,
  liftReading,
  liveFeatures,
  mixOf,
} from '@quorum/simulation/features'
import { isReady, stepsOf, stepOf } from '@quorum/simulation/migration'
import {
  PLATFORM_STAGE,
  assignments,
  setTeamKind,
  loadBalancersOf,
  nodesOfService,
  worksOn,
} from '@quorum/simulation/work'
import {
  featureHoursOf,
  featureRefusal,
  MAX_TEAMS,
  removeRefusal,
  runbookKinds,
  runbookRefusal,
  rushBugOf,
  rushDebtOf,
  splitCost,
  splitRefusal,
  capabilityKloc,
  type SplitRequest,
  taskRefusal,
} from '@quorum/simulation/work'
import { Refusal } from '@quorum/simulation/actions'
import { refusalIn } from '../../i18n/refusal.ts'
import { money, sharePercent } from '@quorum/ui/game/format'
import { STACK_LOGOS } from '@quorum/ui/game/icons'
import { Message } from '../../game/message.ts'
import { ledgerOf, type Model, type ServiceDraft } from '../../game/model.ts'
import { identityOf } from '../../game/mail.ts'
import { glowing, shown } from '../../game/reveal.ts'
import { copy, localized, nodeTitle, type Messages } from '../../i18n/messages.ts'
import { TeamMessage } from '../../game/team.ts'
import { badge } from '../ui/badge.ts'
import { buttonClass, type ButtonSize, type ButtonVariant } from '../ui/button-styles.ts'
import { icon } from '../ui/icon.ts'
import {
  EYEBROW,
  FIGURE,
  FLOAT,
  PANEL,
  SCROLL,
  EYEBROW_STYLE,
  PANEL_STYLE,
  WELL,
  WELL_STYLE,
} from '@quorum/ui/game/bits'

/* The view content and children these helpers pass around. */
type Content = View.Content<Message>
type Child = View.Input<Message>
type Label = View.Content<Message> | string | false | null | undefined

/* A class map keeps a token repeated across a base class and a
   caller's class appeared once; join the same way here. */
const joinedClasses = (...tokens: ReadonlyArray<string | undefined>): string =>
  [
    ...new Set(
      cx(...tokens)
        .split(' ')
        .filter((token) => token !== ''),
    ),
  ].join(' ')

/* The button `@quorum/ui/primitives/button` drew, hand-written for Effect UI
   the same way Hud.ts writes it. */
const button = (
  h: H<Message>,
  config: Readonly<{
    onClick?: Message
    isDisabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    variant?: ButtonVariant
    size?: ButtonSize
    className?: string
    key?: string
    attributes?: Readonly<Record<string, string | undefined>>
  }>,
  label: Label | ReadonlyArray<Label>,
): Content => {
  const root = config.key === undefined ? h.button : h.button.key(config.key)
  const base = root
    .attr('type', config.type ?? 'button')
    .attr('tabindex', '0')
    .attr('aria-disabled', config.isDisabled ? 'true' : undefined)
    .attr('data-disabled', config.isDisabled ? '' : undefined)
    .class(joinedClasses(buttonClass(config.variant, config.size), config.className))
    .attr('data-slot', 'button')
    .attrs(config.attributes ?? {})
  const clickable =
    config.onClick !== undefined && config.isDisabled !== true
      ? base.on('click', () => config.onClick)
      : base
  const inputs: ReadonlyArray<View.Input<Message>> = Array.isArray(label) ? label : [label]
  return clickable.children(...inputs)
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/* The panel's focus trap. */
const PanelFocus = Mount.make('PanelFocus', {}, (element: HTMLElement) =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          const before =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
          element.focus()
          const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return
            const items = [...element.querySelectorAll<HTMLElement>(FOCUSABLE)]
            const first = items[0]
            const last = items[items.length - 1]
            if (first === undefined || last === undefined) return
            if (
              event.shiftKey &&
              (document.activeElement === first || document.activeElement === element)
            ) {
              event.preventDefault()
              last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first.focus()
            }
          }
          element.addEventListener('keydown', onKeyDown)
          return () => {
            element.removeEventListener('keydown', onKeyDown)
            if (
              element.contains(document.activeElement) ||
              document.activeElement === document.body
            )
              before?.focus()
          }
        }),
        (cleanup) => Effect.sync(cleanup),
      )
      return yield* Effect.never
    }),
  ).pipe(Effect.as(Component.noop)),
)

const OVERLAY = cx(
  'modal-overlay',
  css({
    position: 'absolute',
    inset: '0',
    zIndex: '30',
    display: 'grid',
    placeItems: 'center',
    padding: '6',
    _compact: { padding: '0' },
    _short: {
      '[data-toast="on"] &': { paddingTop: '3rem !important' },
    },
  }),
)

const DIALOG = css({
  display: 'flex',
  maxHeight: '100%',
  width: '100%',
  flexDirection: 'column',
  overflow: 'hidden',
  outlineStyle: 'none',
  _compact: {
    height: '100%',
    maxHeight: 'none',
    maxWidth: 'none',
    borderRadius: '0',
    paddingBottom: 'env(safe-area-inset-bottom)',
    boxShadow: 'none',
  },
})

const SHELL_HEAD = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '4',
  paddingInline: '5',
  paddingTop: '4',
  paddingBottom: '3',
  _compact: {
    paddingInline: '4',
    paddingTop: 'max(12px,env(safe-area-inset-top))',
  },
})

const SHELL_TITLE = css({
  fontSize: 'type.17',
  fontWeight: 'semibold',
  letterSpacing: 'tight',
})

const SHELL_TOOLS = css({ display: 'flex', alignItems: 'center', gap: '3' })

const SHELL_CLOSE = css({
  color: 'mutedForeground',
  _compact: {
    width: '11',
    height: '11',
  },
})

/* The panel frame `components/lab/panels.ts` drew, hand-written for Effect UI. */
const shell = (
  h: H<Message>,
  t: Messages,
  title: string,
  right: ReadonlyArray<Child>,
  body: ReadonlyArray<Child>,
  width: string,
): Content =>
  h.div
    .attr('data-exit', 'gesture')
    .class(OVERLAY)
    .children(
      h.div
        .key(title)
        .attr('role', 'dialog')
        .attr('aria-modal', 'true')
        .attr('aria-label', title)
        .attr('tabindex', '-1')
        .onMount(PanelFocus({}))
        .class(cx(DIALOG, width, FLOAT, 'enter-modal'))
        .children(
          h.div.class(SHELL_HEAD).children(
            h.span.class(SHELL_TITLE).children(title),
            h.div.class(SHELL_TOOLS).children(
              ...right,
              h.button
                .attr('type', 'button')
                .attr('tabindex', '0')
                .class(buttonClass('ghost', 'icon', SHELL_CLOSE))
                .attr('data-slot', 'button')
                .attr('aria-label', t.panels.closeEsc)
                .on('click', () => Message.PanelClosed())
                .children(icon(h, X, css({ width: '4', height: '4' }))),
            ),
          ),
          ...body,
        ),
    )

/* The progress ring `@quorum/ui/game/bits` drew, hand-written for Effect UI. */
const ring = (h: H<Message>, share: number, className: string): Content => {
  const radius = 6
  const length = 2 * Math.PI * radius
  return h.svg
    .attr('aria-hidden', 'true')
    .class(className)
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('viewBox', '0 0 16 16')
    .attr('fill', 'none')
    .children(
      h.circle
        .attr('cx', '8')
        .attr('cy', '8')
        .attr('r', String(radius))
        .attr('stroke', 'currentColor')
        .attr('stroke-width', '2')
        .attr('opacity', '0.2')
        .children(),
      h.circle
        .attr('cx', '8')
        .attr('cy', '8')
        .attr('r', String(radius))
        .attr('stroke', 'currentColor')
        .attr('stroke-width', '2')
        .attr('stroke-linecap', 'round')
        .attr('stroke-dasharray', `${length}`)
        .attr('stroke-dashoffset', `${length * (1 - Math.max(0, Math.min(1, share)))}`)
        .attr('transform', 'rotate(-90 8 8)')
        .class(
          css({
            transitionProperty: 'stroke-dashoffset',
            transitionDuration: 'normal',
            transitionTimingFunction: 'out',
          }),
        )
        .children(),
    )
}

/* The stack logo `@quorum/ui/game/bits` drew, hand-written for Effect UI. */
const stackLogo = (h: H<Message>, id: LanguageId, className: string): Content => {
  const logo = STACK_LOGOS[id]
  return h.svg
    .attr('aria-hidden', 'true')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('viewBox', '0 0 24 24')
    .class(
      cx(
        css({
          flexShrink: '0',
        }),
        logo.color
          ? ''
          : css({
              color: 'foreground',
            }),
        className,
      ),
    )
    .children(
      h.path
        .attr('d', logo.path)
        .attr('fill', logo.color ?? 'currentColor')
        .children(),
    )
}

/* The team's drag-and-drop state and messages. */
type DragModel = Model['board']['team']['drag']
type DragMessage = Parameters<typeof TeamMessage.DragChanged>[0]['message']

const dragChanged = (message: DragMessage): Message =>
  Message.TeamChanged({ message: TeamMessage.DragChanged({ message }) })

const dragIsActive = (drag: DragModel): boolean =>
  drag.dragState._tag === 'Dragging' || drag.dragState._tag === 'KeyboardDragging'

const dragItemId = (drag: DragModel): Option.Option<string> => {
  const state = drag.dragState
  switch (state._tag) {
    case 'Pending':
    case 'Dragging':
    case 'KeyboardDragging':
      return Option.some(state.itemId)
    default:
      return Option.none()
  }
}

const dragDropTarget = (
  drag: DragModel,
): Option.Option<Readonly<{ containerId: string; index: number }>> => {
  const state = drag.dragState
  switch (state._tag) {
    case 'Dragging':
      return state.maybeDropTarget
    case 'KeyboardDragging':
      return Option.some({ containerId: state.targetContainerId, index: state.targetIndex })
    default:
      return Option.none()
  }
}

const dragGhostStyle = (drag: DragModel): Option.Option<Readonly<Record<string, string>>> => {
  const state = drag.dragState
  return state._tag === 'Dragging'
    ? Option.some({
        position: 'fixed',
        top: '0',
        left: '0',
        transform: `translate3d(${state.current.clientX}px, ${state.current.clientY}px, 0)`,
        'pointer-events': 'none',
        'z-index': '9999',
      })
    : Option.none()
}

const DRAG_BUTTON_LEFT = 0

const dropTargetAt = (
  clientX: number,
  clientY: number,
): Option.Option<Readonly<{ containerId: string; index: number }>> => {
  const container = document
    .elementsFromPoint(clientX, clientY)
    .find((element) => element.hasAttribute('data-droppable-id'))
  if (container === undefined) return Option.none()
  const containerId = container.getAttribute('data-droppable-id')
  if (!containerId) return Option.none()
  const sortable = [...container.querySelectorAll('[data-sortable-id]')]
  const found = sortable.findIndex((item) => {
    const rect = item.getBoundingClientRect()
    return clientY < rect.top + rect.height / 2
  })
  return Option.some({ containerId, index: found === -1 ? sortable.length : found })
}

/* The pointer and keyboard wiring for the sortable team list. */
const attachDrag = (host: HTMLElement, offer: (message: DragMessage) => void): (() => void) => {
  const events = new AbortController()
  let pointer: number | null = null
  let keyboard = false
  let keyboardTarget: Readonly<{ containerId: string; index: number }> | null = null
  const handleOf = (target: EventTarget | null): HTMLElement | null => {
    const element = target instanceof Element ? target : null
    const handle = element?.closest<HTMLElement>('[data-sortable-id]') ?? null
    return handle !== null && host.contains(handle) ? handle : null
  }
  const handlesOf = (handle: HTMLElement): ReadonlyArray<HTMLElement> => {
    const container = handle.closest<HTMLElement>('[data-droppable-id]')
    return [...(container ?? host).querySelectorAll<HTMLElement>('[data-sortable-id]')]
  }
  const containerOf = (handle: HTMLElement): string =>
    handle.closest<HTMLElement>('[data-droppable-id]')?.getAttribute('data-droppable-id') ?? ''
  const containers = (): ReadonlyArray<HTMLElement> => [
    ...host.querySelectorAll<HTMLElement>('[data-droppable-id]'),
  ]
  const countIn = (containerId: string): number =>
    containers()
      .find((entry) => entry.getAttribute('data-droppable-id') === containerId)
      ?.querySelectorAll('[data-sortable-id]').length ?? 0
  const moveTo = (target: Readonly<{ containerId: string; index: number }>) => {
    keyboardTarget = target
    offer({
      _tag: 'CompletedResolveKeyboardMove',
      targetContainerId: target.containerId,
      targetIndex: target.index,
    })
  }
  const down = (event: PointerEvent) => {
    if (event.button !== DRAG_BUTTON_LEFT) return
    const handle = handleOf(event.target)
    if (handle === null) return
    const itemId = handle.dataset['sortableId']
    if (itemId === undefined) return
    const containerId = containerOf(handle)
    if (containerId === '') return
    pointer = event.pointerId
    offer({
      _tag: 'PressedDraggable',
      itemId,
      containerId,
      index: handlesOf(handle).indexOf(handle),
      screenX: event.screenX,
      screenY: event.screenY,
    })
  }
  const move = (event: PointerEvent) => {
    if (pointer === null || pointer !== event.pointerId) return
    offer({
      _tag: 'MovedPointer',
      screenX: event.screenX,
      screenY: event.screenY,
      clientX: event.clientX,
      clientY: event.clientY,
      maybeDropTarget: dropTargetAt(event.clientX, event.clientY),
    })
  }
  const up = (event: PointerEvent) => {
    if (pointer === null || pointer !== event.pointerId) return
    pointer = null
    offer({ _tag: 'ReleasedPointer' })
  }
  const cancel = (event: PointerEvent) => {
    if (pointer === null || pointer !== event.pointerId) return
    pointer = null
    offer({ _tag: 'CancelledDrag' })
  }
  const key = (event: KeyboardEvent) => {
    if (keyboard) {
      if (event.key === 'Escape') {
        keyboard = false
        offer({ _tag: 'CancelledDrag' })
      } else if (event.key === 'Tab') {
        const all = containers()
        const current = all.findIndex(
          (entry) => entry.getAttribute('data-droppable-id') === keyboardTarget?.containerId,
        )
        if (current < 0) return
        const next = (current + (event.shiftKey ? -1 : 1) + all.length) % all.length
        const container = all[next]
        const id = container?.getAttribute('data-droppable-id')
        if (container === undefined || id === null || id === undefined) return
        moveTo({ containerId: id, index: Math.min(keyboardTarget?.index ?? 0, countIn(id)) })
      } else if (event.key === ' ' || event.key === 'Enter') {
        keyboard = false
        keyboardTarget = null
        offer({ _tag: 'ConfirmedKeyboardDrop' })
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (keyboardTarget === null) return
        const index =
          event.key === 'ArrowDown'
            ? Math.min(countIn(keyboardTarget.containerId), keyboardTarget.index + 1)
            : Math.max(0, keyboardTarget.index - 1)
        moveTo({ ...keyboardTarget, index })
      }
      event.preventDefault()
      return
    }
    if (pointer !== null) {
      if (event.key !== 'Escape') return
      pointer = null
      offer({ _tag: 'CancelledDrag' })
      return
    }
    if (event.key !== ' ' && event.key !== 'Enter') return
    const handle = handleOf(event.target)
    if (handle === null) return
    const itemId = handle.dataset['sortableId']
    if (itemId === undefined) return
    const containerId = containerOf(handle)
    if (containerId === '') return
    keyboard = true
    const index = handlesOf(handle).indexOf(handle)
    keyboardTarget = { containerId, index }
    offer({
      _tag: 'ActivatedKeyboardDrag',
      itemId,
      containerId,
      index,
    })
    event.preventDefault()
  }
  host.addEventListener('pointerdown', down, { signal: events.signal })
  document.addEventListener('pointermove', move, { signal: events.signal })
  document.addEventListener('pointerup', up, { signal: events.signal })
  document.addEventListener('pointercancel', cancel, { signal: events.signal })
  document.addEventListener('keydown', key, { signal: events.signal })
  return () => events.abort()
}

const TeamDrag = Mount.makeStream('TeamDrag', {}, (element: HTMLElement) =>
  Stream.callback<Message>((queue) =>
    Effect.scoped(
      Effect.gen(function* () {
        const offer = (message: DragMessage) => Queue.offerUnsafe(queue, dragChanged(message))
        yield* Effect.acquireRelease(
          Effect.sync(() => attachDrag(element, offer)),
          (dispose) => Effect.sync(dispose),
        )
        return yield* Effect.never
      }),
    ),
  ),
)

const nameOf = (id: string): string => identityOf(id).name

const HUES = [28, 62, 150, 195, 240, 285, 330]
const hueOf = (id: string): number => HUES[Number(id.slice(1)) % HUES.length] ?? 240

const amount = (value: number): string =>
  value < 10 ? value.toFixed(1) : String(Math.floor(value))
const dh = (t: Messages, value: number): string => t.units.devHours(amount(value))

const perMinute = (rate: number): string => {
  const value = rate * 60
  return value < 10 ? value.toFixed(1) : String(Math.round(value))
}

const wait = (t: Messages, seconds: number): string =>
  seconds < 90 ? t.units.s(Math.max(0, Math.ceil(seconds))) : t.units.min(Math.ceil(seconds / 60))

export const teamName = (t: Messages, team: Team): string => {
  if (team.id === 'core' && team.name === 'Core') return t.team.coreTeam
  const numbered = /^Team (\d+)$/.exec(team.name)
  return numbered ? t.team.teamN(Number(numbered[1])) : team.name
}

export const serviceName = (t: Messages, service: Service): string => {
  if (service.id === 'monolith' && service.name === 'Monolith') return t.team.monolith
  const numbered = /^Service (\d+)$/.exec(service.name)
  return numbered ? t.team.serviceN(Number(numbered[1])) : service.name
}

const workItemName = (t: Messages, item: WorkItem): string => {
  if (item.kind === 'feature') return t.catalog.features[item.ref as FeatureId]?.name ?? item.ref
  if (item.kind === 'task') {
    const name = t.catalog.tasks[item.ref as TaskId]?.name ?? item.ref
    return item.ref === 'runbook' && item.target
      ? t.team.runbookItem(
          name,
          t.catalog.incidents[item.target as IncidentId]?.name ?? item.target,
        )
      : name
  }
  if (item.kind === 'patch') {
    const component = t.catalog.components[item.target as ComponentId]
    return component ? t.team.patchOf(component.name) : t.team.patchDesign
  }
  if (item.kind === 'spike')
    return t.team.spikeOf(t.catalog.research[item.ref as ResearchId]?.name ?? item.ref)
  if (item.kind === 'lever')
    return t.levers.item(t.catalog.pools[item.ref as RequestKind]?.label ?? item.ref)
  if (item.kind === 'split') return t.team.splitAService
  if (item.kind === 'move')
    return item.ref === 'auth'
      ? t.team.moveAuthInHouse
      : item.ref === 'reshard'
        ? t.team.reshardDatabase
        : t.team.changeDatabaseEngine
  return t.team.migrationStep(item.ref.slice(5))
}

const planned = (game: Game, id: FeatureId): boolean =>
  isBuilt(game, id) || game.backlog.some((item) => item.ref === id)

const featureWhy = (t: Messages, game: Game, id: FeatureId, refusal: Refusal): string => {
  const reason = t.team.refusal
  const def = FEATURES[id]
  const name = t.catalog.features[id].name
  if (game.sandbox) return reason.sandbox
  if (def.era > game.stage) return reason.tooEarly(name, t.catalog.eras[def.era]?.name ?? '')
  if (def.research && !has(game, def.research))
    return reason.locked(name, t.catalog.research[def.research].name)
  const missing = def.requires.filter((needed) => !planned(game, needed))
  if (missing.length > 0)
    return reason.needs(
      name,
      missing.map((needed) => t.catalog.features[needed].name).join(reason.and),
    )
  if (id === 'data-residency' && !openRegions(game).includes('eu'))
    return reason.needsEuRegion(name)
  if (id === 'email-digests' && !game.nodes.some((node) => node.type === 'queue'))
    return reason.needsQueue(name)
  return refusalIn(t, refusal)
}

const taskWhy = (t: Messages, game: Game, id: TaskId, refusal: Refusal): string => {
  const reason = t.team.refusal
  const research = TASKS[id].research
  if (game.sandbox) return reason.sandbox
  if (research && !has(game, research))
    return reason.locked(t.catalog.tasks[id].name, t.catalog.research[research].name)
  return id === 'add-index'
    ? reason.everyQueryIndexed
    : id === 'refactor'
      ? reason.noTechDebt
      : id === 'upgrade-cluster'
        ? reason.noCluster
        : id === 'off-loop'
          ? reason.noEventLoop
          : id === 'timeouts-retries'
            ? reason.everyLinkPolicy
            : id === 'load-test'
              ? reason.loadTestRunning
              : refusalIn(t, refusal)
}

const runbookWhy = (t: Messages, game: Game, kind: IncidentId, refusal: Refusal): string => {
  const reason = t.team.refusal
  if (game.sandbox) return reason.sandbox
  if (!has(game, 'runbooks'))
    return reason.locked(reason.aRunbook, t.catalog.research.runbooks.name)
  if (!sreStaffed(game)) return reason.needsSre
  if (
    game.backlog.some(
      (item) => item.kind === 'task' && item.ref === 'runbook' && item.target === kind,
    )
  )
    return reason.runbookOnBacklog(t.catalog.incidents[kind].name)
  return refusalIn(t, refusal)
}

const splitWhy = (t: Messages, game: Game, draft: ServiceDraft, refusal: Refusal): string => {
  const reason = t.team.refusal
  if (game.sandbox) return reason.sandbox
  if (!has(game, 'service-carve-out'))
    return reason.locked(reason.aServiceSplit, t.catalog.research['service-carve-out'].name)
  if (draft.kinds.length === 0) return reason.chooseFeature
  if (draft.target === '') return reason.chooseTarget
  const name = draft.name.trim()
  if (
    name !== '' &&
    game.services.some((service) => service.name.toLowerCase() === name.toLowerCase())
  )
    return reason.serviceExists(name)
  return refusalIn(t, refusal)
}

const splitRequestOf = (draft: ServiceDraft): SplitRequest | null =>
  draft.kinds.length === 0
    ? null
    : {
        kinds: draft.kinds,
        name: draft.name,
        ...(draft.target.startsWith('service:') ? { service: draft.target.slice(8) } : {}),
        ...(draft.target.startsWith('node:') ? { node: draft.target.slice(5) } : {}),
      }

const clamp = (share: number): number => Math.max(0, Math.min(1, share))

const POLICY_ICONS: Record<PolicyId, IconNode> = {
  'move-fast': Rabbit,
  balanced: Scale,
  quality: Gem,
}

const kindOf = (t: Messages): Record<WorkKind, Readonly<{ label: string; fill: string }>> => ({
  feature: { label: t.team.feature, fill: css({ backgroundColor: 'groupEdge' }) },
  lever: { label: t.levers.label, fill: css({ backgroundColor: 'groupEdge' }) },
  task: { label: t.team.engineering, fill: css({ backgroundColor: 'groupData' }) },
  migration: { label: t.team.migration, fill: css({ backgroundColor: 'groupCompute' }) },
  spike: { label: t.team.spike, fill: css({ backgroundColor: 'groupOps' }) },
  patch: { label: t.team.security, fill: css({ backgroundColor: 'danger' }) },
  split: { label: t.team.split, fill: css({ backgroundColor: 'groupOps' }) },
  move: { label: t.team.move, fill: css({ backgroundColor: 'groupCompute' }) },
})

const STRIPES = 'repeating-linear-gradient(-45deg, oklch(1 0 0 / 0.28) 0 6px, transparent 6px 12px)'

const heading = (title: string, right: Child, h: H<Message>): Content =>
  h.div
    .class(
      css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '2',
        paddingInline: '1',
        paddingTop: '2',
      }),
    )
    .children(h.span.class(EYEBROW).children(title), right)

const iconButton = (
  label: string,
  glyph: IconNode,
  message: Message,
  enabled: boolean,
  h: H<Message>,
  className = '',
): Content =>
  button(
    h,
    {
      onClick: message,
      isDisabled: !enabled,
      variant: 'ghost',
      size: 'icon-xs',
      className: cx(
        css({
          color: 'mutedForeground',
        }),
        className,
      ),
      attributes: { 'aria-label': label, title: label },
    },
    icon(
      h,
      glyph,
      css({
        width: '3.5',
        height: '3.5',
      }),
    ),
  )

const renameField = (draft: string, label: string, placeholder: string, h: H<Message>): Content => {
  const t = copy(h)
  return h.div
    .class(
      css({
        display: 'flex',
        minWidth: '0',
        flex: '1 1 0%',
        alignItems: 'center',
        gap: '1',
      }),
    )
    .children(
      h.input
        .attr('type', 'text')
        .value(draft)
        .attr('placeholder', placeholder)
        .attr('maxlength', String(MAX_NAME_CHARS))
        .attr('autocomplete', 'off')
        .attr('spellcheck', 'false')
        .attr('autofocus', '')
        .attr('aria-label', label)
        .on('input', ({ value: name }) =>
          Message.TeamChanged({ message: TeamMessage.RenameChanged({ name }) }),
        )
        .on('keydown', (payload) =>
          payload.key === 'Enter'
            ? Message.TeamChanged({ message: TeamMessage.RenameCommitted() })
            : payload.key === 'Escape'
              ? Message.TeamChanged({ message: TeamMessage.RenameCancelled() })
              : undefined,
        )
        .class(
          css(WELL_STYLE, {
            height: '7',
            minWidth: '0',
            flex: '1 1 0%',
            borderRadius: 'lg',
            paddingInline: '2',
            fontSize: 'type.12',
            outlineStyle: 'none',
          }),
        ),
      iconButton(
        t.team.saveName,
        Check,
        Message.TeamChanged({ message: TeamMessage.RenameCommitted() }),
        draft.trim() !== '',
        h,
      ),
      iconButton(
        t.team.cancel,
        X,
        Message.TeamChanged({ message: TeamMessage.RenameCancelled() }),
        true,
        h,
      ),
    )
}

const halo = (share: number, className: string, h: H<Message>): Content => {
  const radius = 25
  const length = 2 * Math.PI * radius
  return h.svg
    .attr('aria-hidden', 'true')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('viewBox', '0 0 54 54')
    .attr('fill', 'none')
    .class(
      cx(
        css({
          pointerEvents: 'none',
          position: 'absolute',
          inset: '-5px',
          width: '54px',
          height: '54px',
        }),
        className,
      ),
    )
    .children(
      h.circle
        .attr('cx', '27')
        .attr('cy', '27')
        .attr('r', String(radius))
        .attr('stroke', 'currentColor')
        .attr('stroke-width', '2.5')
        .attr('opacity', '0.18')
        .children(),
      h.circle
        .attr('cx', '27')
        .attr('cy', '27')
        .attr('r', String(radius))
        .attr('stroke', 'currentColor')
        .attr('stroke-width', '2.5')
        .attr('stroke-linecap', 'round')
        .attr('stroke-dasharray', `${length}`)
        .attr('stroke-dashoffset', `${length * (1 - clamp(share))}`)
        .attr('transform', 'rotate(-90 27 27)')
        .class(
          css({
            transitionProperty: 'stroke-dashoffset',
            transitionDuration: 'normal',
            transitionTimingFunction: 'out',
          }),
        )
        .children(),
    )
}

const seat = (
  key: string,
  face: Child,
  name: string,
  note: Child,
  corners: ReadonlyArray<Child>,
  className: string,
  h: H<Message>,
): Content =>
  h.div
    .key(key)
    .class(
      cx(
        cx(
          css({
            position: 'relative',
            display: 'flex',
            minWidth: '0',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5',
            borderRadius: 'xl',
            paddingInline: '1.5',
            paddingTop: '3.5',
            paddingBottom: '2.5',
            textAlign: 'center',
          }),
          'group',
        ),
        className,
      ),
    )
    .children(
      face,
      h.span
        .class(
          css({
            marginTop: '1',
            width: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 'type.12-5',
            fontWeight: 'medium',
          }),
        )
        .children(name),
      h.span
        .class(
          cx(
            FIGURE,
            css({
              width: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 'type.10-5',
              color: 'mutedForeground',
            }),
          ),
        )
        .children(note),
      ...corners,
    )

const corner = (side: 'left' | 'right', control: Child, h: H<Message>): Content =>
  h.div
    .class(
      cx(
        css({
          position: 'absolute',
          top: '1',
          opacity: 0,
          transitionProperty: 'opacity',
          transitionDuration: 'fast',
          transitionTimingFunction: 'out',
          '.group:hover &': {
            opacity: 1,
          },
          '.group:focus-within &': {
            opacity: 1,
          },
          '@media(hover:none)': {
            opacity: 1,
          },
        }),
        side === 'left'
          ? css({
              left: '1',
            })
          : css({
              right: '1',
            }),
      ),
    )
    .children(control)

const face = (
  hue: number | null,
  content: Child,
  badgeMark: Child,
  ringMark: Child,
  h: H<Message>,
): Content =>
  h.span
    .class(
      cx(
        css({
          position: 'relative',
          display: 'grid',
          width: '11',
          height: '11',
          flexShrink: '0',
          placeItems: 'center',
          borderRadius: 'full',
          fontSize: 'type.17',
          fontWeight: 'semibold',
          color: 'white',
          boxShadow: 'pressed',
        }),
        hue === null &&
          css({
            layerStyle: 'primaryFill',
            color: 'onPrimaryFill',
          }),
      ),
    )
    .style(
      hue === null
        ? {}
        : {
            backgroundImage: `linear-gradient(to bottom, oklch(0.72 0.13 ${hue}), oklch(0.6 0.15 ${hue}))`,
          },
    )
    .children(ringMark, content, badgeMark)

const languageMark = (language: Engineer['language'], h: H<Message>): Content =>
  h.span
    .class(
      css({
        position: 'absolute',
        right: '-0.25rem',
        bottom: '-0.25rem',
        display: 'grid',
        width: '18px',
        height: '18px',
        placeItems: 'center',
        borderRadius: 'full',
        backgroundColor: 'card',
        boxShadow: 'raised',
      }),
    )
    .children(
      stackLogo(
        h,
        language,
        css({
          width: '3',
          height: '3',
        }),
      ),
    )

const engineerSeat = (game: Game, engineer: Engineer, h: H<Message>): Content => {
  const t = copy(h)

  const ramp = (game.time - engineer.hiredAt) / rampSeconds(game)
  const ramping = ramp < 1
  const name = nameOf(engineer.id)
  const training = trainingOf(engineer)
  const learned = training
    ? 1 - (training.readyAt - game.time) / trainSeconds(training.language)
    : 0
  return seat(
    engineer.id,
    face(
      hueOf(engineer.id),
      h.span.children(name.slice(0, 1)),
      languageMark(engineer.language, h),
      training
        ? halo(learned, css({ color: 'primary' }), h)
        : ramping
          ? halo(ramp, css({ color: 'ok' }), h)
          : undefined,
      h,
    ),
    name,
    training
      ? t.team.learning(LANGUAGES[training.language].name)
      : ramping
        ? t.team.ramping
        : t.team.s(money(salaryOf(game, engineer.language))),
    [],
    css({ layerStyle: 'raised', boxShadow: 'raised' }),
    h,
  )
}

const engineerControls = (game: Game, engineer: Engineer, h: H<Message>): ReadonlyArray<Child> => {
  const t = copy(h)

  const teams = game.teams
  const index = teams.findIndex((team) => team.id === engineer.team)
  const next = teams[(index + 1) % teams.length]
  const language = learnTargetOf(game)
  const price = trainCost(game, language)
  const learns = engineer.language !== language && !trainingOf(engineer)
  return [
    teams.length > 1 || learns
      ? corner(
          'left',
          h.div
            .class(
              css({
                display: 'flex',
              }),
            )
            .children(
              teams.length > 1 && next
                ? iconButton(
                    t.team.moveTo(teamName(t, next)),
                    ArrowLeftRight,
                    Message.TeamChanged({
                      message: TeamMessage.EngineerAssigned({
                        engineerId: engineer.id,
                        teamId: next.id,
                      }),
                    }),
                    true,
                    h,
                  )
                : undefined,
              learns
                ? iconButton(
                    t.team.learn(LANGUAGES[language].name, money(price)),
                    GraduationCap,
                    Message.TeamChanged({
                      message: TeamMessage.TrainChosen({ engineerId: engineer.id }),
                    }),
                    game.cash >= price,
                    h,
                  )
                : undefined,
            ),
          h,
        )
      : undefined,
    corner(
      'right',
      iconButton(
        t.team.layOff(nameOf(engineer.id)),
        UserMinus,
        Message.TeamChanged({ message: TeamMessage.LayoffChosen({ engineerId: engineer.id }) }),
        true,
        h,
        css({ _hover: { color: 'danger' } }),
      ),
      h,
    ),
  ]
}

const founderSeat = (h: H<Message>): Content => {
  const t = copy(h)
  return seat(
    'founder',
    face(
      null,
      icon(
        h,
        Crown,
        css({
          width: '18px',
          height: '18px',
        }),
      ),
      undefined,
      undefined,
      h,
    ),
    t.team.you,
    t.team.founder,
    [],
    css({ layerStyle: 'raised', boxShadow: 'raised' }),
    h,
  )
}

const hireSeat = (game: Game, language: LanguageId, h: H<Message>): Content => {
  const t = copy(h)

  const price = signingOf(game, language)
  const open = game.stage >= 1
  const afford = game.cash >= price
  return h.button
    .key(`hire-${language}`)
    .attr('type', 'button')
    .on('click', () => Message.TeamChanged({ message: TeamMessage.HireChosen({ language }) }))
    .disabled(!open || !afford)
    .attr(
      'aria-label',
      open ? t.team.hireEngineerFor(LANGUAGES[language].name, money(price)) : t.team.hiringLocked,
    )
    .class(
      cx(
        cx(
          css({
            display: 'flex',
            minWidth: '0',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5',
            borderRadius: 'xl',
            borderWidth: '1.5px',
            borderStyle: 'dashed',
            paddingInline: '1.5',
            paddingTop: '3.5',
            paddingBottom: '2.5',
            textAlign: 'center',
          }),
          'press',
          'group',
        ),
        open && afford
          ? css({
              borderColor: 'color-mix(in oklab, var(--foreground) 25%, transparent)',
              color: 'foreground',
              _hover: {
                borderColor: 'color-mix(in oklab, var(--foreground) 45%, transparent)',
                backgroundColor: 'color-mix(in oklab, var(--foreground) 3%, transparent)',
              },
            })
          : css({
              cursor: 'not-allowed',
              borderColor: 'color-mix(in oklab, var(--foreground) 12%, transparent)',
              color: 'mutedForeground',
            }),
      ),
    )
    .children(
      h.span
        .class(
          cx(
            css({
              position: 'relative',
              display: 'grid',
              width: '11',
              height: '11',
              placeItems: 'center',
              borderRadius: 'full',
            }),
            open && afford
              ? css({
                  layerStyle: 'primaryFill',
                  color: 'onPrimaryFill',
                  boxShadow: 'primary',
                })
              : css(WELL_STYLE, { borderRadius: 'full' }),
          ),
        )
        .children(
          icon(
            h,
            open ? Plus : Lock,
            open
              ? css({
                  width: '5',
                  height: '5',
                })
              : css({
                  width: '4',
                  height: '4',
                }),
          ),
          open ? languageMark(language, h) : undefined,
        ),
      h.span
        .class(
          css({
            marginTop: '1',
            width: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 'type.12-5',
            fontWeight: 'medium',
          }),
        )
        .children(open ? t.team.hire : t.team.locked),
      h.span
        .class(
          cx(
            FIGURE,
            css({
              width: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 'type.10-5',
              color: 'mutedForeground',
            }),
          ),
        )
        .children(open ? money(price) : (t.catalog.eras[1]?.name ?? '')),
    )
}

const pendingSeat = (game: Game, id: string, readyAt: number, h: H<Message>): Content => {
  const t = copy(h)

  const left = readyAt - game.time
  return seat(
    id,
    h.span
      .class(
        css({
          position: 'relative',
          display: 'grid',
          width: '11',
          height: '11',
          placeItems: 'center',
          borderRadius: 'full',
          borderWidth: '1.5px',
          borderStyle: 'dashed',
          borderColor: 'color-mix(in oklab, var(--foreground) 25%, transparent)',
          color: 'mutedForeground',
        }),
      )
      .children(
        icon(
          h,
          Hourglass,
          css({
            width: '4',
            height: '4',
          }),
        ),
      ),
    nameOf(id),
    t.team.inText(wait(t, left)),
    [],
    css({
      backgroundColor: 'color-mix(in oklab, var(--foreground) 2.5%, transparent)',
      boxShadow: 'line',
    }),
    h,
  )
}

const policySwitch = (team: Team, h: H<Message>): Content => {
  const t = copy(h)
  return h.div
    .class(
      css(
        {
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '0.75',
          padding: '0.75',
        },
        WELL_STYLE,
        {
          borderRadius: 'lg',
        },
      ),
    )
    .children(
      ...POLICY_IDS.map((policy) => {
        const selected = team.policy === policy
        return h.button
          .key(`${team.id}-${policy}`)
          .attr('type', 'button')
          .attr('aria-pressed', selected ? 'true' : 'false')
          .on('click', () =>
            Message.TeamChanged({ message: TeamMessage.PolicyChosen({ teamId: team.id, policy }) }),
          )
          .class(
            cx(
              cx(
                css({
                  display: 'flex',
                  height: '8',
                  minWidth: '0',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1.5',
                  borderRadius: 'lg',
                  paddingInline: '2',
                  fontSize: 'type.12',
                  fontWeight: 'medium',
                }),
                'press',
              ),
              selected
                ? css({
                    layerStyle: 'raised',
                    color: 'foreground',
                    boxShadow: 'raised',
                  })
                : css({
                    color: 'mutedForeground',
                    _hover: {
                      backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                      color: 'foreground',
                    },
                  }),
            ),
          )
          .children(
            icon(
              h,
              POLICY_ICONS[policy],
              css({
                width: '3.5',
                height: '3.5',
              }),
            ),
            h.span
              .class(
                css({
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }),
              )
              .children(t.catalog.policies[policy].label),
          )
      }),
    )
}

const kindsOf = (t: Messages): ReadonlyArray<readonly [TeamKind, string, ResearchId | null]> => [
  ['product', t.team.product, null],
  ['platform', t.team.platform, 'platform-team'],
  ['sre', 'SRE', 'sre-team'],
  ['data', t.team.data, 'data-team'],
  ['security', t.team.security, 'security-team'],
]

const kindSwitch = (game: Game, team: Team, h: H<Message>): Content => {
  const t = copy(h)
  return h.div
    .class(
      css(
        {
          display: 'flex',
          gap: '0.75',
          padding: '0.75',
        },
        WELL_STYLE,
        {
          borderRadius: 'lg',
        },
      ),
    )
    .children(
      ...kindsOf(t).map(([kind, label, research]) => {
        const selected = team.kind === kind
        const result = setTeamKind(game, team.id, kind)
        const refusal = Result.isFailure(result) ? refusalIn(t, result.failure) : null
        const needs = research !== null && !has(game, research) ? research : null
        return h.button
          .key(`${team.id}-${kind}`)
          .attr('type', 'button')
          .attr('aria-pressed', selected ? 'true' : 'false')
          .disabled(refusal !== null && needs === null)
          .attr('title', refusal ?? label)
          .on('click', () =>
            needs !== null
              ? Message.ResearchShown({ id: needs })
              : Message.TeamChanged({ message: TeamMessage.KindChosen({ teamId: team.id, kind }) }),
          )
          .class(
            cx(
              cx(
                css({
                  display: 'flex',
                  height: '8',
                  minWidth: '0',
                  flex: '1 1 auto',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 'lg',
                  paddingInline: '1.5',
                  fontSize: 'type.12',
                  fontWeight: 'medium',
                }),
                'press',
              ),
              selected
                ? css({
                    layerStyle: 'raised',
                    color: 'foreground',
                    boxShadow: 'raised',
                  })
                : refusal !== null
                  ? css({
                      color: 'color-mix(in oklab, var(--muted-foreground) 45%, transparent)',
                      _hover: {
                        backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                        color: 'mutedForeground',
                      },
                      _enabled: {
                        cursor: 'pointer',
                      },
                      _disabled: {
                        cursor: 'not-allowed',
                      },
                    })
                  : css({
                      color: 'mutedForeground',
                      _hover: {
                        backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                        color: 'foreground',
                      },
                    }),
            ),
          )
          .children(
            h.span
              .class(
                css({
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }),
              )
              .children(label),
          )
      }),
    )
}

const researchRow = (game: Game, team: Team, ledger: Ledger, h: H<Message>): Content => {
  const t = copy(h)
  const study = currentStudy(game.studies)
  const assigned = assignments(game).get(team.id)
  const rate = study ? boostRateOf(game, ledger, team, study.id) : 0
  const boosting = game.researchTeam === team.id && rate > 0
  const name = study ? t.catalog.research[study.id].name : null
  const reason = !study
    ? t.team.noStudy
    : !teamReady(game, team)
      ? t.team.ramping
      : assigned
        ? t.team.building(workItemName(t, assigned))
        : !teamHasEngineers(game, team)
          ? t.team.noEngineers
          : !canBoost(game, team, study.id)
            ? t.team.cantBoost(name ?? '')
            : null
  const label =
    boosting && name ? t.team.boosting(name) : (reason ?? (name ? t.team.boost(name) : ''))
  return h.div
    .class(
      css(
        {
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          paddingInline: '2.5',
          paddingBlock: '2',
        },
        WELL_STYLE,
        {
          borderRadius: 'lg',
        },
      ),
    )
    .attr('title', boosting && team.kind !== 'product' ? t.team.effectOnHold : t.team.boostHelp)
    .children(
      icon(
        h,
        Zap,
        css({
          width: '3.5',
          height: '3.5',
          flexShrink: '0',
          color: boosting ? 'ok' : 'mutedForeground',
        }),
      ),
      h.span
        .class(
          css({
            minWidth: '0',
            flex: '1 1 0%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 'type.12-5',
            color: reason && !boosting ? 'mutedForeground' : 'foreground',
          }),
        )
        .children(label),
      rate > 0
        ? h.span
            .class(cx(FIGURE, css({ fontSize: 'type.11', color: 'ok' })))
            .children(t.research.speed(speedFactorOf(1 + rate)))
        : undefined,
      study && rate > 0
        ? button(
            h,
            {
              onClick: Message.TeamChanged({
                message: boosting
                  ? TeamMessage.ResearchTeamCleared()
                  : TeamMessage.ResearchTeamChosen({ teamId: team.id }),
              }),
              variant: boosting ? 'outline' : 'default',
              size: 'sm',
            },
            boosting ? t.team.stopBoost : t.team.boostAction,
          )
        : undefined,
    )
}

const pod = (model: Model, team: Team, index: number, h: H<Message>): Content => {
  const t = copy(h)

  const game = model.board.game
  const output = teamOutputs(game, ledgerOf(model)).find((entry) => entry.team.id === team.id)
  const now = policyNow(game, team)
  const pending = game.hires.filter((entry) => entry.team === team.id)
  const members = membersOf(game, team)
  const sandbox = game.sandbox
  const target = dragDropTarget(model.board.team.drag)
  const dropTarget =
    dragIsActive(model.board.team.drag) &&
    Option.exists(target, (entry) => entry.containerId === team.id)
  const renaming = model.board.team.rename
  const editTeam =
    renaming !== null && renaming.target === 'team' && renaming.id === team.id ? renaming : null
  return h.section
    .key(team.id)
    .attr('data-droppable-id', team.id)
    .attr('role', 'listbox')
    .attr('aria-label', teamName(t, team))
    .class(
      css(
        PANEL_STYLE,
        {
          display: 'flex',
          flexDirection: 'column',
          gap: '3',
          padding: '3',
          transitionProperty: 'box-shadow',
          transitionDuration: 'fast',
          transitionTimingFunction: 'out',
        },
        dropTarget && {
          boxShadow: 'selectedHalo',
        },
      ),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'flex-start',
            gap: '2',
            paddingInline: '1',
          }),
        )
        .children(
          h.div
            .class(
              css({
                display: 'flex',
                minWidth: '0',
                flex: '1 1 0%',
                flexDirection: 'column',
              }),
            )
            .children(
              h.div
                .class(
                  css({
                    display: 'flex',
                    minWidth: '0',
                    alignItems: 'center',
                    gap: '1',
                  }),
                )
                .children(
                  editTeam
                    ? renameField(editTeam.draft, t.team.teamName, team.name, h)
                    : h.span
                        .class(
                          css({
                            minWidth: '0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 'type.15',
                            fontWeight: 'semibold',
                            letterSpacing: 'body',
                          }),
                        )
                        .children(teamName(t, team)),
                  editTeam
                    ? undefined
                    : iconButton(
                        t.team.renameTeam,
                        Pencil,
                        Message.TeamChanged({
                          message: TeamMessage.RenameStarted({
                            target: 'team',
                            id: team.id,
                          }),
                        }),
                        true,
                        h,
                      ),
                ),
              h.span
                .class(
                  css({
                    fontSize: 'type.11-5',
                    color: 'mutedForeground',
                  }),
                )
                .children(t.team.people(output?.headcount ?? 0)),
            ),
          h.div
            .class(
              css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
              }),
            )
            .children(
              h.span
                .class(
                  cx(
                    FIGURE,
                    css({
                      fontSize: 'type.22',
                      lineHeight: 'none',
                      fontWeight: 'medium',
                    }),
                  ),
                )
                .children(perMinute(output?.devHoursPerSecond ?? 0)),
              h.span
                .class(
                  css(EYEBROW_STYLE, {
                    marginTop: '1',
                    fontSize: 'type.9-5',
                  }),
                )
                .children(t.team.dHMin),
            ),
          index > 0
            ? iconButton(
                t.team.removeTeam,
                Trash2,
                Message.TeamChanged({ message: TeamMessage.Removed({ teamId: team.id }) }),
                true,
                h,
              )
            : undefined,
        ),
      moraleCard(game, team, h),
      index > 0 && !sandbox && game.stage >= PLATFORM_STAGE ? kindSwitch(game, team, h) : undefined,
      !sandbox && !teamReady(game, team)
        ? h.span
            .class(
              css({
                marginTop: '-0.375rem',
                paddingInline: '1',
                fontSize: 'type.11',
                color: 'warn',
              }),
            )
            .children(t.team.ramping)
        : undefined,
      team.kind === 'product' ? policySwitch(team, h) : undefined,
      team.kind === 'product' && now.id !== team.policy
        ? h.span
            .class(
              css({
                marginTop: '-0.375rem',
                paddingInline: '1',
                fontSize: 'type.11',
                color: 'mutedForeground',
              }),
            )
            .children(t.team.untilTomorrow(t.catalog.policies[now.id].label))
        : undefined,
      h.div
        .class(
          css({
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '2',
          }),
        )
        .children(
          index === 0 ? founderSeat(h) : undefined,
          ...members.map((engineer) =>
            h.div
              .key(engineer.id)
              .class(
                cx(
                  css({
                    position: 'relative',
                  }),
                  'group',
                ),
              )
              .children(
                h.div
                  .attr('data-draggable-id', engineer.id)
                  .attr('data-sortable-id', engineer.id)
                  .attr('role', 'option')
                  .attr('aria-roledescription', 'draggable')
                  .attr('tabindex', '0')
                  .style({
                    touchAction: 'none',
                    userSelect: 'none',
                    webkitUserSelect: 'none',
                  })
                  .attr('aria-label', t.team.moveFrom(nameOf(engineer.id), teamName(t, team)))
                  .class(
                    cx(
                      css({
                        cursor: 'grab',
                        touchAction: 'none',
                        borderRadius: 'xl',
                        _focusVisible: {
                          outlineWidth: '2px',
                          outlineStyle: 'solid',
                          outlineColor: 'primary',
                        },
                        _active: {
                          cursor: 'grabbing',
                        },
                      }),
                      Option.exists(
                        dragItemId(model.board.team.drag),
                        (id) => id === engineer.id,
                      ) &&
                        css({
                          opacity: 0.45,
                        }),
                    ),
                  )
                  .children(engineerSeat(game, engineer, h)),
                ...engineerControls(game, engineer, h),
              ),
          ),
          ...pending.map((entry) => pendingSeat(game, entry.id, entry.readyAt, h)),
          ...(index === 0 && !sandbox && game.stage >= 1
            ? languagesInUse(game).map((language) => hireSeat(game, language, h))
            : []),
        ),
      sandbox
        ? undefined
        : team.kind === 'platform'
          ? platformWork(game, team, h)
          : team.kind === 'sre'
            ? sreWork(game, team, h)
            : team.kind === 'data'
              ? dataWork(game, team, h)
              : team.kind === 'security'
                ? securityWork(game, team, h)
                : working(
                    assignments(game).get(team.id),
                    index === 0 || members.length > 0,
                    waitingFor(game, team),
                    teamBoosting(game, team),
                    h,
                  ),
      sandbox ? undefined : researchRow(game, team, ledgerOf(model), h),
    )
}

const sreWork = (game: Game, team: Team, h: H<Message>): Content => {
  const t = copy(h)
  const holding = teamBoosting(game, team)
  return h.div
    .class(
      css(
        {
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          paddingInline: '2.5',
          paddingBlock: '2',
        },
        WELL_STYLE,
        {
          borderRadius: 'lg',
        },
      ),
    )
    .children(
      icon(
        h,
        Siren,
        css({
          width: '3.5',
          height: '3.5',
          color: 'mutedForeground',
        }),
      ),
      h.span
        .class(
          css({
            fontSize: 'type.12-5',
            color: 'mutedForeground',
          }),
        )
        .children(
          holding
            ? t.team.pagerOff
            : game.runbooks.length === 0
              ? t.team.holdsThePager
              : t.team.holdsThePagerRunbooks(game.runbooks.length),
        ),
    )
}

const dataWork = (game: Game, team: Team, h: H<Message>): Content => {
  const t = copy(h)
  return h.div
    .class(
      css(
        {
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          paddingInline: '2.5',
          paddingBlock: '2',
        },
        WELL_STYLE,
        {
          borderRadius: 'lg',
        },
      ),
    )
    .children(
      icon(
        h,
        Database,
        css({
          width: '3.5',
          height: '3.5',
          color: 'mutedForeground',
        }),
      ),
      h.span
        .class(
          css({
            fontSize: 'type.12-5',
            color: 'mutedForeground',
          }),
        )
        .children(teamBoosting(game, team) ? t.team.dataOff : t.team.runsTheWarehouseReportAndAI),
    )
}

const platformWork = (game: Game, team: Team, h: H<Message>): Content => {
  const t = copy(h)
  return h.div
    .class(
      css(
        {
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          paddingInline: '2.5',
          paddingBlock: '2',
        },
        WELL_STYLE,
        {
          borderRadius: 'lg',
        },
      ),
    )
    .children(
      icon(
        h,
        Container,
        css({
          width: '3.5',
          height: '3.5',
          color: 'mutedForeground',
        }),
      ),
      h.span
        .class(
          css({
            fontSize: 'type.12-5',
            color: 'mutedForeground',
          }),
        )
        .children(teamBoosting(game, team) ? t.team.platformOff : t.team.runsClustersAndDeploys),
    )
}

const securityWork = (game: Game, team: Team, h: H<Message>): Content => {
  const t = copy(h)
  return h.div
    .class(
      css(
        {
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          paddingInline: '2.5',
          paddingBlock: '2',
        },
        WELL_STYLE,
        {
          borderRadius: 'lg',
        },
      ),
    )
    .children(
      icon(
        h,
        Shield,
        css({
          width: '3.5',
          height: '3.5',
          color: 'mutedForeground',
        }),
      ),
      h.span
        .class(
          css({
            fontSize: 'type.12-5',
            color: 'mutedForeground',
          }),
        )
        .children(teamBoosting(game, team) ? t.team.securityOff : t.team.securityDesk),
    )
}

const working = (
  item: WorkItem | undefined,
  staffed: boolean,
  waits: number,
  boosting: boolean,
  h: H<Message>,
): Content => {
  const t = copy(h)
  return h.div
    .class(
      css(
        {
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          paddingInline: '2.5',
          paddingBlock: '2',
        },
        WELL_STYLE,
        {
          borderRadius: 'lg',
        },
      ),
    )
    .children(
      ...(item
        ? [
            statusMark('building', item.spent / item.cost, h),
            h.span
              .class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'type.11',
                    color: 'mutedForeground',
                  }),
                ),
              )
              .children(codeOf(item.kind, item.ref)),
            h.span
              .class(
                css({
                  minWidth: '0',
                  flex: '1 1 0%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'type.12-5',
                  fontWeight: 'medium',
                }),
              )
              .children(workItemName(t, item)),
            h.span
              .class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'type.11-5',
                    color: 'mutedForeground',
                  }),
                ),
              )
              .children(`${Math.floor(clamp(item.spent / item.cost) * 100)}%`),
          ]
        : [
            statusMark('queued', 0, h),
            h.span
              .class(
                css({
                  fontSize: 'type.12-5',
                  color: 'mutedForeground',
                }),
              )
              .children(
                boosting
                  ? t.team.onResearch
                  : staffed
                    ? waits > 0
                      ? t.team.waitingItems(waits)
                      : t.team.nothingAssigned
                    : t.team.noEngineers,
              ),
          ]),
    )
}

const fold = (
  key: string,
  className: string,
  summary: ReadonlyArray<Child>,
  body: Child,
  h: H<Message>,
): Content =>
  h.details
    .key(key)
    .class(cx(className, 'fold', 'group'))
    .children(
      h.summary
        .class(
          css({
            display: 'flex',
            cursor: 'pointer',
            listStyleType: 'none',
            alignItems: 'flex-start',
            gap: '2',
            '&::-webkit-details-marker': {
              display: 'none',
            },
          }),
        )
        .children(
          h.span
            .class(
              css({
                display: 'flex',
                height: '6',
                flexShrink: '0',
                alignItems: 'center',
              }),
            )
            .children(
              icon(
                h,
                ChevronRight,
                cx(
                  css({
                    width: '3.5',
                    height: '3.5',
                    color: 'mutedForeground',
                    '.group[open] > summary &': {
                      rotate: '90deg',
                    },
                  }),
                  'fold-chevron',
                ),
              ),
            ),
          ...summary,
        ),
      body,
    )

const quiet = (text: string, h: H<Message>): Content =>
  h.span
    .class(
      css({
        color: 'mutedForeground',
      }),
    )
    .children(text)

const fact = (label: string, value: Child, h: H<Message>): ReadonlyArray<Child> => [
  h.dt
    .class(
      css({
        color: 'mutedForeground',
      }),
    )
    .children(label),
  h.dd
    .class(
      css({
        minWidth: '0',
        margin: '0',
      }),
    )
    .children(value),
]

const nodeChips = (
  nodes: ReadonlyArray<GameNode>,
  empty: string,
  game: Game,
  h: H<Message>,
): Content => {
  const t = copy(h)
  return h.div
    .class(
      css({
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1',
      }),
    )
    .children(
      ...(nodes.length === 0
        ? [quiet(empty, h)]
        : nodes.map((node) =>
            h.button
              .key(node.id)
              .attr('type', 'button')
              .on('click', () => Message.RevealNode({ nodeId: node.id }))
              .attr('aria-label', t.team.openNode(nodeTitle(t, game, node)))
              .class(
                css({
                  height: '5.5',
                  borderRadius: 'md',
                  paddingInline: '1.5',
                  backgroundColor: 'color-mix(in oklab, var(--foreground) 6%, transparent)',
                  _hover: {
                    backgroundColor: 'color-mix(in oklab, var(--foreground) 12%, transparent)',
                  },
                }),
              )
              .children(nodeTitle(t, game, node)),
          )),
    )
}

const SERVICE_SELECT = css(WELL_STYLE, {
  justifySelf: 'start',
  height: '6',
  borderRadius: 'lg',
  paddingInline: '1.5',
  fontSize: 'type.11',
})

const kindColor = (kind: RequestKind): string =>
  `#${KINDS[kind].color.toString(16).padStart(6, '0')}`

const tint = (color: string, percent: number): string =>
  `color-mix(in oklab, ${color} ${percent}%, transparent)`

const packet = (h: H<Message>, kind: RequestKind, size = 8): Content =>
  h.span
    .attr('aria-hidden', 'true')
    .class(css({ flexShrink: '0', borderRadius: 'full' }))
    .style({
      width: `${size}px`,
      height: `${size}px`,
      background: kindColor(kind),
      boxShadow: `0 0 0 2px ${tint(kindColor(kind), 25)}`,
    })

const CARVE_CARD = css({
  display: 'flex',
  minWidth: '0',
  alignItems: 'center',
  gap: '2',
  borderRadius: 'lg',
  paddingInline: '2.5',
  paddingBlock: '1.5',
  fontSize: 'type.12',
  textAlign: 'start',
})

/* Where a carve-out lands: an existing Service, or an empty App Server that becomes one. */
type CarveTarget = Readonly<{
  value: string
  label: string
  language: LanguageId
  fresh: boolean
}>

const carveTargets = (t: Messages, game: Game): ReadonlyArray<CarveTarget> => [
  ...game.services.slice(1).map((service) => ({
    value: `service:${service.id}`,
    label: serviceName(t, service),
    language: RUNTIMES[stackOf(game, service).runtime].language,
    fresh: false,
  })),
  ...game.nodes
    .filter((node) => node.type === 'server' && node.serviceId === null)
    .map((node) => ({
      value: `node:${node.id}`,
      label: nodeTitle(t, game, node),
      language: RUNTIMES[node.runtime].language,
      fresh: true,
    })),
]

const targetCard = (model: Model, target: CarveTarget, h: H<Message>): Content => {
  const t = copy(h)
  const draft = model.board.team.service
  const on = draft.target === target.value
  const team = (message: TeamMessage) => Message.TeamChanged({ message })
  const card = h.button
    .key(`target-${target.value}`)
    .attr('type', 'button')
    .attr('aria-pressed', on ? 'true' : 'false')
    .on('click', () => team(TeamMessage.ServiceTargetChosen({ target: on ? '' : target.value })))
    .class(
      cx(
        CARVE_CARD,
        css({
          width: '100%',
          cursor: 'pointer',
          borderWidth: '1px',
          borderStyle: 'solid',
          transitionProperty: 'border-color, background-color, box-shadow, translate',
          transitionDuration: '160ms',
          transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
          _active: { scale: '0.98' },
        }),
        on
          ? css({
              borderColor: 'color-mix(in oklab, var(--primary) 70%, transparent)',
              backgroundColor: 'color-mix(in oklab, var(--primary) 10%, transparent)',
              boxShadow: '0 0 0 3px color-mix(in oklab, var(--primary) 18%, transparent)',
            })
          : css({
              borderColor: 'color-mix(in oklab, var(--foreground) 12%, transparent)',
              borderStyle: target.fresh ? 'dashed' : 'solid',
              _hover: {
                borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
                translate: '0 -1px',
              },
            }),
      ),
    )
    .children(
      stackLogo(h, target.language, css({ width: '4', height: '4' })),
      h.span
        .class(css({ minWidth: '0', flex: '1', truncate: true, fontWeight: 'medium' }))
        .children(target.label),
      target.fresh
        ? h.span
            .class(
              css({
                borderRadius: 'full',
                paddingInline: '1.5',
                fontSize: 'type.10',
                fontWeight: 'semibold',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'primaryStrong',
                backgroundColor: 'color-mix(in oklab, var(--primary) 14%, transparent)',
              }),
            )
            .children(t.team.newServiceBadge)
        : undefined,
    )
  if (!(on && target.fresh)) return card
  return h.div
    .key(`target-${target.value}-named`)
    .class(css({ display: 'flex', flexDirection: 'column', gap: '1.5' }))
    .children(
      card,
      h.input
        .attr('type', 'text')
        .value(draft.name)
        .attr('placeholder', t.team.nameNewService)
        .attr('aria-label', t.team.newServiceName)
        .attr('maxlength', String(MAX_NAME_CHARS))
        .on('input', ({ value: name }) => team(TeamMessage.ServiceNamed({ name })))
        .class(
          css(WELL_STYLE, {
            height: '7',
            marginLeft: '6',
            borderRadius: 'lg',
            paddingInline: '2',
            fontSize: 'type.12',
            outlineStyle: 'none',
          }),
        ),
    )
}

/* Every served kind as a slice of one bar, sized by its share of traffic. Chosen slices lift out. */
const carvingBoard = (
  model: Model,
  candidates: ReadonlyArray<RequestKind>,
  h: H<Message>,
): Content => {
  const t = copy(h)
  const game = model.board.game
  const chosen = model.board.team.service.kinds
  const mix = mixOf(game)
  const total = candidates.reduce((sum, kind) => sum + (mix[kind] ?? 0), 0) || 1
  return h.div
    .attr('aria-hidden', 'true')
    .class(
      css({
        display: 'flex',
        height: '7',
        alignItems: 'flex-end',
        gap: '0.5',
      }),
    )
    .children(
      ...candidates.map((kind) => {
        const on = chosen.includes(kind)
        const label = t.catalog.kinds[kind].label
        const share = Math.round(((mix[kind] ?? 0) / total) * 100)
        return h.button
          .key(`slice-${kind}`)
          .attr('type', 'button')
          .attr('tabindex', '-1')
          .attr('aria-pressed', on ? 'true' : 'false')
          .attr('aria-label', `${label} · ${share}%`)
          .attr('title', `${label} · ${share}%`)
          .on('click', () =>
            Message.TeamChanged({
              message: TeamMessage.ServiceKindsPicked({
                kinds: on ? chosen.filter((each) => each !== kind) : [...chosen, kind],
              }),
            }),
          )
          .class(
            css({
              minWidth: '1.5',
              height: '4',
              cursor: 'pointer',
              borderRadius: 'sm',
              transitionProperty: 'height, opacity, translate, box-shadow',
              transitionDuration: '200ms',
              transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
              opacity: '0.35',
              _hover: { opacity: '0.7' },
              '&[aria-pressed="true"]': {
                height: '6',
                opacity: '1',
                translate: '0 -2px',
              },
              '@media (prefers-reduced-motion: reduce)': { transitionDuration: '0ms' },
            }),
          )
          .style({
            flexGrow: String(Math.max(share, 1)),
            flexBasis: '0',
            background: kindColor(kind),
            boxShadow: on ? `0 4px 10px -2px ${tint(kindColor(kind), 60)}` : 'none',
          })
          .children()
      }),
    )
}

/* The bar's legend, and the way to pick kinds by name: one toggle per served kind. */
const kindLegend = (
  model: Model,
  candidates: ReadonlyArray<RequestKind>,
  h: H<Message>,
): Content => {
  const t = copy(h)
  const game = model.board.game
  const chosen = model.board.team.service.kinds
  const mix = mixOf(game)
  const total = candidates.reduce((sum, kind) => sum + (mix[kind] ?? 0), 0) || 1
  const toggle = (kind: RequestKind): Content => {
    const on = chosen.includes(kind)
    const share = Math.round(((mix[kind] ?? 0) / total) * 100)
    return h.button
      .key(`legend-${kind}`)
      .attr('type', 'button')
      .attr('aria-pressed', on ? 'true' : 'false')
      .on('click', () =>
        Message.TeamChanged({
          message: TeamMessage.ServiceKindsPicked({
            kinds: on ? chosen.filter((each) => each !== kind) : [...chosen, kind],
          }),
        }),
      )
      .class(
        css({
          display: 'flex',
          height: '6',
          cursor: 'pointer',
          alignItems: 'center',
          gap: '1.5',
          borderRadius: 'md',
          paddingInline: '2',
          fontSize: 'type.11-5',
          color: 'mutedForeground',
          transitionProperty: 'background-color, color, box-shadow',
          transitionDuration: '160ms',
          transitionTimingFunction: 'cubic-bezier(0.23, 1, 0.32, 1)',
          _hover: { color: 'foreground', backgroundColor: 'muted' },
          _active: { scale: '0.97' },
          '&[aria-pressed="true"]': { color: 'foreground', fontWeight: 'medium' },
        }),
      )
      .style(
        on
          ? {
              background: tint(kindColor(kind), 16),
              boxShadow: `inset 0 0 0 1px ${tint(kindColor(kind), 45)}`,
            }
          : {},
      )
      .children(
        packet(h, kind, 7),
        t.catalog.kinds[kind].label,
        h.span
          .class(cx(FIGURE, css({ fontSize: 'type.10', color: 'mutedForeground' })))
          .children(`${share}%`),
      )
  }
  const groups = game.services
    .map((service) => ({
      service,
      kinds: candidates.filter((kind) => serviceOfKind(game, kind).id === service.id),
    }))
    .filter((group) => group.kinds.length > 0)
  return h.div
    .attr('role', 'group')
    .attr('aria-label', t.team.carveBoard)
    .class(css({ display: 'flex', flexDirection: 'column', gap: '2' }))
    .children(
      ...groups.map(({ service, kinds }) =>
        h.div
          .key(`legend-group-${service.id}`)
          .attr('role', 'group')
          .attr('aria-label', serviceName(t, service))
          .class(css({ display: 'flex', flexDirection: 'column', gap: '1' }))
          .children(
            h.span
              .class(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5',
                  fontSize: 'type.10',
                  fontWeight: 'semibold',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'mutedForeground',
                }),
              )
              .children(
                stackLogo(
                  h,
                  RUNTIMES[stackOf(game, service).runtime].language,
                  css({ width: '3', height: '3' }),
                ),
                serviceName(t, service),
              ),
            h.div
              .class(css({ display: 'flex', flexWrap: 'wrap', gap: '1' }))
              .children(...kinds.map(toggle)),
          ),
      ),
    )
}

const carveOut = (model: Model, h: H<Message>): Content => {
  const t = copy(h)
  const game = model.board.game
  const draft = model.board.team.service
  const order = (kind: RequestKind) =>
    game.services.findIndex((service) => service.id === serviceOfKind(game, kind).id)
  const candidates = REQUEST_KINDS.filter((kind) => (mixOf(game)[kind] ?? 0) > 0).toSorted(
    (left, right) => order(left) - order(right),
  )
  const request = splitRequestOf(draft)
  const refusal =
    request === null
      ? Refusal.NotAllowed({ reason: t.team.refusal.chooseFeature })
      : draft.target === ''
        ? Refusal.NotAllowed({ reason: t.team.refusal.chooseTarget })
        : splitRefusal(game, request)
  const targets = carveTargets(t, game)
  const sources = [...new Set(draft.kinds.map((kind) => serviceOfKind(game, kind)))]
  const from = sources[0] ?? serviceOf(game)
  const mix = mixOf(game)
  const total = candidates.reduce((sum, kind) => sum + (mix[kind] ?? 0), 0) || 1
  const share = Math.round(
    (draft.kinds.reduce((sum, kind) => sum + (mix[kind] ?? 0), 0) / total) * 100,
  )
  const kloc = draft.kinds.reduce((sum, kind) => sum + capabilityKloc(game, kind), 0)
  const caption = css({
    fontSize: 'type.10',
    fontWeight: 'semibold',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'mutedForeground',
  })
  if (candidates.length === 0)
    return h.p
      .class(css({ margin: '2.5', fontSize: 'type.11-5', color: 'mutedForeground' }))
      .children(t.team.noLiveFeatureLeft)
  return h.div
    .class(
      css({
        display: 'flex',
        flexDirection: 'column',
        gap: '3',
        marginInline: '2.5',
        marginBottom: '2.5',
        borderTopWidth: '1px',
        borderTopStyle: 'solid',
        borderTopColor: 'color-mix(in oklab, var(--foreground) 8%, transparent)',
        paddingTop: '3',
      }),
    )
    .children(
      carvingBoard(model, candidates, h),
      kindLegend(model, candidates, h),
      h.div
        .class(
          css({
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            columnGap: '2',
            rowGap: '1.5',
            alignItems: 'center',
          }),
        )
        .children(
          h.span.class(caption).children(t.team.carveFrom),
          h.div
            .class(cx(CARVE_CARD, css(WELL_STYLE, { borderRadius: 'lg' })))
            .children(
              stackLogo(
                h,
                RUNTIMES[stackOf(game, from).runtime].language,
                css({ width: '4', height: '4' }),
              ),
              h.span
                .class(css({ minWidth: '0', flex: '1', truncate: true, fontWeight: 'medium' }))
                .children(
                  sources.length > 1
                    ? sources.map((service) => serviceName(t, service)).join(' + ')
                    : serviceName(t, from),
                ),
              ...draft.kinds.map((kind) => packet(h, kind)),
            ),
          h.span.children(),
          h.div
            .attr('aria-hidden', 'true')
            .class(
              css({
                position: 'relative',
                display: 'flex',
                height: '4',
                alignItems: 'center',
                color: 'mutedForeground',
                '&::before': {
                  content: '""',
                  flex: '1',
                  borderTopWidth: '1.5px',
                  borderTopStyle: 'dashed',
                  borderTopColor: 'color-mix(in oklab, var(--foreground) 22%, transparent)',
                },
              }),
            )
            .children(
              icon(
                h,
                Scissors,
                css({
                  position: 'absolute',
                  left: '3',
                  width: '3.5',
                  height: '3.5',
                  paddingInline: '0.5',
                  backgroundColor: 'card',
                  boxSizing: 'content-box',
                }),
              ),
            ),
          h.span
            .class(cx(caption, css({ alignSelf: 'start', paddingTop: '2' })))
            .children(t.team.carveTo),
          targets.length === 0
            ? h.span
                .class(css({ fontSize: 'type.11-5', color: 'mutedForeground' }))
                .children(t.team.noCarveTarget)
            : h.div
                .attr('role', 'group')
                .attr('aria-label', t.team.carveOutTarget)
                .class(css({ display: 'flex', flexDirection: 'column', gap: '1.5' }))
                .children(...targets.map((target) => targetCard(model, target, h))),
        ),
      h.div
        .class(
          css({
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '2',
          }),
        )
        .children(
          button(
            h,
            {
              onClick: Message.TeamChanged({ message: TeamMessage.SplitChosen() }),
              isDisabled: refusal !== null,
              variant: refusal === null ? 'default' : 'outline',
              size: 'sm',
              attributes: {
                title:
                  refusal === null
                    ? t.team.moveFeaturesToCodebase
                    : splitWhy(t, game, draft, refusal),
              },
            },
            [
              icon(h, Scissors, css({ width: '3.5', height: '3.5' })),
              request === null
                ? t.team.carveOut
                : t.team.splitFor(t.units.devHours(splitCost(game, request))),
            ],
          ),
          draft.kinds.length > 0
            ? h.span
                .class(cx(FIGURE, css({ fontSize: 'type.11', color: 'mutedForeground' })))
                .children(t.team.carveShare(share, kloc.toFixed(1)))
            : undefined,
        ),
      refusal === null || draft.kinds.length === 0
        ? undefined
        : h.span
            .class(css({ fontSize: 'type.11', color: 'mutedForeground' }))
            .children(splitWhy(t, game, draft, refusal)),
    )
}

const servicesCard = (model: Model, h: H<Message>): Content => {
  const t = copy(h)

  const game = model.board.game
  const shared = game.services.filter((service) => sharesDatabase(game, service)).length
  const renaming = model.board.team.rename
  return h.section
    .key('services')
    .class(
      cx(
        PANEL,
        css({
          display: 'flex',
          flexShrink: '0',
          flexDirection: 'column',
          gap: '2.5',
          paddingInline: '4',
          paddingTop: '3.5',
          paddingBottom: '3',
        }),
      ),
    )
    .children(
      heading(
        t.team.services,
        h.span
          .class(
            cx(
              FIGURE,
              css({
                fontSize: 'type.11',
                color: 'mutedForeground',
              }),
            ),
          )
          .children(
            shared > 1
              ? t.team.codebasesOneDatabase(game.services.length)
              : t.team.codebases(game.services.length),
          ),
        h,
      ),
      ...game.services.map((service) => {
        const owner = ownerOf(game, service)
        const paged = activeIncident(game)?.service === service.id
        const databases = game.nodes.filter((node) => node.type === 'database')
        const editService =
          renaming !== null && renaming.target === 'service' && renaming.id === service.id
            ? renaming
            : null
        return fold(
          service.id,
          css(
            WELL_STYLE,
            {
              borderRadius: 'lg',
              '& > summary': {
                paddingInline: '2.5',
                paddingBlock: '2',
              },
            },
            paged && {
              boxShadow: 'dangerLine',
            },
          ),
          [
            h.div
              .class(
                css({
                  display: 'flex',
                  minWidth: '0',
                  flex: '1 1 0%',
                  flexDirection: 'column',
                  gap: '0.5',
                }),
              )
              .children(
                h.div
                  .class(
                    css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.5',
                    }),
                  )
                  .children(
                    editService
                      ? renameField(editService.draft, t.team.serviceNameLabel, service.name, h)
                      : h.span
                          .class(
                            css({
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontSize: 'type.12-5',
                              fontWeight: 'medium',
                            }),
                          )
                          .children(serviceName(t, service)),
                    editService
                      ? undefined
                      : iconButton(
                          t.team.renameService,
                          Pencil,
                          Message.TeamChanged({
                            message: TeamMessage.RenameStarted({
                              target: 'service',
                              id: service.id,
                            }),
                          }),
                          true,
                          h,
                        ),
                    paged && !editService
                      ? badge(
                          h,
                          {
                            variant: 'outline',
                            className: css({
                              color: 'danger',
                            }),
                          },
                          [t.team.paged],
                        )
                      : undefined,
                    game.teams.length > 1 && !editService
                      ? h.span
                          .attr('title', t.team.ownedBy(teamName(t, owner)))
                          .class(
                            css({
                              flexShrink: '0',
                              marginLeft: 'auto',
                              fontSize: 'type.11',
                              color: 'mutedForeground',
                            }),
                          )
                          .children(teamName(t, owner))
                      : undefined,
                  ),
                h.span
                  .class(
                    cx(
                      FIGURE,
                      css({
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 'type.10-5',
                        color: 'mutedForeground',
                      }),
                    ),
                  )
                  .children(
                    t.team.serviceLine(
                      service.codebase.toFixed(0),
                      Math.round(service.debt * 100),
                      t.units.perSecond(money(serviceBurnOf(game, ledgerOf(model), service))),
                    ),
                  ),
              ),
          ],
          h.dl
            .class(
              css({
                display: 'grid',
                gridTemplateColumns: 'max-content minmax(0, 1fr)',
                alignItems: 'baseline',
                columnGap: '4',
                rowGap: '2',
                marginInline: '2.5',
                marginBottom: '2.5',
                borderTopWidth: '1px',
                borderTopStyle: 'solid',
                borderTopColor: 'color-mix(in oklab, var(--foreground) 8%, transparent)',
                paddingTop: '2.5',
                paddingLeft: '5.5',
                fontSize: 'type.11',
              }),
            )
            .children(
              ...fact(
                t.team.features,
                service.features.length === 0
                  ? quiet(t.team.unclaimedFeatures, h)
                  : service.features.map((id) => t.catalog.features[id].name).join(', '),
                h,
              ),
              ...fact(
                t.team.nodes,
                nodeChips(nodesOfService(game, service.id), t.team.noneYet, game, h),
                h,
              ),
              ...fact(
                t.team.loadBalancers,
                nodeChips(loadBalancersOf(game, service.id), t.team.notBehindOne, game, h),
                h,
              ),
              ...(databases.length > 1
                ? fact(
                    t.team.datastore,
                    h.select
                      .attr('aria-label', t.team.datastore)
                      .on('change', ({ value: datastore }) =>
                        Message.TeamChanged({
                          message: TeamMessage.DatastoreChosen({
                            serviceId: service.id,
                            datastore: datastore === '' ? null : datastore,
                          }),
                        }),
                      )
                      .class(SERVICE_SELECT)
                      .children(
                        h.option
                          .attr('value', '')
                          .selected(service.datastore._tag === 'Auto')
                          .children(t.team.firstDatabase),
                        ...databases.map((node) =>
                          h.option
                            .attr('value', node.id)
                            .selected(
                              service.datastore._tag === 'Pinned' &&
                                service.datastore.id === node.id,
                            )
                            .children(nodeTitle(t, game, node)),
                        ),
                      ),
                    h,
                  )
                : []),
              ...(game.teams.length > 1
                ? fact(
                    t.team.team,
                    h.select
                      .attr('aria-label', t.team.teamThatOwns(serviceName(t, service)))
                      .on('change', ({ value: teamId }) =>
                        Message.TeamChanged({
                          message: TeamMessage.ServiceMoved({ serviceId: service.id, teamId }),
                        }),
                      )
                      .class(SERVICE_SELECT)
                      .children(
                        ...game.teams.map((entry) =>
                          h.option
                            .attr('value', entry.id)
                            .selected(entry.id === service.owner)
                            .children(teamName(t, entry)),
                        ),
                      ),
                    h,
                  )
                : []),
            ),
          h,
        )
      }),
      has(game, 'service-carve-out')
        ? fold(
            'split',
            css({
              borderRadius: 'lg',
              borderWidth: '1px',
              borderStyle: 'dashed',
              borderColor: 'color-mix(in oklab, var(--foreground) 18%, transparent)',
              '& > summary': {
                paddingInline: '2.5',
                paddingBlock: '2',
              },
            }),
            [
              h.span
                .class(
                  css({
                    display: 'flex',
                    height: '6',
                    alignItems: 'center',
                    gap: '1.5',
                    fontSize: 'type.12',
                    fontWeight: 'medium',
                  }),
                )
                .children(
                  icon(h, Scissors, css({ width: '3.5', height: '3.5', color: 'primary' })),
                  t.team.splitAService,
                ),
            ],
            carveOut(model, h),
            h,
          )
        : h.div
            .class(
              css({
                display: 'flex',
                alignItems: 'center',
                gap: '1.5',
                fontSize: 'type.11-5',
                color: 'mutedForeground',
              }),
            )
            .children(
              icon(
                h,
                Lock,
                css({
                  width: '3',
                  height: '3',
                  flexShrink: '0',
                }),
              ),
              t.team.serviceBoundariesSplits(
                t.catalog.research['service-carve-out'].name,
                t.catalog.eras[RESEARCH['service-carve-out'].era]?.name ?? '',
              ),
            ),
    )
}

const doraCard = (game: Game, h: H<Message>): Child => {
  const t = copy(h)

  if (game.sandbox || !pipelineOf(game)) return undefined
  const dora = doraMetrics(game)
  const stat = (label: string, value: string): Content =>
    h.div
      .class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1',
          minWidth: '0',
        }),
      )
      .children(
        h.span.class(EYEBROW).children(label),
        h.span
          .class(
            cx(
              FIGURE,
              css({
                fontSize: 'type.16',
              }),
            ),
          )
          .children(value),
      )
  return h.section
    .key('dora')
    .class(
      cx(
        PANEL,
        css({
          display: 'flex',
          flexShrink: '0',
          flexDirection: 'column',
          gap: '2.5',
          paddingInline: '4',
          paddingTop: '3.5',
          paddingBottom: '3',
        }),
      ),
    )
    .children(
      heading(t.team.dORAMetrics, undefined, h),
      h.div
        .class(
          css({
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            columnGap: '4',
            rowGap: '3.5',
          }),
        )
        .children(
          stat(t.team.deployFrequency, t.team.perDay(dora.deploysPerDay.toFixed(1))),
          stat(t.team.leadTime, wait(t, dora.leadTime)),
          stat(t.team.changeFailureRate, `${Math.round(dora.changeFailureRate * 100)}%`),
          stat(t.team.mttr, dora.mttr === null ? '—' : wait(t, dora.mttr)),
        ),
    )
}

const moraleCard = (game: Game, team: Team, h: H<Message>): Child => {
  const t = copy(h)

  if (game.sandbox || game.stage < 1) return undefined
  const members = membersOf(game, team)
  const price = offsiteCost(game, team)
  const hit = game.time < game.moraleUntil && game.time >= team.offsiteUntil
  const moraleDays = daysUntil(game, game.moraleUntil)
  const cooling = game.time < team.offsiteReadyAt
  const cooldown = daysUntil(game, team.offsiteReadyAt)
  const unhappyCount = members.filter(unhappy).length
  const slumpingCount =
    members.filter((engineer) => engineer.mood < CONTENT_MOOD).length - unhappyCount
  const needsMood = members.some((engineer) => engineer.mood < CONTENT_MOOD)
  const staffed = team.id === game.teams[0]?.id || members.length > 0
  const needs = staffed && (hit || needsMood)
  const affordable = game.cash >= price
  const enabled = needs && !cooling && affordable
  const mood =
    members.length === 0
      ? t.team.noEngineers
      : unhappyCount > 0
        ? t.team.engineersUnhappy(unhappyCount)
        : slumpingCount > 0
          ? t.team.engineersSlumping(slumpingCount)
          : t.team.everyoneContent
  const moodTone: 'danger' | 'warn' | 'mutedForeground' =
    unhappyCount > 0 ? 'danger' : slumpingCount > 0 ? 'warn' : 'mutedForeground'
  const why = !staffed
    ? t.team.offsiteNeeds
    : !affordable
      ? t.team.offsiteShort
      : t.team.offsiteEffect
  const label = cooling
    ? t.team.nextOffsite(t.units.d(cooldown))
    : !staffed
      ? t.team.offsiteNeeds
      : t.team.teamOffsite(money(price))
  return h.div
    .key(`morale-${team.id}`)
    .class(
      cx(
        WELL,
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '2',
          borderRadius: 'lg',
          padding: '2.5',
        }),
      ),
    )
    .children(
      heading(
        t.team.morale,
        h.span
          .class(
            cx(
              FIGURE,
              css({
                fontSize: 'type.12',
                color: hit ? 'warn' : 'mutedForeground',
              }),
            ),
          )
          .children(
            hit
              ? t.team.moraleHit(Math.round((1 - LAYOFF_MORALE) * 100), t.units.d(moraleDays))
              : t.team.moraleSteady,
          ),
        h,
      ),
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '2',
            paddingInline: '1',
          }),
        )
        .children(
          h.span.class(EYEBROW).children(t.team.mood),
          h.span
            .class(
              cx(
                FIGURE,
                css({
                  fontSize: 'type.12',
                  color: moodTone,
                }),
              ),
            )
            .children(mood),
        ),
      button(
        h,
        {
          onClick: Message.TeamChanged({
            message: TeamMessage.OffsiteChosen({ teamId: team.id }),
          }),
          isDisabled: !enabled,
          variant: 'default',
          size: 'lg',
          className: css({
            width: '100%',
            justifyContent: 'center',
          }),
          attributes: { title: why },
        },
        label,
      ),
    )
}

const floor = (model: Model, h: H<Message>): Content => {
  const t = copy(h)

  const game = model.board.game
  return h.div
    .class(
      cx(
        css({
          display: 'flex',
          minHeight: '0',
          flexDirection: 'column',
          gap: '3',
          padding: '4',
        }),
        SCROLL,
        css({
          _compact: {
            overflow: 'visible',
          },
        }),
      ),
    )
    .attr('data-team-drag-floor', '')
    .attr('data-team-drag-active', dragIsActive(model.board.team.drag) ? '' : undefined)
    .onMount(TeamDrag({}))
    .children(
      game.sandbox ? undefined : servicesCard(model, h),
      doraCard(game, h),
      ...game.teams.map((team, index) => pod(model, team, index, h)),
      Option.match(dragGhostStyle(model.board.team.drag), {
        onNone: () => undefined,
        onSome: (style) =>
          Option.match(dragItemId(model.board.team.drag), {
            onNone: () => undefined,
            onSome: (id) =>
              h.div
                .style(style)
                .class(
                  cx(
                    PANEL,
                    css({
                      pointerEvents: 'none',
                      zIndex: '50',
                      paddingInline: '4',
                      paddingBlock: '3',
                      fontSize: 'type.14',
                      lineHeight: 'fine',
                      fontWeight: 'medium',
                    }),
                  ),
                )
                .children(nameOf(id)),
          }),
      }),
      game.stage >= 1 && game.teams.length < MAX_TEAMS
        ? h.button
            .key('new-team')
            .attr('type', 'button')
            .on('click', () => Message.TeamChanged({ message: TeamMessage.Created() }))
            .class(
              cx(
                css({
                  display: 'flex',
                  height: '12',
                  flexShrink: '0',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2',
                  borderRadius: '2xl',
                  borderWidth: '1.5px',
                  borderStyle: 'dashed',
                  borderColor: 'color-mix(in oklab, var(--foreground) 20%, transparent)',
                  fontSize: 'type.13',
                  fontWeight: 'medium',
                  color: 'mutedForeground',
                  _hover: {
                    borderColor: 'color-mix(in oklab, var(--foreground) 40%, transparent)',
                    color: 'foreground',
                  },
                }),
                'press',
              ),
            )
            .children(
              icon(
                h,
                Plus,
                css({
                  width: '4',
                  height: '4',
                }),
              ),
              t.team.newTeam,
            )
        : undefined,
    )
}

const stackName = (t: Messages, runtime: RuntimeId, framework: FrameworkId): string =>
  `${t.catalog.runtimes[runtime].name}${framework === 'none' ? '' : ` · ${t.catalog.frameworks[framework].name}`}`

const migrationCard = (game: Game, h: H<Message>): Child => {
  const t = copy(h)

  const migration = serviceOf(game).migration
  if (migration._tag === 'Idle') return undefined
  const shifted = stepOf(migration)
  const steps = stepsOf(migration)
  const done = migration._tag === 'Finishing'
  const current = shifted > 0 ? (steps[shifted - 1] ?? 1) : 0
  const next = steps[shifted] ?? 1
  const language = RUNTIMES[migration.runtime].language
  const brand = STACK_LOGOS[language].color ?? 'var(--group-compute)'
  const step = game.backlog.find((item) => item.kind === 'migration')
  const percent = (share: number) => `${Math.round(share * 100)}%`
  return h.section
    .key('migration')
    .class(
      cx(
        PANEL,
        css({
          display: 'flex',
          flexShrink: '0',
          flexDirection: 'column',
          gap: '3',
          paddingInline: '4',
          paddingTop: '3.5',
          paddingBottom: '3',
        }),
      ),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: '3',
            rowGap: '2',
          }),
        )
        .children(
          h.div
            .class(
              css({
                display: 'flex',
                minWidth: '0',
                flex: '1 1 0%',
                alignItems: 'center',
                gap: '2.5',
              }),
            )
            .children(
              h.span
                .class(
                  css({
                    opacity: 0.45,
                    filter: 'grayscale(100%)',
                  }),
                )
                .children(
                  stackLogo(
                    h,
                    RUNTIMES[migration.fromRuntime].language,
                    css({
                      width: '5',
                      height: '5',
                    }),
                  ),
                ),
              h.span
                .class(
                  css({
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 'type.13',
                    color: 'mutedForeground',
                    textDecorationLine: 'line-through',
                    textDecorationColor: 'color-mix(in oklab, var(--foreground) 25%, transparent)',
                  }),
                )
                .children(stackName(t, migration.fromRuntime, migration.fromFramework)),
              icon(
                h,
                ArrowRight,
                css({
                  width: '3.5',
                  height: '3.5',
                  flexShrink: '0',
                  color: 'mutedForeground',
                }),
              ),
              stackLogo(
                h,
                language,
                css({
                  width: '5',
                  height: '5',
                }),
              ),
              h.span
                .class(
                  css({
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 'type.15',
                    fontWeight: 'semibold',
                    letterSpacing: 'body',
                  }),
                )
                .children(stackName(t, migration.runtime, migration.framework)),
              migration.bugs
                ? badge(h, { variant: 'destructive' }, [
                    icon(
                      h,
                      Bug,
                      css({
                        width: '3',
                        height: '3',
                      }),
                    ),
                    t.team.bugs,
                  ])
                : undefined,
            ),
          done
            ? badge(h, { variant: 'secondary' }, [
                icon(
                  h,
                  Check,
                  css({
                    width: '3',
                    height: '3',
                  }),
                ),
                t.team.migrated,
              ])
            : h.div
                .class(
                  css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2',
                  }),
                )
                .children(
                  h.span
                    .class(
                      cx(
                        FIGURE,
                        css({
                          fontSize: 'type.11-5',
                          color: 'mutedForeground',
                        }),
                      ),
                    )
                    .children(
                      isReady(migration)
                        ? t.team.ready
                        : step
                          ? `${codeOf('migration', step.ref)} · ${amount(step.spent)}/${dh(t, step.cost)}`
                          : '',
                    ),
                  button(
                    h,
                    { onClick: Message.MigrationCancelled(), variant: 'ghost', size: 'sm' },
                    t.team.cancel,
                  ),
                  button(
                    h,
                    {
                      onClick: Message.MigrationShifted(),
                      isDisabled: !isReady(migration),
                      size: 'sm',
                    },
                    [
                      icon(
                        h,
                        ArrowRight,
                        css({
                          width: '3.5',
                          height: '3.5',
                        }),
                      ),
                      t.team.shiftTo(percent(next)),
                    ],
                  ),
                ),
        ),
      h.div
        .class(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '1',
          }),
        )
        .children(
          h.div
            .class(
              css(
                {
                  position: 'relative',
                  height: '7',
                  overflow: 'hidden',
                },
                WELL_STYLE,
                {
                  borderRadius: 'lg',
                },
              ),
            )
            .children(
              done
                ? undefined
                : h.div
                    .class(
                      css({
                        position: 'absolute',
                        inset: '0',
                        transitionProperty: 'clip-path',
                        transitionDuration: 'slowest',
                        transitionTimingFunction: 'out',
                      }),
                    )
                    .style({
                      backgroundColor: `color-mix(in oklch, ${brand} ${isReady(migration) ? 45 : 18}%, transparent)`,
                      backgroundImage: STRIPES,
                      clipPath: `inset(0 ${(1 - next) * 100}% 0 0)`,
                    })
                    .children(),
              h.div
                .class(
                  css({
                    position: 'absolute',
                    inset: '0',
                    boxShadow: 'highlightTop',
                    transitionProperty: 'clip-path',
                    transitionDuration: 'glacial',
                    transitionTimingFunction: 'in-out',
                  }),
                )
                .style({
                  backgroundColor: brand,
                  clipPath: `inset(0 ${(1 - current) * 100}% 0 0 round 8px)`,
                })
                .children(),
              ...steps.slice(0, -1).map((share, at) =>
                h.div
                  .key(`tick-${at}`)
                  .class(
                    css({
                      position: 'absolute',
                      insetBlock: '0',
                      width: '1px',
                      backgroundColor: 'color-mix(in oklab, var(--foreground) 15%, transparent)',
                    }),
                  )
                  .style({ left: `${share * 100}%` })
                  .children(),
              ),
              h.span
                .class(
                  cx(
                    FIGURE,
                    css({
                      position: 'absolute',
                      insetBlock: '0',
                      right: '2.5',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 'type.11',
                      color: 'mutedForeground',
                    }),
                  ),
                )
                .children(
                  migration.scope === 'worker'
                    ? t.team.ofWorkers(percent(current))
                    : t.team.ofTraffic(percent(current)),
                ),
            ),
          h.div
            .class(
              css({
                position: 'relative',
                height: '3.5',
              }),
            )
            .children(
              ...steps.map((share, at) =>
                h.span
                  .key(`label-${at}`)
                  .class(
                    cx(
                      FIGURE,
                      css({
                        position: 'absolute',
                        top: '0',
                        fontSize: 'type.10',
                      }),
                      at < shifted
                        ? css({
                            color: 'foreground',
                          })
                        : css({
                            color: 'mutedForeground',
                          }),
                      share >= 1
                        ? css({
                            translate: '-100% 0',
                          })
                        : css({
                            translate: '-50% 0',
                          }),
                    ),
                  )
                  .style({ left: `${share * 100}%` })
                  .children(percent(share)),
              ),
            ),
        ),
    )
}

type Status = 'queued' | 'building' | 'shipping' | 'live'

const statusMark = (status: Status, share: number, h: H<Message>): Content => {
  const pie = 2 * Math.PI * 2.5
  const tone =
    status === 'building'
      ? css({ color: 'warn' })
      : status === 'queued'
        ? css({ color: 'mutedForeground' })
        : css({ color: 'ok' })
  return h.svg
    .attr('aria-hidden', 'true')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('viewBox', '0 0 14 14')
    .attr('fill', 'none')
    .class(
      cx(
        css({
          width: '3.5',
          height: '3.5',
          flexShrink: '0',
        }),
        tone,
      ),
    )
    .children(
      ...(status === 'live'
        ? [
            h.circle
              .attr('cx', '7')
              .attr('cy', '7')
              .attr('r', '6.5')
              .attr('fill', 'currentColor')
              .children(),
            h.path
              .attr('d', 'M4.3 7.2 6.2 9 9.8 5.2')
              .attr('stroke', 'white')
              .attr('stroke-width', '1.5')
              .attr('stroke-linecap', 'round')
              .attr('stroke-linejoin', 'round')
              .children(),
          ]
        : [
            h.circle
              .attr('cx', '7')
              .attr('cy', '7')
              .attr('r', '6')
              .attr('stroke', 'currentColor')
              .attr('stroke-width', '1.5')
              .attr('stroke-dasharray', status === 'queued' ? '1.6 1.9' : undefined)
              .children(),
            status === 'queued'
              ? undefined
              : h.circle
                  .attr('cx', '7')
                  .attr('cy', '7')
                  .attr('r', '2.5')
                  .attr('stroke', 'currentColor')
                  .attr('stroke-width', '5')
                  .attr('stroke-dasharray', `${pie * clamp(share)} ${pie}`)
                  .attr('transform', 'rotate(-90 7 7)')
                  .children(),
          ]),
    )
}

const codeOf = (kind: WorkKind, ref: string): string => {
  if (kind === 'feature') return `FEAT-${FEATURE_IDS.indexOf(ref as FeatureId) + 1}`
  if (kind === 'task') return `ENG-${TASK_IDS.indexOf(ref as TaskId) + 1}`
  if (kind === 'patch') return `SEC-${ref.slice(-4)}`
  if (kind === 'move') return ref === 'auth' ? 'MOV-1' : 'MOV-2'
  if (kind === 'split') return `SVC-${ref.replace(/\D/g, '') || '2'}`
  if (kind === 'lever') return `LVG-${LEVER_KINDS.indexOf(ref as LeverKind) + 1}`
  return `MIG-${ref.replace(/\D/g, '') || '1'}`
}

const label = (kind: WorkKind, h: H<Message>): Content => {
  const t = copy(h)
  return h.span
    .class(
      css({
        display: 'inline-flex',
        height: '5',
        alignItems: 'center',
        gap: '1',
        borderRadius: 'full',
        paddingInline: '1.5',
        fontSize: 'type.10-5',
        fontWeight: 'medium',
        color: 'mutedForeground',
        boxShadow: 'line',
      }),
    )
    .children(
      h.span
        .class(
          cx(
            css({
              width: '1.5',
              height: '1.5',
              borderRadius: 'full',
            }),
            kindOf(t)[kind].fill,
          ),
        )
        .children(),
      kindOf(t)[kind].label,
    )
}

const waitOf = (t: Messages): Record<BlockKind, string> => ({
  decision: t.team.waitForDecision,
  index: t.team.waitForIndex,
  copy: t.team.waitForCopy,
  size: t.team.waitForSize,
})

const waitChip = (item: WorkItem, h: H<Message>): Content | null => {
  if (item.block._tag !== 'Blocked' || item.kind === 'patch') return null
  const t = copy(h)
  return h.span
    .class(
      css({
        display: 'inline-flex',
        height: '5',
        alignItems: 'center',
        gap: '1',
        borderRadius: 'full',
        paddingInline: '1.5',
        fontSize: 'type.10-5',
        fontWeight: 'medium',
        color: 'warn',
        boxShadow: 'line',
      }),
    )
    .children(
      icon(
        h,
        Hourglass,
        css({
          width: '3',
          height: '3',
        }),
      ),
      t.team.waitingOnYou(waitOf(t)[item.block.reason]),
    )
}

const waitingFor = (game: Game, team: Team): number =>
  game.backlog.filter((item) => item.block._tag === 'Blocked' && worksOn(game, team, item)).length

const featureReadout = (game: Game, id: FeatureId, h: H<Message>): Content => {
  const t = copy(h)

  const adopted = Math.round(adoptionShareOf(game, id) * 100)
  const reading = liftReading(game, id)
  const lift = reading
    ? t.team.lift(
        `${reading.lift >= 0 ? '+' : ''}${Math.round(reading.lift * 100)}%`,
        Number.isFinite(reading.halfWidth) ? Math.round(reading.halfWidth * 100) : '—',
        reading.verdict === 'wins'
          ? t.team.wins
          : reading.verdict === 'loses'
            ? t.team.loses
            : t.team.tooEarly,
      )
    : null
  return h.span
    .class(
      css({
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '1',
      }),
    )
    .children(
      badge(h, { variant: 'secondary' }, [t.team.adopted(adopted)]),
      ...(lift ? [badge(h, { variant: 'secondary' }, [lift])] : []),
    )
}

const upkeepPill = (game: Game, h: H<Message>): Child => {
  const t = copy(h)

  const share = upkeepShare(game, serviceOf(game))
  if (share <= 0) return undefined
  return h.div
    .key('upkeep')
    .class(
      cx(
        css({
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          borderRadius: 'lg',
          paddingInline: '2.5',
          paddingBlock: '2',
          fontSize: 'type.11-5',
          color: 'mutedForeground',
          boxShadow: 'line',
        }),
      ),
    )
    .children(
      h.span
        .class(
          css({
            flex: '1 1 0%',
          }),
        )
        .children(t.team.upkeep),
      h.span.class(FIGURE).children(t.team.shareOfDevHours(Math.round(share * 100))),
    )
}

const deadline = (game: Game, item: WorkItem, h: H<Message>): Child => {
  const t = copy(h)

  if (item.due === undefined) return undefined
  const late = overdueBy(game, item)
  return h.span
    .class(
      cx(
        FIGURE,
        css({
          display: 'inline-flex',
          height: '5',
          alignItems: 'center',
          borderRadius: 'full',
          paddingInline: '1.5',
          fontSize: 'type.10-5',
          fontWeight: 'medium',
          whiteSpace: 'nowrap',
        }),
        late > 0
          ? css({
              backgroundColor: 'danger',
              color: 'white',
            })
          : css({
              color: 'mutedForeground',
              boxShadow: 'line',
            }),
      ),
    )
    .children(
      late > 0
        ? t.team.exploitIn(wait(t, PATCH_GRACE - late))
        : t.team.dueIn(wait(t, item.due - game.time)),
    )
}

const estimate = (text: string, h: H<Message>): Content =>
  h.span
    .class(
      cx(
        FIGURE,
        css({
          display: 'inline-flex',
          height: '5',
          alignItems: 'center',
          borderRadius: 'full',
          paddingInline: '1.5',
          fontSize: 'type.10-5',
          whiteSpace: 'nowrap',
          color: 'mutedForeground',
          boxShadow: 'line',
        }),
      ),
    )
    .children(text)

const mini = (id: string | null, h: H<Message>): Content => {
  const t = copy(h)
  return h.span
    .key(id ?? 'founder')
    .attr('title', id ? nameOf(id) : t.team.you)
    .class(
      cx(
        css({
          display: 'grid',
          width: '5',
          height: '5',
          flexShrink: '0',
          placeItems: 'center',
          borderRadius: 'full',
          fontSize: 'type.9-5',
          fontWeight: 'semibold',
          color: 'white',
          boxShadow: 'cardRing',
          '&:not(:first-child)': { marginLeft: '-0.375rem' },
        }),
        id === null &&
          css({
            layerStyle: 'primaryFill',
            color: 'onPrimaryFill',
          }),
      ),
    )
    .style(id === null ? {} : { backgroundColor: `oklch(0.64 0.14 ${hueOf(id)})` })
    .children(
      id
        ? nameOf(id).slice(0, 1)
        : icon(
            h,
            Crown,
            css({
              width: '2.5',
              height: '2.5',
            }),
          ),
    )
}

const assignees = (game: Game, team: Team, h: H<Message>): Content => {
  const t = copy(h)
  const people: ReadonlyArray<string | null> = [
    ...(game.teams[0]?.id === team.id ? [null] : []),
    ...membersOf(game, team).map((engineer) => engineer.id),
  ]
  const shown = people.slice(0, 4)
  return h.span
    .class(
      css({
        display: 'flex',
        alignItems: 'center',
      }),
    )
    .attr('title', t.team.labelColon(teamName(t, team)) + ` ${people.length}`)
    .children(
      ...shown.map((id) => mini(id, h)),
      people.length > shown.length
        ? h.span
            .class(
              cx(
                FIGURE,
                css({
                  marginLeft: '1',
                  fontSize: 'type.10-5',
                  color: 'mutedForeground',
                }),
              ),
            )
            .children(`+${people.length - shown.length}`)
        : undefined,
    )
}

const unassigned = (h: H<Message>): Content => {
  const t = copy(h)
  return h.span
    .attr('title', t.team.unassigned)
    .class(
      css({
        width: '5',
        height: '5',
        borderRadius: 'full',
        borderWidth: '1.5px',
        borderStyle: 'dashed',
        borderColor: 'color-mix(in oklab, var(--foreground) 25%, transparent)',
      }),
    )
    .children()
}

const card = (
  key: string,
  code: string,
  title: string,
  status: Status,
  share: number,
  owner: Child,
  chips: ReadonlyArray<Child>,
  actions: ReadonlyArray<Child>,
  late: boolean,
  h: H<Message>,
): Content =>
  h.div
    .key(key)
    .class(
      cx(
        late &&
          css({
            boxShadow: 'dangerRing',
          }),
        cx(
          css({
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '2',
            borderRadius: 'lg',
            backgroundColor: 'card',
            paddingInline: '3',
            paddingBlock: '2.5',
            boxShadow: 'hoverCard',
            transitionProperty: 'box-shadow',
            transitionDuration: 'fast',
            transitionTimingFunction: 'out',
            _hover: {
              boxShadow: 'hoverCardStrong',
            },
          }),
          'group',
        ),
        status === 'live' &&
          css({
            backgroundColor: 'transparent',
            boxShadow: 'edge',
          }),
      ),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
          }),
        )
        .children(
          h.span
            .class(
              cx(
                FIGURE,
                css({
                  flex: '1 1 0%',
                  fontSize: 'type.11',
                  color: 'mutedForeground',
                }),
              ),
            )
            .children(code),
          owner,
        ),
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'flex-start',
            gap: '2',
          }),
        )
        .children(
          h.span
            .class(
              css({
                marginTop: '2px',
              }),
            )
            .children(statusMark(status, share, h)),
          h.span
            .class(
              cx(
                css({
                  lineClamp: 2,
                  fontSize: 'type.13',
                  lineHeight: 'dense',
                  fontWeight: 'medium',
                }),
                status === 'live' &&
                  css({
                    color: 'mutedForeground',
                  }),
              ),
            )
            .children(title),
        ),
      chips.length > 0
        ? h.div
            .class(
              css({
                display: 'flex',
                minHeight: '5',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: '1',
              }),
            )
            .children(...chips)
        : undefined,
      actions.length > 0
        ? h.div
            .class(
              css({
                position: 'absolute',
                top: '1.5',
                right: '1.5',
                display: 'flex',
                alignItems: 'center',
                borderRadius: 'lg',
                backgroundColor: 'card',
                padding: '0.5',
                opacity: 0,
                boxShadow: 'hoverCardElevated',
                transitionProperty: 'opacity',
                transitionDuration: 'fast',
                transitionTimingFunction: 'out',
                '.group:hover &': {
                  opacity: 1,
                },
                '.group:focus-within &': {
                  opacity: 1,
                },
              }),
            )
            .children(...actions)
        : undefined,
    )

const rush = (game: Game, item: WorkItem, h: H<Message>): Content => {
  const t = copy(h)
  const label = t.team.rushWith(dh(t, game.devHours), sharePercent(rushDebtOf(item, game.devHours)))
  const risk = rushBugOf(game, item, game.devHours)
  return iconButton(
    risk > 0 ? `${label} · ${t.team.rushBug(sharePercent(risk))}` : label,
    Zap,
    Message.WorkRushed({ id: item.id }),
    game.devHours >= 0.1,
    h,
  )
}

const cancel = (item: WorkItem, h: H<Message>): Child => {
  const t = copy(h)
  return item.kind === 'migration' || item.ref === 'fix-bugs'
    ? undefined
    : iconButton(t.team.cancel, X, Message.WorkCancelled({ id: item.id }), true, h)
}

const backlogCard = (
  game: Game,
  item: WorkItem,
  index: number,
  team: Team | undefined,
  h: H<Message>,
): Content => {
  const t = copy(h)

  const share = clamp(item.spent / item.cost)
  const late = overdueBy(game, item) > 0
  const waiting = waitChip(item, h)
  return card(
    `item-${item.id}`,
    codeOf(item.kind, item.ref),
    workItemName(t, item),
    team ? 'building' : 'queued',
    share,
    team ? assignees(game, team, h) : unassigned(h),
    [
      label(item.kind, h),
      ...(waiting ? [waiting] : []),
      estimate(
        team || item.spent > 0 ? `${amount(item.spent)}/${dh(t, item.cost)}` : dh(t, item.cost),
        h,
      ),
      deadline(game, item, h),
    ],
    [
      item.block._tag === 'Blocked'
        ? iconButton(t.team.approve, Check, Message.WorkApproved({ id: item.id }), true, h)
        : undefined,
      item.block._tag === 'Held'
        ? iconButton(t.team.resume, Play, Message.WorkResumed({ id: item.id }), true, h)
        : undefined,
      team
        ? undefined
        : iconButton(
            t.team.up,
            ArrowUp,
            Message.WorkMoved({ id: item.id, direction: -1 }),
            index > 0,
            h,
          ),
      team
        ? undefined
        : iconButton(
            t.team.down,
            ArrowDown,
            Message.WorkMoved({ id: item.id, direction: 1 }),
            index < game.backlog.length - 1,
            h,
          ),
      rush(game, item, h),
      cancel(item, h),
    ],
    late,
    h,
  )
}

const idleCard = (game: Game, team: Team, h: H<Message>): Content => {
  const t = copy(h)
  const waits = waitingFor(game, team)
  return h.div
    .key(`idle-${team.id}`)
    .class(
      css({
        display: 'flex',
        alignItems: 'center',
        gap: '2',
        borderRadius: 'lg',
        borderWidth: '1.5px',
        borderStyle: 'dashed',
        borderColor: 'color-mix(in oklab, var(--foreground) 15%, transparent)',
        paddingInline: '3',
        paddingBlock: '2.5',
      }),
    )
    .children(
      assignees(game, team, h),
      h.span
        .class(
          css({
            minWidth: '0',
            flex: '1 1 0%',
            fontSize: 'type.12-5',
            lineHeight: 'snug',
            color: 'mutedForeground',
          }),
        )
        .children(
          game.teams[0]?.id === team.id || membersOf(game, team).length > 0
            ? waits > 0
              ? t.team.idleOnYou(teamName(t, team), waits)
              : t.team.idle(teamName(t, team))
            : t.team.noEngineersOn(teamName(t, team)),
        ),
    )
}

const column = (
  key: string,
  status: Status,
  title: string,
  count: number,
  top: Child,
  cards: ReadonlyArray<Child>,
  h: H<Message>,
): Content =>
  h.div
    .key(key)
    .class(
      css({
        display: 'flex',
        minHeight: '260px',
        minWidth: '0',
        flexDirection: 'column',
        gap: '1.5',
        borderRadius: 'xl',
        backgroundColor: 'color-mix(in oklab, var(--foreground) 2.8000000000000003%, transparent)',
        padding: '1.5',
      }),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            paddingInline: '1.5',
            paddingTop: '1',
            paddingBottom: '1',
          }),
        )
        .children(
          statusMark(status, status === 'building' ? 0.5 : 1, h),
          h.span
            .class(
              css({
                fontSize: 'type.12-5',
                fontWeight: 'medium',
              }),
            )
            .children(title),
          h.span
            .class(
              cx(
                FIGURE,
                css({
                  fontSize: 'type.12',
                  color: 'mutedForeground',
                }),
              ),
            )
            .children(String(count)),
        ),
      top,
      ...cards,
    )

const deployPill = (game: Game, h: H<Message>): Content => {
  const t = copy(h)

  const built = awaitingFeatures(game).length
  const left = serviceOf(game).nextDeployAt - game.time
  const chance = nextBadDeployChance(game)
  const stalled = activeIncident(game)?.kind === 'bad-deploy'
  return h.div
    .key('deploy')
    .class(
      cx(
        css({
          display: 'flex',
          alignItems: 'center',
          gap: '2.5',
          borderRadius: 'lg',
          paddingInline: '2.5',
          paddingBlock: '2',
        }),
        built > 0
          ? css({
              layerStyle: 'primaryFill',
              color: 'onPrimaryFill',
              boxShadow: 'primary',
            })
          : css({
              color: 'mutedForeground',
              boxShadow: 'line',
            }),
      ),
    )
    .children(
      h.span
        .class(
          cx(
            css({
              position: 'relative',
              display: 'grid',
              width: '8',
              height: '8',
              flexShrink: '0',
              placeItems: 'center',
              borderRadius: 'full',
            }),
            built > 0 && !stalled
              ? css({
                  backgroundColor: 'ok',
                  color: 'white',
                })
              : stalled
                ? css({
                    backgroundColor: 'danger',
                    color: 'white',
                  })
                : css({
                    backgroundColor: 'well',
                  }),
          ),
        )
        .children(
          icon(
            h,
            Rocket,
            css({
              width: '3.5',
              height: '3.5',
            }),
          ),
          built > 0 && !stalled
            ? h.span
                .class(
                  css({
                    position: 'absolute',
                    inset: '-3px',
                  }),
                )
                .children(
                  ring(
                    h,
                    1 - left / deployEvery(game),
                    css({
                      width: '38px',
                      height: '38px',
                      color: 'ok',
                    }),
                  ),
                )
            : undefined,
        ),
      h.div
        .class(
          css({
            display: 'flex',
            minWidth: '0',
            flexDirection: 'column',
          }),
        )
        .children(
          h.span
            .class(
              css({
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 'type.12-5',
                fontWeight: 'medium',
              }),
            )
            .children(
              built === 0
                ? t.team.nothingToShip
                : stalled
                  ? t.team.held
                  : t.team.deployIn(wait(t, left)),
            ),
          chance > 0
            ? h.span
                .attr('title', t.team.chanceADeployShipsABug)
                .class(
                  cx(
                    FIGURE,
                    css({
                      fontSize: 'type.10-5',
                    }),
                    chance >= 0.15
                      ? css({
                          color: 'warn',
                        })
                      : css({
                          opacity: 0.6,
                        }),
                  ),
                )
                .children(t.team.badDeploys(Math.round(chance * 100)))
            : undefined,
        ),
    )
}

const LIVE_SHOWN = 4

const board = (game: Game, h: H<Message>): Content => {
  const t = copy(h)

  const assigned = assignments(game)
  const building = new Set([...assigned.values()].map((item) => item.id))
  const queue = game.backlog.filter((item) => !building.has(item.id))
  const builders = game.teams.filter((team) => team.kind === 'product')
  const live = [...liveFeatures(game)].reverse()
  return h.div
    .class(
      css({
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '2',
        _narrow: {
          gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
        },
      }),
    )
    .children(
      column(
        'queued',
        'queued',
        t.team.upNext,
        queue.length,
        undefined,
        queue.map((item) => backlogCard(game, item, game.backlog.indexOf(item), undefined, h)),
        h,
      ),
      column(
        'building',
        'building',
        t.team.inProgress,
        building.size,
        undefined,
        builders.map((team) => {
          const item = assigned.get(team.id)
          return item
            ? backlogCard(game, item, game.backlog.indexOf(item), team, h)
            : idleCard(game, team, h)
        }),
        h,
      ),
      column(
        'shipping',
        'shipping',
        t.team.shipping,
        awaitingFeatures(game).length,
        deployPill(game, h),
        awaitingFeatures(game).map((id) =>
          card(
            `built-${id}`,
            codeOf('feature', id),
            t.catalog.features[id].name,
            'shipping',
            1,
            undefined,
            [label('feature', h)],
            [],
            false,
            h,
          ),
        ),
        h,
      ),
      column(
        'live',
        'live',
        t.team.live,
        live.length,
        upkeepPill(game, h),
        [
          ...live
            .slice(0, LIVE_SHOWN)
            .map((id) =>
              card(
                `live-${id}`,
                codeOf('feature', id),
                t.catalog.features[id].name,
                'live',
                1,
                undefined,
                [featureReadout(game, id, h)],
                [
                  iconButton(
                    t.team.removeFeature,
                    Trash2,
                    Message.TeamChanged({ message: TeamMessage.FeatureRemoved({ id }) }),
                    removeRefusal(game, id) === null,
                    h,
                    css({ color: 'danger' }),
                  ),
                ],
                false,
                h,
              ),
            ),
          live.length > LIVE_SHOWN
            ? h.span
                .key('more')
                .class(
                  cx(
                    FIGURE,
                    css({
                      paddingInline: '2',
                      paddingBlock: '1',
                      fontSize: 'type.11',
                      color: 'mutedForeground',
                    }),
                  ),
                )
                .children(t.team.more(live.length - LIVE_SHOWN))
            : undefined,
        ],
        h,
      ),
    )
}

const autopilot = (model: Model, h: H<Message>): Content => {
  const t = copy(h)

  const game = model.board.game
  return h.button
    .attr('type', 'button')
    .attr('role', 'switch')
    .attr('aria-checked', String(game.autopilot))
    .on('click', () => Message.AutopilotToggled())
    .class(
      cx(
        cx(
          css({
            display: 'inline-flex',
            height: '7',
            alignItems: 'center',
            gap: '1.5',
            borderRadius: 'full',
            paddingRight: '1',
            paddingLeft: '2.5',
            fontSize: 'type.11-5',
            fontWeight: 'medium',
          }),
          'press',
          'enter-pop',
        ),
        glowing(model, 'autopilot') && 'cue-glow',
        !shown(model, 'autopilot') &&
          css({
            display: 'none',
          }),
        game.autopilot
          ? css({
              layerStyle: 'primaryFill',
              color: 'onPrimaryFill',
              boxShadow: 'primary',
            })
          : css({
              color: 'mutedForeground',
              boxShadow: 'line',
              _hover: {
                color: 'foreground',
              },
            }),
      ),
    )
    .children(
      icon(
        h,
        Bot,
        css({
          width: '3.5',
          height: '3.5',
        }),
      ),
      t.team.autopilot,
      h.span
        .class(
          cx(
            FIGURE,
            css({
              borderRadius: 'full',
              paddingInline: '1.5',
              paddingBlock: '0.5',
              fontSize: 'type.10',
            }),
            game.autopilot
              ? css({
                  backgroundColor: 'color-mix(in oklab, white 20%, transparent)',
                })
              : css({
                  backgroundColor: 'well',
                }),
          ),
        )
        .children(game.autopilot ? t.team.oN : t.team.oFF),
    )
}

const policyCopy = (t: Messages): Readonly<Record<'research' | 'hire' | 'upgrade', string>> => ({
  research: t.team.policyResearch,
  hire: t.team.policyHire,
  upgrade: t.team.policyUpgrade,
})

const policies = (model: Model, h: H<Message>): ReadonlyArray<Child> => {
  const t = copy(h)
  const game = model.board.game
  const level = perkLevel(game, 'autopilot')
  return (['research', 'hire', 'upgrade'] as const)
    .filter((policy) => level >= POLICY_LEVEL[policy])
    .map((policy) =>
      h.button
        .key(`policy-${policy}`)
        .attr('type', 'button')
        .attr('role', 'switch')
        .attr('aria-checked', String(game.policies[policy]))
        .on('click', () => Message.PolicyToggled({ policy, on: !game.policies[policy] }))
        .class(
          cx(
            cx(
              css({
                display: 'inline-flex',
                height: '7',
                alignItems: 'center',
                gap: '1.5',
                borderRadius: 'full',
                paddingInline: '2.5',
                fontSize: 'type.11-5',
                fontWeight: 'medium',
              }),
              'press',
            ),
            game.policies[policy]
              ? css({
                  layerStyle: 'primaryFill',
                  color: 'onPrimaryFill',
                  boxShadow: 'primary',
                })
              : css({
                  color: 'mutedForeground',
                  boxShadow: 'line',
                  _hover: {
                    color: 'foreground',
                  },
                }),
          ),
        )
        .children(policyCopy(t)[policy]),
    )
}

const chaos = (model: Model, h: H<Message>): Content => {
  const t = copy(h)

  const game = model.board.game
  const target = game.weakest
    ? t.catalog.components[game.nodes.find((entry) => entry.id === game.weakest)?.type ?? 'server']
        .name
    : null
  return h.button
    .attr('type', 'button')
    .attr('role', 'switch')
    .attr('aria-checked', String(game.chaos))
    .attr('aria-label', target ? t.team.chaosNextHitsLabel(target) : t.team.chaosExperiments)
    .attr('title', target ? t.team.chaosNextHits(target) : t.team.chaosExperiments)
    .on('click', () => Message.ChaosChosen({ chaos: !game.chaos }))
    .class(
      cx(
        cx(
          css({
            display: 'inline-flex',
            height: '7',
            alignItems: 'center',
            gap: '1.5',
            borderRadius: 'full',
            paddingRight: '1',
            paddingLeft: '2.5',
            fontSize: 'type.11-5',
            fontWeight: 'medium',
          }),
          'press',
        ),
        game.chaos
          ? css({
              layerStyle: 'primaryFill',
              color: 'onPrimaryFill',
              boxShadow: 'primary',
            })
          : css({
              color: 'mutedForeground',
              boxShadow: 'line',
              _hover: {
                color: 'foreground',
              },
            }),
      ),
    )
    .children(
      icon(
        h,
        FlaskConical,
        css({
          width: '3.5',
          height: '3.5',
        }),
      ),
      t.team.chaos,
      h.span
        .class(
          cx(
            FIGURE,
            css({
              borderRadius: 'full',
              paddingInline: '1.5',
              paddingBlock: '0.5',
              fontSize: 'type.10',
            }),
            game.chaos
              ? css({
                  backgroundColor: 'color-mix(in oklab, white 20%, transparent)',
                })
              : css({
                  backgroundColor: 'well',
                }),
          ),
        )
        .children(game.chaos ? t.team.oN : t.team.oFF),
    )
}

const costPill = (cost: number, h: H<Message>): Content => {
  const t = copy(h)
  return h.span
    .class(
      cx(
        FIGURE,
        css({
          flexShrink: '0',
          borderRadius: 'full',
          layerStyle: 'primaryFill',
          paddingInline: '2',
          paddingBlock: '0.5',
          fontSize: 'type.10-5',
          color: 'onPrimaryFill',
          boxShadow: 'primary',
        }),
      ),
    )
    .children(dh(t, cost))
}

type TileState = 'open' | 'locked' | 'queued' | 'done'

const tile = (
  key: string,
  code: string,
  name: string,
  cost: number,
  effect: string,
  extra: string | null,
  state: TileState,
  status: Child,
  h: H<Message>,
): Content =>
  h.div
    .key(key)
    .class(
      cx(
        css({
          display: 'flex',
          minWidth: '0',
          flexDirection: 'column',
          gap: '1.5',
          borderRadius: 'xl',
          paddingInline: '3',
          paddingTop: '2.5',
          paddingBottom: '2.5',
        }),
        state === 'locked'
          ? css({
              backgroundColor: 'color-mix(in oklab, var(--foreground) 2.5%, transparent)',
              color: 'mutedForeground',
              boxShadow: 'line',
            })
          : state === 'done'
            ? css({
                backgroundColor: 'okSoft',
                boxShadow: 'okLineFaint',
              })
            : css({
                layerStyle: 'raised',
                boxShadow: 'raised',
              }),
      ),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'flex-start',
            gap: '2',
          }),
        )
        .children(
          h.div
            .class(
              css({
                display: 'flex',
                minWidth: '0',
                flex: '1 1 0%',
                flexDirection: 'column',
              }),
            )
            .children(
              h.span
                .class(
                  cx(
                    FIGURE,
                    css({
                      fontSize: 'type.10-5',
                      color: 'mutedForeground',
                    }),
                  ),
                )
                .children(code),
              h.span
                .class(
                  css({
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 'type.13',
                    fontWeight: 'semibold',
                  }),
                )
                .children(name),
            ),
          state === 'done' ? undefined : costPill(cost, h),
        ),
      h.span
        .class(
          css({
            lineClamp: 2,
            minHeight: '2lh',
            fontSize: 'type.11-5',
            lineHeight: 'snug',
            color: 'mutedForeground',
          }),
        )
        .children(effect),
      extra
        ? h.span
            .class(
              css({
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 'type.11-5',
                color: 'warn',
              }),
            )
            .children(extra)
        : undefined,
      h.div
        .class(
          css({
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'flex-end',
            paddingTop: '0.5',
          }),
        )
        .children(status),
    )

const queueButton = (
  label: string,
  message: Message,
  refusal: string | null,
  needs: ResearchId | null,
  h: H<Message>,
): Content => {
  const t = copy(h)
  if (refusal !== null && needs !== null)
    return button(
      h,
      {
        onClick: Message.ResearchShown({ id: needs }),
        variant: 'outline',
        size: 'sm',
        className: css({
          maxWidth: '100%',
        }),
        attributes: { title: refusal },
      },
      [
        icon(
          h,
          Lock,
          css({
            width: '3',
            height: '3',
          }),
        ),
        h.span
          .class(
            css({
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }),
          )
          .children(t.catalog.research[needs].name),
      ],
    )
  return button(
    h,
    {
      onClick: message,
      isDisabled: refusal !== null,
      variant: 'outline',
      size: 'sm',
      attributes: { title: refusal ?? t.team.addToTheBacklog },
    },
    refusal
      ? [
          icon(
            h,
            Lock,
            css({
              width: '3',
              height: '3',
            }),
          ),
          t.team.locked,
        ]
      : [
          icon(
            h,
            Plus,
            css({
              width: '3.5',
              height: '3.5',
            }),
          ),
          label,
        ],
  )
}

const queuedBadge = (building: ReadonlySet<string>, ref: string, h: H<Message>): Content => {
  const t = copy(h)
  return building.has(ref)
    ? badge(
        h,
        {
          variant: 'outline',
        },
        [statusMark('building', 0.5, h), t.team.inProgress],
      )
    : badge(
        h,
        {
          variant: 'outline',
        },
        [statusMark('queued', 0, h), t.team.upNext],
      )
}

const featureTile = (
  game: Game,
  id: FeatureId,
  review: boolean,
  building: ReadonlySet<string>,
  buildIn: string | null,
  h: H<Message>,
): Content => {
  const t = copy(h)

  const def = localized(FEATURES[id], t.catalog.features[id])
  const live = isFeatureLive(game, id)
  const built = isBuilt(game, id)
  const queued = game.backlog.some((item) => item.ref === id)
  const refusal = featureRefusal(game, id)
  const state: TileState = live
    ? 'done'
    : built || queued
      ? 'queued'
      : refusal !== null
        ? 'locked'
        : 'open'
  return tile(
    id,
    codeOf('feature', id),
    def.name,
    featureHoursOf(game, id, buildIn ?? undefined),
    def.era > game.stage ? `${t.catalog.eras[def.era]?.name ?? ''} · ${def.effect}` : def.effect,
    review && def.hidden && !live ? def.hidden : null,
    state,
    live
      ? badge(
          h,
          {
            variant: 'secondary',
            className: css({
              color: 'ok',
            }),
          },
          [
            icon(
              h,
              Check,
              css({
                width: '3',
                height: '3',
              }),
            ),
            t.team.live,
          ],
        )
      : built
        ? badge(
            h,
            {
              variant: 'outline',
            },
            [
              icon(
                h,
                Rocket,
                css({
                  width: '3',
                  height: '3',
                }),
              ),
              t.team.shipping,
            ],
          )
        : queued
          ? queuedBadge(building, id, h)
          : queueButton(
              t.team.build,
              Message.TeamChanged({ message: TeamMessage.FeatureQueued({ id }) }),
              refusal ? featureWhy(t, game, id, refusal) : null,
              def.research && !has(game, def.research) ? def.research : null,
              h,
            ),
    h,
  )
}

const runbookPicker = (game: Game, h: H<Message>): Content => {
  const t = copy(h)

  const kinds = runbookKinds(game)
  if (kinds.length === 0)
    return h.span
      .class(
        css({
          fontSize: 'type.11-5',
          color: 'mutedForeground',
        }),
      )
      .children(t.team.handleIncidentFirst)
  return h.div
    .class(
      css({
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1',
      }),
    )
    .children(
      ...kinds.map((kind) => {
        const refusal = runbookRefusal(game, kind)
        const queued = game.backlog.some(
          (item) => item.kind === 'task' && item.ref === 'runbook' && item.target === kind,
        )
        return h.button
          .key(`runbook-${kind}`)
          .attr('type', 'button')
          .on('click', () => Message.RunbookQueued({ kind }))
          .disabled(refusal !== null)
          .attr(
            'title',
            refusal
              ? runbookWhy(t, game, kind, refusal)
              : t.team.writeRunbookFor(t.catalog.incidents[kind].name),
          )
          .class(
            css({
              display: 'flex',
              height: '6',
              alignItems: 'center',
              gap: '1',
              borderRadius: 'md',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: 'hairline',
              paddingInline: '1.5',
              fontSize: 'type.11',
              fontWeight: 'medium',
              color: 'mutedForeground',
              transitionProperty:
                'color, background-color, border-color, text-decoration-color, fill, stroke',
              transitionDuration: 'fast',
              transitionTimingFunction: 'out',
              _hover: {
                color: 'foreground',
              },
              _disabled: {
                opacity: 0.5,
              },
            }),
          )
          .children(
            icon(
              h,
              queued ? Hourglass : Plus,
              css({
                width: '3',
                height: '3',
              }),
            ),
            h.span
              .class(
                css({
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }),
              )
              .children(t.catalog.incidents[kind].name),
          )
      }),
    )
}

const taskTile = (
  game: Game,
  id: TaskId,
  building: ReadonlySet<string>,
  h: H<Message>,
): Content => {
  const t = copy(h)

  const done = serviceOf(game).fixes.some((fix) => fix === id)
  const queued = game.backlog.some((item) => item.ref === id)
  const refusal = id === 'runbook' && has(game, 'runbooks') ? null : taskRefusal(game, id)
  const runbooks = game.runbooks.length
  return tile(
    id,
    codeOf('task', id),
    t.catalog.tasks[id].name,
    TASKS[id].dh,
    id === 'runbook' && runbooks > 0
      ? t.team.runbooksWritten(t.catalog.tasks[id].effect, runbooks)
      : t.catalog.tasks[id].effect,
    null,
    done ? 'done' : queued ? 'queued' : refusal !== null ? 'locked' : 'open',
    id === 'runbook'
      ? runbookPicker(game, h)
      : done
        ? badge(
            h,
            {
              variant: 'secondary',
              className: css({
                color: 'ok',
              }),
            },
            [
              icon(
                h,
                Check,
                css({
                  width: '3',
                  height: '3',
                }),
              ),
              t.team.done,
            ],
          )
        : queued
          ? queuedBadge(building, id, h)
          : queueButton(
              t.team.queue,
              Message.TaskQueued({ id }),
              refusal ? taskWhy(t, game, id, refusal) : null,
              null,
              h,
            ),
    h,
  )
}

const TILES = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: '2',
})

const work = (model: Model, h: H<Message>): Content => {
  const t = copy(h)

  const game = model.board.game
  const tasks = TASK_IDS.filter((id) => {
    const def = localized(TASKS[id], t.catalog.tasks[id])
    return !def.internal && (def.research === null || has(game, def.research))
  })
  const features = FEATURE_IDS.filter((id) => FEATURES[id].era <= game.stage + 1)
  const building = new Set([...assignments(game).values()].map((item) => item.ref))
  const live = features.filter((id) => isFeatureLive(game, id)).length
  const review = has(game, 'code-review')
  const engineering = tasks.length > 0 && shown(model, 'engineering')
  return h.div
    .class(
      cx(
        css({
          display: 'flex',
          minHeight: '0',
          flexDirection: 'column',
          gap: '3',
          padding: '4',
        }),
        SCROLL,
        css({
          _compact: {
            overflow: 'visible',
          },
        }),
      ),
    )
    .children(
      migrationCard(game, h),
      heading(
        t.team.board,
        h.div
          .class(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
            }),
          )
          .children(
            autopilot(model, h),
            ...policies(model, h),
            ...(has(game, 'chaos-engineering') ? [chaos(model, h)] : []),
          ),
        h,
      ),
      board(game, h),
      heading(
        t.team.features,
        h.span
          .class(
            cx(
              FIGURE,
              css({
                fontSize: 'type.11',
                color: 'mutedForeground',
              }),
            ),
          )
          .children(t.team.live2(live, features.length)),
        h,
      ),
      game.services.length > 1
        ? h.select
            .attr('aria-label', t.team.buildIn)
            .on('change', ({ value }) =>
              Message.TeamChanged({
                message: TeamMessage.BuildInChosen({ serviceId: value === '' ? null : value }),
              }),
            )
            .class(SERVICE_SELECT)
            .children(
              ...game.services.map((service, index) => {
                const value = index === 0 ? '' : service.id
                return h.option
                  .attr('value', value)
                  .selected((model.board.team.service.buildIn ?? '') === value)
                  .children(t.team.buildInService(serviceName(t, service)))
              }),
            )
        : undefined,
      h.div
        .class(TILES)
        .children(
          ...features.map((id) =>
            featureTile(game, id, review, building, model.board.team.service.buildIn, h),
          ),
        ),
      engineering ? heading(t.team.engineering, undefined, h) : undefined,
      engineering
        ? h.div
            .class(
              cx(
                TILES,
                cx(
                  css({
                    borderRadius: 'xl',
                  }),
                  'enter-pop',
                ),
                glowing(model, 'engineering') && 'cue-glow',
              ),
            )
            .children(...tasks.map((id) => taskTile(game, id, building, h)))
        : undefined,
    )
}

export const teamPanel = (h: H<Message>, model: Model): View.Content<Message> | undefined => {
  if (model.panel !== 'team') return undefined
  const t = copy(h)

  const game = model.board.game
  const rate = devHoursRate(game, ledgerOf(model))
  const payroll = payrollOf(game)
  return shell(
    h,
    t,
    t.team.team,
    [
      payroll > 0
        ? h.span
            .class(
              cx(
                FIGURE,
                css({
                  fontSize: 'type.12',
                  whiteSpace: 'nowrap',
                  color: 'mutedForeground',
                  _compact: {
                    display: 'none',
                  },
                }),
              ),
            )
            .children(t.team.sPayroll(money(payroll)))
        : undefined,
      h.span
        .class(
          cx(
            FIGURE,
            css({
              display: 'flex',
              alignItems: 'baseline',
              gap: '1.5',
              borderRadius: 'full',
              backgroundColor: 'well',
              paddingInline: '3',
              paddingBlock: '1',
              fontSize: 'type.15',
              whiteSpace: 'nowrap',
              boxShadow: 'well',
            }),
          ),
        )
        .children(
          dh(t, game.devHours),
          h.span
            .class(
              css({
                fontSize: 'type.11',
                color: 'ok',
              }),
            )
            .children(t.team.min(perMinute(rate))),
        ),
    ],
    [
      h.div
        .class(
          css({
            display: 'grid',
            minHeight: '0',
            flex: '1 1 0%',
            gridTemplateColumns: '360px minmax(0, 1fr)',
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            borderColor: 'hairline',
            _narrow: { gridTemplateColumns: 'minmax(0, 1fr)' },
            _compact: {
              display: 'block',
              overflowY: 'auto',
              paddingBottom: 'env(safe-area-inset-bottom)',
            },
          }),
        )
        .children(
          h.div
            .class(
              css({
                display: 'flex',
                minHeight: '0',
                flexDirection: 'column',
                borderRightWidth: '1px',
                borderRightStyle: 'solid',
                borderColor: 'hairline',
                backgroundColor: 'nested',
                _narrow: {
                  borderRightWidth: '0px',
                },
              }),
            )
            .children(floor(model, h)),
          work(model, h),
        ),
    ],
    css({ maxWidth: '1360px', height: 'min(820px, 100%)' }),
  )
}
