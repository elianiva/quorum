import { css, cx } from '@quorum/styled-system/css'
import { copy, localized, nodeTitle, type Messages } from '@/i18n/messages.ts'
import { TeamMessage } from '@/game/team.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { Option, Result } from 'effect'
import { DragAndDrop } from '@foldkit/ui'
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Bot,
  Bug,
  Check,
  Container,
  Database,
  Crown,
  Gem,
  GraduationCap,
  Hourglass,
  Lock,
  Pencil,
  Plus,
  Rabbit,
  Rocket,
  Scale,
  Shield,
  Siren,
  FlaskConical,
  Trash2,
  UserMinus,
  X,
  Zap,
} from 'lucide'
import {
  FEATURES,
  FEATURE_IDS,
  LANGUAGES,
  LEVER_KINDS,
  MIGRATION_STEPS,
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
} from '@quorum/simulation/catalog'
import { POLICY_LEVEL } from '@quorum/simulation/catalog'
import { MAX_NAME } from '@quorum/simulation/work'
import { perkLevel } from '@quorum/simulation/founding'
import { has, sreStaffed } from '@quorum/simulation/lookups'
import { openRegions } from '@quorum/simulation/regions'
import type {
  BlockKind,
  Engineer,
  Game,
  GameNode,
  Service,
  Team,
  TeamKind,
  WorkItem,
  WorkKind,
} from '@quorum/simulation/state'
import {
  deployEvery,
  devHoursRate,
  doraMetrics,
  languageOfService,
  learnTargetOf,
  membersOf,
  nextBadDeployChance,
  ownerOf,
  payrollOf,
  policyNow,
  rampSeconds,
  pipelineOf,
  salaryOf,
  serviceBurnOf,
  serviceOf,
  serviceOfFeature,
  sharesDatabase,
  signingOf,
  teamOutputs,
  trainCost,
  trainSeconds,
  trainingOf,
  upkeepShare,
} from '@quorum/simulation/team'
import { overdueBy } from '@quorum/simulation/cve'
import {
  adoptionShareOf,
  awaitingFeatures,
  isBuilt,
  isFeatureLive,
  liftReading,
  liveFeatures,
} from '@quorum/simulation/features'
import { isReady, stepOf } from '@quorum/simulation/migration'
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
  taskRefusal,
} from '@quorum/simulation/work'
import type { Refusal } from '@quorum/simulation/actions'
import { refusalIn } from '@/i18n/refusal.ts'
import { money, sharePercent } from '@quorum/ui/game/format'
import { STACK_LOGOS } from '@quorum/ui/game/icons'
import { Message } from '@/game/message.ts'
import { ledgerOf, type Model } from '@/game/model.ts'
import { identityOf } from '@/game/mail.ts'
import { glowing, shown } from '@/game/reveal.ts'
import { icon } from '@quorum/ui/primitives/icon'
import { badge } from '@quorum/ui/primitives/badge'
import { button } from '@quorum/ui/primitives/button'
import { EYEBROW, FIGURE, PANEL, SCROLL, WELL, ring, stackLogo } from '@quorum/ui/game/bits'
import { shell } from './panels.ts'

const nameOf = (id: string): string => identityOf(id).name

const HUES = [28, 62, 150, 195, 240, 285, 330]
const hueOf = (id: string): number => HUES[Number(id.slice(1)) % HUES.length] ?? 240

const amount = (value: number): string =>
  value < 10 ? value.toFixed(1) : String(Math.floor(value))
const dh = (t: Messages, value: number): string => t.units.devHours(amount(value))

/** Dev Hours per sim second, per minute. */
const perMinute = (rate: number): string => {
  const value = rate * 60
  return value < 10 ? value.toFixed(1) : String(Math.round(value))
}

/** A wait in sim seconds: seconds under a minute and a half, minutes above. */
const wait = (t: Messages, seconds: number): string =>
  seconds < 90 ? t.units.s(Math.max(0, Math.ceil(seconds))) : t.units.min(Math.ceil(seconds / 60))

/** A team's name: the Simulation names the first "Core" and the rest "Team 2", so those are told in words. */
export const teamName = (t: Messages, team: Team): string => {
  if (team.id === 'core' && team.name === 'Core') return t.team.coreTeam
  const numbered = /^Team (\d+)$/.exec(team.name)
  return numbered ? t.team.teamN(Number(numbered[1])) : team.name
}

/** A Service's name: the first is "Monolith" and a split without a name is "Service 2". */
export const serviceName = (t: Messages, service: Service): string => {
  if (service.id === 'monolith' && service.name === 'Monolith') return t.team.monolith
  const numbered = /^Service (\d+)$/.exec(service.name)
  return numbered ? t.team.serviceN(Number(numbered[1])) : service.name
}

/** A work item's name in words: the Simulation's `itemName`, from the catalog tables. */
export const workItemName = (t: Messages, item: WorkItem): string => {
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

/** Features the Company has, has built, or has queued. */
const planned = (game: Game, id: FeatureId): boolean =>
  isBuilt(game, id) || game.backlog.some((item) => item.ref === id)

/**
 * Why a Feature cannot be queued, in words. The Simulation's reasons are English, so each is
 * told again from the same checks, in the same order.
 */
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

/** Why an engineering task cannot be queued, in words: each task has the one reason it names. */
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

/** Why a runbook cannot be written for an incident kind, in words. */
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

/** Why a Service cannot be split, in words. */
const splitWhy = (
  t: Messages,
  game: Game,
  draft: Readonly<{ name: string; owner: string; features: ReadonlyArray<FeatureId> }>,
  refusal: Refusal,
): string => {
  const reason = t.team.refusal
  if (game.sandbox) return reason.sandbox
  if (!has(game, 'service-boundaries'))
    return reason.locked(reason.aServiceSplit, t.catalog.research['service-boundaries'].name)
  if (draft.features.length === 0) return reason.chooseFeature
  if (!game.teams.some((team) => team.id === draft.owner)) return reason.teamGone
  const name = draft.name.trim()
  if (
    name !== '' &&
    game.services.some((service) => service.name.toLowerCase() === name.toLowerCase())
  )
    return reason.serviceExists(name)
  for (const id of draft.features) {
    const featureName = t.catalog.features[id].name
    if (!isFeatureLive(game, id)) return reason.notLive(featureName)
    const carrier = serviceOfFeature(game, id)
    if (carrier.id !== serviceOf(game).id)
      return reason.alreadyOn(featureName, serviceName(t, carrier))
  }
  return refusalIn(t, refusal)
}

const clamp = (share: number): number => Math.max(0, Math.min(1, share))

const POLICY_ICONS: Record<PolicyId, Parameters<typeof icon>[1]> = {
  'move-fast': Rabbit,
  balanced: Scale,
  quality: Gem,
}

/** Work kinds keep the build-group colours, so a kind reads the same everywhere. */
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

const heading = (title: string, right: Html, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class(
        css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '2',
          paddingInline: '1',
          paddingTop: '2',
        }),
      ),
    ],
    [h.span([h.Class(EYEBROW)], [title]), right],
  )

const iconButton = (
  label: string,
  glyph: Parameters<typeof icon>[1],
  message: Message,
  enabled: boolean,
  h: HtmlBuilder<Message>,
  className = '',
): Html =>
  button(
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
      attributes: [h.AriaLabel(label), h.Title(label)],
    },
    icon(
      h,
      glyph,
      css({
        width: '3.5',
        height: '3.5',
      }),
    ),
    h,
  )

/** The one name field the Team panel opens, for a team or a Service. */
const renameField = (
  draft: string,
  label: string,
  placeholder: string,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          minWidth: '0',
          flex: '1 1 0%',
          alignItems: 'center',
          gap: '1',
        }),
      ),
    ],
    [
      h.input([
        h.Type('text'),
        h.Value(draft),
        h.Placeholder(placeholder),
        h.Maxlength(MAX_NAME),
        h.Autocomplete('off'),
        h.Spellcheck(false),
        h.Autofocus(true),
        h.AriaLabel(label),
        h.OnInput((name) => Message.TeamChanged({ message: TeamMessage.RenameChanged({ name }) })),
        h.OnKeyDownPreventDefault((key) =>
          key === 'Enter'
            ? Option.some(Message.TeamChanged({ message: TeamMessage.RenameCommitted() }))
            : key === 'Escape'
              ? Option.some(Message.TeamChanged({ message: TeamMessage.RenameCancelled() }))
              : Option.none(),
        ),
        h.Class(
          cx(
            WELL,
            css({
              height: '7',
              minWidth: '0',
              flex: '1 1 0%',
              borderRadius: 'lg',
              paddingInline: '2',
              fontSize: 'calc(12px*var(--type-scale))',
              outlineStyle: 'none',
            }),
          ),
        ),
      ]),
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
    ],
  )
}

/** A circle drawn around an avatar: ramp-up for a new hire, the wait for an offer. */
const halo = (share: number, className: string, h: HtmlBuilder<Message>): Html => {
  const radius = 25
  const length = 2 * Math.PI * radius
  return h.svg(
    [
      h.AriaHidden(true),
      h.Xmlns('http://www.w3.org/2000/svg'),
      h.ViewBox('0 0 54 54'),
      h.Fill('none'),
      h.Class(
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
      ),
    ],
    [
      h.circle([
        h.Cx('27'),
        h.Cy('27'),
        h.R(String(radius)),
        h.Stroke('currentColor'),
        h.StrokeWidth('2.5'),
        h.Attribute('opacity', '0.18'),
      ]),
      h.circle([
        h.Cx('27'),
        h.Cy('27'),
        h.R(String(radius)),
        h.Stroke('currentColor'),
        h.StrokeWidth('2.5'),
        h.StrokeLinecap('round'),
        h.Attribute('stroke-dasharray', `${length}`),
        h.Attribute('stroke-dashoffset', `${length * (1 - clamp(share))}`),
        h.Attribute('transform', 'rotate(-90 27 27)'),
        h.Class(
          css({
            transitionProperty: 'stroke-dashoffset',
            transitionDuration: '200ms',
            transitionTimingFunction: 'out',
          }),
        ),
      ]),
    ],
  )
}

const seat = (
  key: string,
  face: Html,
  name: string,
  note: Html | string,
  corners: ReadonlyArray<Html>,
  className: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [
      h.Key(key),
      h.Class(
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
      ),
    ],
    [
      face,
      h.span(
        [
          h.Class(
            css({
              marginTop: '1',
              width: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 'calc(12.5px*var(--type-scale))',
              fontWeight: '500',
            }),
          ),
        ],
        [name],
      ),
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 'calc(10.5px*var(--type-scale))',
                color: 'mutedForeground',
              }),
            ),
          ),
        ],
        [note],
      ),
      ...corners,
    ],
  )

const corner = (side: 'left' | 'right', control: Html, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class(
        cx(
          css({
            position: 'absolute',
            top: '1',
            opacity: 0,
            transitionProperty: 'opacity',
            transitionDuration: '150ms',
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
      ),
    ],
    [control],
  )

const face = (
  hue: number | null,
  content: Html,
  badgeMark: Html,
  ring: Html,
  h: HtmlBuilder<Message>,
): Html => {
  return h.span(
    [
      h.Class(
        cx(
          css({
            position: 'relative',
            display: 'grid',
            width: '11',
            height: '11',
            flexShrink: '0',
            placeItems: 'center',
            borderRadius: '9999px',
            fontSize: 'calc(17px*var(--type-scale))',
            fontWeight: '600',
            color: 'white',
            boxShadow: 'inset 0 -2px 0 oklch(0 0 0/0.12),0 1px 2px oklch(0 0 0/0.12)',
          }),
          hue === null &&
            css({
              layerStyle: 'primaryFill',
              color: 'onPrimaryFill',
            }),
        ),
      ),
      ...(hue === null
        ? []
        : [
            h.Style({
              'background-image': `linear-gradient(to bottom, oklch(0.72 0.13 ${hue}), oklch(0.6 0.15 ${hue}))`,
            }),
          ]),
    ],
    [ring, content, badgeMark],
  )
}

const languageMark = (language: Engineer['language'], h: HtmlBuilder<Message>): Html =>
  h.span(
    [
      h.Class(
        css({
          position: 'absolute',
          right: '-0.25rem',
          bottom: '-0.25rem',
          display: 'grid',
          width: '18px',
          height: '18px',
          placeItems: 'center',
          borderRadius: '9999px',
          backgroundColor: 'card',
          boxShadow: 'raised',
        }),
      ),
    ],
    [
      stackLogo(
        language,
        css({
          width: '3',
          height: '3',
        }),
        h,
      ),
    ],
  )

const engineerSeat = (game: Game, engineer: Engineer, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const ramp = (game.time - engineer.hiredAt) / rampSeconds(game)
  const ramping = ramp < 1
  const name = nameOf(engineer.id)
  const training = trainingOf(game, engineer)
  const learned = training
    ? 1 - (training.readyAt - game.time) / trainSeconds(training.language)
    : 0
  return seat(
    engineer.id,
    face(
      hueOf(engineer.id),
      h.span([], [name.slice(0, 1)]),
      languageMark(engineer.language, h),
      training
        ? halo(learned, css({ color: 'primary' }), h)
        : ramping
          ? halo(ramp, css({ color: 'ok' }), h)
          : h.empty,
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

const engineerControls = (
  game: Game,
  engineer: Engineer,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const t = copy(h)

  const teams = game.teams
  const index = teams.findIndex((team) => team.id === engineer.team)
  const next = teams[(index + 1) % teams.length]
  const language = learnTargetOf(game)
  const price = trainCost(game, language)
  const learns = engineer.language !== language && !trainingOf(game, engineer)
  return [
    teams.length > 1 || learns
      ? corner(
          'left',
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                }),
              ),
            ],
            [
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
                : h.empty,
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
                : h.empty,
            ],
          ),
          h,
        )
      : h.empty,
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

const founderSeat = (h: HtmlBuilder<Message>): Html => {
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
      h.empty,
      h.empty,
      h,
    ),
    t.team.you,
    t.team.founder,
    [],
    css({ layerStyle: 'raised', boxShadow: 'raised' }),
    h,
  )
}

const hireSeat = (game: Game, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const language = languageOfService(game)
  const price = signingOf(game, language)
  const open = game.stage >= 1
  const afford = game.cash >= price
  return h.button(
    [
      h.Key('hire'),
      h.Type('button'),
      h.OnClick(Message.TeamChanged({ message: TeamMessage.HireChosen() })),
      h.Disabled(!open || !afford),
      h.AriaLabel(
        open ? t.team.hireEngineerFor(LANGUAGES[language].name, money(price)) : t.team.hiringLocked,
      ),
      h.Class(
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
      ),
    ],
    [
      h.span(
        [
          h.Class(
            cx(
              css({
                position: 'relative',
                display: 'grid',
                width: '11',
                height: '11',
                placeItems: 'center',
                borderRadius: '9999px',
              }),
              open && afford
                ? css({
                    layerStyle: 'primaryFill',
                    color: 'onPrimaryFill',
                    boxShadow: 'primary',
                  })
                : WELL,
              css({
                borderRadius: '9999px',
              }),
            ),
          ),
        ],
        [
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
          open ? languageMark(language, h) : h.empty,
        ],
      ),
      h.span(
        [
          h.Class(
            css({
              marginTop: '1',
              width: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 'calc(12.5px*var(--type-scale))',
              fontWeight: '500',
            }),
          ),
        ],
        [open ? t.team.hire : t.team.locked],
      ),
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 'calc(10.5px*var(--type-scale))',
                color: 'mutedForeground',
              }),
            ),
          ),
        ],
        [open ? money(price) : (t.catalog.eras[1]?.name ?? '')],
      ),
    ],
  )
}

const pendingSeat = (game: Game, id: string, readyAt: number, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const left = readyAt - game.time
  return seat(
    id,
    h.span(
      [
        h.Class(
          css({
            position: 'relative',
            display: 'grid',
            width: '11',
            height: '11',
            placeItems: 'center',
            borderRadius: '9999px',
            borderWidth: '1.5px',
            borderStyle: 'dashed',
            borderColor: 'color-mix(in oklab, var(--foreground) 25%, transparent)',
            color: 'mutedForeground',
          }),
        ),
      ],
      [
        icon(
          h,
          Hourglass,
          css({
            width: '4',
            height: '4',
          }),
        ),
      ],
    ),
    nameOf(id),
    t.team.inText(wait(t, left)),
    [],
    css({
      backgroundColor: 'color-mix(in oklab, var(--foreground) 2.5%, transparent)',
      boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
    }),
    h,
  )
}

const policySwitch = (team: Team, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        cx(
          css({
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: '3px',
            padding: '3px',
          }),
          WELL,
          css({
            borderRadius: '11px',
          }),
        ),
      ),
    ],
    POLICY_IDS.map((policy) => {
      const selected = team.policy === policy
      return h.button(
        [
          h.Key(`${team.id}-${policy}`),
          h.Type('button'),
          h.AriaPressed(selected ? 'true' : 'false'),
          h.OnClick(
            Message.TeamChanged({ message: TeamMessage.PolicyChosen({ teamId: team.id, policy }) }),
          ),
          h.Class(
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
                  fontSize: 'calc(12px*var(--type-scale))',
                  fontWeight: '500',
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
          ),
        ],
        [
          icon(
            h,
            POLICY_ICONS[policy],
            css({
              width: '3.5',
              height: '3.5',
            }),
          ),
          h.span(
            [
              h.Class(
                css({
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }),
              ),
            ],
            [t.catalog.policies[policy].label],
          ),
        ],
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

/**
 * Product teams build the backlog; Platform, SRE, Data and Security teams run the system
 * (08 "Teams"). A kind its Research has not unlocked shows dimmed and opens that Research.
 */
const kindSwitch = (game: Game, team: Team, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        cx(
          css({
            display: 'flex',
            gap: '3px',
            padding: '3px',
          }),
          WELL,
          css({
            borderRadius: '11px',
          }),
        ),
      ),
    ],
    kindsOf(t).map(([kind, label, research]) => {
      const selected = team.kind === kind
      const result = setTeamKind(game, team.id, kind)
      const refusal = Result.isFailure(result) ? refusalIn(t, result.failure) : null
      // A kind its Research locks opens that Research instead.
      const needs = research !== null && !has(game, research) ? research : null
      return h.button(
        [
          h.Key(`${team.id}-${kind}`),
          h.Type('button'),
          h.AriaPressed(selected ? 'true' : 'false'),
          h.Disabled(refusal !== null && needs === null),
          h.Title(refusal ?? label),
          h.OnClick(
            needs !== null
              ? Message.ResearchShown({ id: needs })
              : Message.TeamChanged({ message: TeamMessage.KindChosen({ teamId: team.id, kind }) }),
          ),
          h.Class(
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
                  fontSize: 'calc(12px*var(--type-scale))',
                  fontWeight: '500',
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
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }),
              ),
            ],
            [label],
          ),
        ],
      )
    }),
  )
}

const pod = (model: Model, team: Team, index: number, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const output = teamOutputs(game, ledgerOf(model)).find((entry) => entry.team.id === team.id)
  const now = policyNow(game, team)
  const pending = game.hires.filter((entry) => entry.team === team.id)
  const members = membersOf(game, team)
  const sandbox = game.sandbox
  const target = DragAndDrop.maybeDropTarget(model.board.team.drag)
  const dropTarget =
    DragAndDrop.isDragging(model.board.team.drag) &&
    Option.exists(target, (entry) => entry.containerId === team.id)
  const renaming = model.board.team.rename
  const editTeam =
    renaming !== null && renaming.target === 'team' && renaming.id === team.id ? renaming : null
  return h.section(
    [
      h.Key(team.id),
      ...DragAndDrop.droppable(team.id, teamName(t, team)),
      h.Class(
        cx(
          PANEL,
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '3',
            padding: '3',
            transitionProperty: 'box-shadow',
            transitionDuration: '150ms',
            transitionTimingFunction: 'out',
          }),
          dropTarget &&
            css({
              boxShadow: '0 0 0 2px #fff, 0 0 0 4px var(--primary)',
            }),
        ),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'flex-start',
              gap: '2',
              paddingInline: '1',
            }),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  minWidth: '0',
                  flex: '1 1 0%',
                  flexDirection: 'column',
                }),
              ),
            ],
            [
              h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      minWidth: '0',
                      alignItems: 'center',
                      gap: '1',
                    }),
                  ),
                ],
                [
                  editTeam
                    ? renameField(editTeam.draft, t.team.teamName, team.name, h)
                    : h.span(
                        [
                          h.Class(
                            css({
                              minWidth: '0',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontSize: 'calc(15px*var(--type-scale))',
                              fontWeight: '600',
                              letterSpacing: '-0.02em',
                            }),
                          ),
                        ],
                        [teamName(t, team)],
                      ),
                  editTeam
                    ? h.empty
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
                ],
              ),
              h.span(
                [
                  h.Class(
                    css({
                      fontSize: 'calc(11.5px*var(--type-scale))',
                      color: 'mutedForeground',
                    }),
                  ),
                ],
                [t.team.people(output?.headcount ?? 0)],
              ),
            ],
          ),
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                }),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'calc(22px*var(--type-scale))',
                        lineHeight: '1',
                        fontWeight: '500',
                      }),
                    ),
                  ),
                ],
                [perMinute(output?.devHoursPerSecond ?? 0)],
              ),
              h.span(
                [
                  h.Class(
                    cx(
                      EYEBROW,
                      css({
                        marginTop: '1',
                        fontSize: 'calc(9.5px*var(--type-scale))',
                      }),
                    ),
                  ),
                ],
                [t.team.dHMin],
              ),
            ],
          ),
          index > 0
            ? iconButton(
                t.team.removeTeam,
                Trash2,
                Message.TeamChanged({ message: TeamMessage.Removed({ teamId: team.id }) }),
                true,
                h,
              )
            : h.empty,
        ],
      ),
      index > 0 && !sandbox && game.stage >= PLATFORM_STAGE ? kindSwitch(game, team, h) : h.empty,
      team.kind === 'product' ? policySwitch(team, h) : h.empty,
      team.kind === 'product' && now.id !== team.policy
        ? h.span(
            [
              h.Class(
                css({
                  marginTop: '-0.375rem',
                  paddingInline: '1',
                  fontSize: 'calc(11px*var(--type-scale))',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [t.team.untilTomorrow(t.catalog.policies[now.id].label)],
          )
        : h.empty,
      h.div(
        [
          h.Class(
            css({
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '2',
            }),
          ),
        ],
        [
          index === 0 ? founderSeat(h) : h.empty,
          ...members.map((engineer, memberIndex) =>
            h.div(
              [
                h.Key(engineer.id),
                h.Class(
                  cx(
                    css({
                      position: 'relative',
                    }),
                    'group',
                  ),
                ),
              ],
              [
                h.div(
                  [
                    ...DragAndDrop.draggable(
                      {
                        model: model.board.team.drag,
                        toParentMessage: (message) =>
                          Message.TeamChanged({ message: TeamMessage.DragChanged({ message }) }),
                        itemId: engineer.id,
                        containerId: team.id,
                        index: memberIndex,
                      },
                      h,
                    ),
                    ...DragAndDrop.sortable(engineer.id),
                    h.AriaLabel(t.team.moveFrom(nameOf(engineer.id), teamName(t, team))),
                    h.Class(
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
                          DragAndDrop.maybeDraggedItemId(model.board.team.drag),
                          (id) => id === engineer.id,
                        ) &&
                          css({
                            opacity: 0.45,
                          }),
                      ),
                    ),
                  ],
                  [engineerSeat(game, engineer, h)],
                ),
                ...engineerControls(game, engineer, h),
              ],
            ),
          ),
          ...pending.map((entry) =>
            pendingSeat(
              game,
              entry.id,
              entry.phase._tag === 'Pending' ? entry.phase.readyAt : game.time,
              h,
            ),
          ),
          // Hiring is not shown before its Era (15 "Progressive disclosure").
          index === 0 && !sandbox && game.stage >= 1 ? hireSeat(game, h) : h.empty,
        ],
      ),
      sandbox
        ? h.empty
        : team.kind === 'platform'
          ? platformWork(h)
          : team.kind === 'sre'
            ? sreWork(game, h)
            : team.kind === 'data'
              ? dataWork(h)
              : team.kind === 'security'
                ? securityWork(h)
                : working(
                    assignments(game).get(team.id),
                    index === 0 || members.length > 0,
                    waitingFor(game, team),
                    h,
                  ),
    ],
  )
}

/** What an SRE pod has on its desk: the pager, the runbooks, and the MTTR it holds down. */
const sreWork = (game: Game, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        cx(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            paddingInline: '2.5',
            paddingBlock: '2',
          }),
          WELL,
          css({
            borderRadius: '10px',
          }),
        ),
      ),
    ],
    [
      icon(
        h,
        Siren,
        css({
          width: '3.5',
          height: '3.5',
          color: 'mutedForeground',
        }),
      ),
      h.span(
        [
          h.Class(
            css({
              fontSize: 'calc(12.5px*var(--type-scale))',
              color: 'mutedForeground',
            }),
          ),
        ],
        [
          game.runbooks.length === 0
            ? t.team.holdsThePager
            : t.team.holdsThePagerRunbooks(game.runbooks.length),
        ],
      ),
    ],
  )
}

/** What a Data pod has on its desk: the warehouse, the copies, and the Features they make cheaper. */
const dataWork = (h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        cx(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            paddingInline: '2.5',
            paddingBlock: '2',
          }),
          WELL,
          css({
            borderRadius: '10px',
          }),
        ),
      ),
    ],
    [
      icon(
        h,
        Database,
        css({
          width: '3.5',
          height: '3.5',
          color: 'mutedForeground',
        }),
      ),
      h.span(
        [
          h.Class(
            css({
              fontSize: 'calc(12.5px*var(--type-scale))',
              color: 'mutedForeground',
            }),
          ),
        ],
        [t.team.runsTheWarehouseReportAndAI],
      ),
    ],
  )
}

/** What the pod has on its desk: the backlog item its team builds. */
const platformWork = (h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        cx(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            paddingInline: '2.5',
            paddingBlock: '2',
          }),
          WELL,
          css({
            borderRadius: '10px',
          }),
        ),
      ),
    ],
    [
      icon(
        h,
        Container,
        css({
          width: '3.5',
          height: '3.5',
          color: 'mutedForeground',
        }),
      ),
      h.span(
        [
          h.Class(
            css({
              fontSize: 'calc(12.5px*var(--type-scale))',
              color: 'mutedForeground',
            }),
          ),
        ],
        [t.team.runsClustersAndDeploys],
      ),
    ],
  )
}

/** What a Security pod has on its desk: WAF rules, dependency scanning, and compliance. */
const securityWork = (h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        cx(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            paddingInline: '2.5',
            paddingBlock: '2',
          }),
          WELL,
          css({
            borderRadius: '10px',
          }),
        ),
      ),
    ],
    [
      icon(
        h,
        Shield,
        css({
          width: '3.5',
          height: '3.5',
          color: 'mutedForeground',
        }),
      ),
      h.span(
        [
          h.Class(
            css({
              fontSize: 'calc(12.5px*var(--type-scale))',
              color: 'mutedForeground',
            }),
          ),
        ],
        [t.team.securityDesk],
      ),
    ],
  )
}

const working = (
  item: WorkItem | undefined,
  staffed: boolean,
  waits: number,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        cx(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            paddingInline: '2.5',
            paddingBlock: '2',
          }),
          WELL,
          css({
            borderRadius: '10px',
          }),
        ),
      ),
    ],
    item
      ? [
          statusMark('building', item.spent / item.cost, h),
          h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'calc(11px*var(--type-scale))',
                    color: 'mutedForeground',
                  }),
                ),
              ),
            ],
            [codeOf(item.kind, item.ref)],
          ),
          h.span(
            [
              h.Class(
                css({
                  minWidth: '0',
                  flex: '1 1 0%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'calc(12.5px*var(--type-scale))',
                  fontWeight: '500',
                }),
              ),
            ],
            [workItemName(t, item)],
          ),
          h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'calc(11.5px*var(--type-scale))',
                    color: 'mutedForeground',
                  }),
                ),
              ),
            ],
            [`${Math.floor(clamp(item.spent / item.cost) * 100)}%`],
          ),
        ]
      : [
          statusMark('queued', 0, h),
          h.span(
            [
              h.Class(
                css({
                  fontSize: 'calc(12.5px*var(--type-scale))',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [
              staffed
                ? waits > 0
                  ? t.team.waitingItems(waits)
                  : t.team.nothingAssigned
                : t.team.noEngineers,
            ],
          ),
        ],
  )
}

/** A Service's Nodes as buttons that reveal each on the Board. */
const nodeRow = (
  label: string,
  nodes: ReadonlyArray<GameNode>,
  empty: string,
  game: Game,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: '2',
          rowGap: '0.5',
          fontSize: 'calc(11.5px*var(--type-scale))',
        }),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            css({
              color: 'mutedForeground',
            }),
          ),
        ],
        [t.team.labelColon(label)],
      ),
      ...(nodes.length === 0
        ? [
            h.span(
              [
                h.Class(
                  css({
                    color: 'mutedForeground',
                  }),
                ),
              ],
              [empty],
            ),
          ]
        : nodes.map((node) =>
            h.button(
              [
                h.Type('button'),
                h.OnClick(Message.RevealNode({ nodeId: node.id })),
                h.AriaLabel(t.team.openNode(nodeTitle(t, game, node))),
                h.Class(
                  css({
                    fontWeight: '500',
                    _hover: {
                      textDecorationLine: 'underline',
                    },
                  }),
                ),
              ],
              [nodeTitle(t, game, node)],
            ),
          )),
    ],
  )
}

/** The Services a Company runs (08 "Services"): its codebases, their owners, and the split. */
const servicesCard = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const draft = model.board.team.service
  // A split moves a live Feature that no other Service carries.
  const candidates = liveFeatures(game).filter(
    (id) => serviceOfFeature(game, id).id === serviceOf(game).id,
  )
  const refusal = splitRefusal(game, {
    name: draft.name,
    owner: draft.owner,
    features: draft.features,
  })
  const shared = game.services.filter((service) => sharesDatabase(game, service)).length
  const renaming = model.board.team.rename
  return h.section(
    [
      h.Key('services'),
      h.Class(
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
      ),
    ],
    [
      heading(
        t.team.services,
        h.span(
          [
            h.Class(
              cx(
                FIGURE,
                css({
                  fontSize: 'calc(11px*var(--type-scale))',
                  color: 'mutedForeground',
                }),
              ),
            ),
          ],
          [
            shared > 1
              ? t.team.codebasesOneDatabase(game.services.length)
              : t.team.codebases(game.services.length),
          ],
        ),
        h,
      ),
      ...game.services.map((service) => {
        const owner = ownerOf(game, service)
        const paged = game.incident?.service === service.id
        const editService =
          renaming !== null && renaming.target === 'service' && renaming.id === service.id
            ? renaming
            : null
        return h.div(
          [
            h.Class(
              cx(
                WELL,
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1',
                  borderRadius: '10px',
                  paddingInline: '2.5',
                  paddingBlock: '2',
                }),
                paged &&
                  css({
                    boxShadow: '0 0 0 1px color-mix(in oklab, var(--danger) 60%, transparent)',
                  }),
              ),
            ),
          ],
          [
            h.div(
              [
                h.Class(
                  css({
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    columnGap: '2',
                    rowGap: '1',
                  }),
                ),
              ],
              [
                editService
                  ? renameField(editService.draft, t.team.serviceNameLabel, service.name, h)
                  : h.span(
                      [
                        h.Class(
                          css({
                            fontSize: 'calc(12.5px*var(--type-scale))',
                            fontWeight: '500',
                          }),
                        ),
                      ],
                      [serviceName(t, service)],
                    ),
                editService
                  ? h.empty
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
                editService
                  ? h.empty
                  : badge(
                      {
                        variant: 'outline',
                        className: css({
                          fontSize: 'calc(10.5px*var(--type-scale))',
                        }),
                      },
                      [t.team.ownedBy(teamName(t, owner))],
                      h,
                    ),
                paged && !editService
                  ? badge(
                      {
                        variant: 'outline',
                        className: css({
                          color: 'danger',
                        }),
                      },
                      [t.team.paged],
                      h,
                    )
                  : h.empty,
              ],
            ),
            h.span(
              [
                h.Class(
                  cx(
                    FIGURE,
                    css({
                      whiteSpace: 'nowrap',
                      fontSize: 'calc(10.5px*var(--type-scale))',
                      color: 'mutedForeground',
                    }),
                  ),
                ),
              ],
              [
                t.team.serviceLine(
                  service.codebase.toFixed(0),
                  Math.round(service.debt * 100),
                  t.units.perSecond(money(serviceBurnOf(game, ledgerOf(model), service))),
                ),
              ],
            ),
            h.span(
              [
                h.Class(
                  css({
                    fontSize: 'calc(11.5px*var(--type-scale))',
                    color: 'mutedForeground',
                  }),
                ),
              ],
              [
                service.features.length === 0
                  ? t.team.carriesEveryFeature
                  : t.team.carries(
                      service.features.map((id) => t.catalog.features[id].name).join(', '),
                    ),
              ],
            ),
            nodeRow(t.team.nodes, nodesOfService(game, service.id), t.team.noneYet, game, h),
            nodeRow(
              t.team.loadBalancers,
              loadBalancersOf(game, service.id),
              t.team.notBehindOne,
              game,
              h,
            ),
            game.nodes.filter((node) => node.type === 'database').length > 1
              ? h.div(
                  [
                    h.Class(
                      css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.5',
                        paddingTop: '0.5',
                      }),
                    ),
                  ],
                  [
                    h.span(
                      [
                        h.Class(
                          css({
                            fontSize: 'calc(11px*var(--type-scale))',
                            color: 'mutedForeground',
                          }),
                        ),
                      ],
                      [t.team.datastore],
                    ),
                    h.select(
                      [
                        h.OnChange((datastore) =>
                          Message.TeamChanged({
                            message: TeamMessage.DatastoreChosen({
                              serviceId: service.id,
                              datastore: datastore === '' ? null : datastore,
                            }),
                          }),
                        ),
                        h.Class(
                          cx(
                            WELL,
                            css({
                              height: '6',
                              borderRadius: 'lg',
                              paddingInline: '1.5',
                              fontSize: 'calc(11px*var(--type-scale))',
                            }),
                          ),
                        ),
                      ],
                      [
                        h.option(
                          [
                            h.Value(''),
                            ...((service.datastore ?? '') === '' ? [h.Selected(true)] : []),
                          ],
                          [t.team.firstDatabase],
                        ),
                        ...game.nodes
                          .filter((node) => node.type === 'database')
                          .map((node) =>
                            h.option(
                              [
                                h.Value(node.id),
                                ...(service.datastore === node.id ? [h.Selected(true)] : []),
                              ],
                              [nodeTitle(t, game, node)],
                            ),
                          ),
                      ],
                    ),
                  ],
                )
              : h.empty,
            game.teams.length > 1
              ? h.div(
                  [
                    h.Class(
                      css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.5',
                        paddingTop: '0.5',
                      }),
                    ),
                  ],
                  [
                    h.span(
                      [
                        h.Class(
                          css({
                            fontSize: 'calc(11px*var(--type-scale))',
                            color: 'mutedForeground',
                          }),
                        ),
                      ],
                      [t.team.moveServiceTo],
                    ),
                    h.select(
                      [
                        h.AriaLabel(t.team.teamThatOwns(serviceName(t, service))),
                        h.OnChange((teamId) =>
                          Message.TeamChanged({
                            message: TeamMessage.ServiceMoved({ serviceId: service.id, teamId }),
                          }),
                        ),
                        h.Class(
                          cx(
                            WELL,
                            css({
                              height: '6',
                              borderRadius: 'lg',
                              paddingInline: '1.5',
                              fontSize: 'calc(11px*var(--type-scale))',
                            }),
                          ),
                        ),
                      ],
                      game.teams.map((entry) =>
                        h.option(
                          [
                            h.Value(entry.id),
                            ...(entry.id === service.owner ? [h.Selected(true)] : []),
                          ],
                          [teamName(t, entry)],
                        ),
                      ),
                    ),
                  ],
                )
              : h.empty,
          ],
        )
      }),
      has(game, 'service-boundaries')
        ? h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2',
                  paddingTop: '1',
                }),
              ),
            ],
            [
              h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.5',
                    }),
                  ),
                ],
                [
                  h.input([
                    h.Type('text'),
                    h.Value(draft.name),
                    h.Placeholder(t.team.nameNewService),
                    h.AriaLabel(t.team.newServiceName),
                    h.OnInput((name) =>
                      Message.TeamChanged({ message: TeamMessage.ServiceNamed({ name }) }),
                    ),
                    h.Class(
                      cx(
                        WELL,
                        css({
                          height: '7',
                          minWidth: '0',
                          flex: '1 1 0%',
                          borderRadius: 'lg',
                          paddingInline: '2',
                          fontSize: 'calc(12px*var(--type-scale))',
                          outlineStyle: 'none',
                        }),
                      ),
                    ),
                  ]),
                  h.select(
                    [
                      h.AriaLabel(t.team.teamOwnsNewService),
                      h.OnChange((teamId) =>
                        Message.TeamChanged({
                          message: TeamMessage.ServiceOwnerChosen({ teamId }),
                        }),
                      ),
                      h.Class(
                        cx(
                          WELL,
                          css({
                            height: '7',
                            borderRadius: 'lg',
                            paddingInline: '1.5',
                            fontSize: 'calc(12px*var(--type-scale))',
                          }),
                        ),
                      ),
                    ],
                    game.teams.map((entry) =>
                      h.option(
                        [
                          h.Value(entry.id),
                          ...(entry.id === draft.owner ? [h.Selected(true)] : []),
                        ],
                        [teamName(t, entry)],
                      ),
                    ),
                  ),
                ],
              ),
              candidates.length === 0
                ? h.span(
                    [
                      h.Class(
                        css({
                          fontSize: 'calc(11.5px*var(--type-scale))',
                          color: 'mutedForeground',
                        }),
                      ),
                    ],
                    [t.team.noLiveFeatureLeft],
                  )
                : h.div(
                    [
                      h.Class(
                        css({
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '1.5',
                        }),
                      ),
                    ],
                    candidates.map((id) => {
                      const on = draft.features.includes(id)
                      return h.button(
                        [
                          h.Key(`split-${id}`),
                          h.Type('button'),
                          h.OnClick(
                            Message.TeamChanged({
                              message: TeamMessage.ServiceFeatureToggled({ id }),
                            }),
                          ),
                          h.Class(
                            cx(
                              css({
                                display: 'flex',
                                height: '6',
                                alignItems: 'center',
                                gap: '1',
                                borderRadius: '9999px',
                                borderWidth: '1px',
                                borderStyle: 'solid',
                                paddingInline: '2',
                                fontSize: 'calc(11px*var(--type-scale))',
                              }),
                              on
                                ? css({
                                    borderColor:
                                      'color-mix(in oklab, var(--primary) 60%, transparent)',
                                    backgroundColor:
                                      'color-mix(in oklab, var(--primary) 15%, transparent)',
                                    color: 'foreground',
                                  })
                                : css({
                                    borderColor:
                                      'color-mix(in oklab, var(--foreground) 15%, transparent)',
                                    color: 'mutedForeground',
                                    _hover: {
                                      color: 'foreground',
                                    },
                                  }),
                            ),
                          ),
                        ],
                        [
                          on
                            ? icon(
                                h,
                                Check,
                                css({
                                  width: '3',
                                  height: '3',
                                }),
                              )
                            : h.empty,
                          t.catalog.features[id].name,
                        ],
                      )
                    }),
                  ),
              h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2',
                    }),
                  ),
                ],
                [
                  button(
                    {
                      onClick: Message.TeamChanged({ message: TeamMessage.SplitChosen() }),
                      isDisabled: refusal !== null,
                      variant: 'outline',
                      size: 'sm',
                      attributes: [
                        h.Title(
                          refusal === null
                            ? t.team.moveFeaturesToCodebase
                            : splitWhy(t, game, draft, refusal),
                        ),
                      ],
                    },
                    refusal === null
                      ? [
                          icon(
                            h,
                            Container,
                            css({
                              width: '3.5',
                              height: '3.5',
                            }),
                          ),
                          t.team.splitFor(t.units.devHours(splitCost(draft.features))),
                        ]
                      : [
                          icon(
                            h,
                            Lock,
                            css({
                              width: '3',
                              height: '3',
                            }),
                          ),
                          t.team.locked,
                        ],
                    h,
                  ),
                  h.span(
                    [
                      h.Class(
                        css({
                          fontSize: 'calc(11px*var(--type-scale))',
                          color: 'mutedForeground',
                        }),
                      ),
                    ],
                    [refusal === null ? '' : splitWhy(t, game, draft, refusal)],
                  ),
                ],
              ),
            ],
          )
        : h.span(
            [
              h.Class(
                css({
                  fontSize: 'calc(11.5px*var(--type-scale))',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [
              t.team.serviceBoundariesSplits(
                t.catalog.research['service-boundaries'].name,
                t.catalog.eras[RESEARCH['service-boundaries'].era]?.name ?? '',
              ),
            ],
          ),
    ],
  )
}

/**
 * DORA metrics (08 "Deploy frequency"): deploy frequency, lead time for changes, change failure
 * rate, and failed deployment recovery time. Shown once a CI/CD Pipeline is placed, as the design
 * names; before that the one shared deploy pipeline has nothing to measure.
 */
const doraCard = (game: Game, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  if (game.sandbox || !pipelineOf(game)) return h.empty
  const dora = doraMetrics(game)
  const stat = (label: string, value: string): Html =>
    h.div(
      [
        h.Class(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5',
          }),
        ),
      ],
      [
        h.span([h.Class(EYEBROW)], [label]),
        h.span(
          [
            h.Class(
              cx(
                FIGURE,
                css({
                  fontSize: 'calc(13px*var(--type-scale))',
                }),
              ),
            ),
          ],
          [value],
        ),
      ],
    )
  return h.section(
    [
      h.Key('dora'),
      h.Class(
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
      ),
    ],
    [
      heading(t.team.dORAMetrics, h.empty, h),
      h.div(
        [
          h.Class(
            css({
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: '3',
            }),
          ),
        ],
        [
          stat(t.team.deployFrequency, t.team.perDay(dora.deploysPerDay.toFixed(1))),
          stat(t.team.leadTime, wait(t, dora.leadTime)),
          stat(t.team.changeFailureRate, `${Math.round(dora.changeFailureRate * 100)}%`),
          stat(t.team.mttr, dora.mttr === null ? '—' : wait(t, dora.mttr)),
        ],
      ),
    ],
  )
}

const floor = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  return h.div(
    [
      h.Class(
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
      ),
      h.DataAttribute('team-drag-floor', ''),
      ...(DragAndDrop.isDragging(model.board.team.drag)
        ? [h.DataAttribute('team-drag-active', '')]
        : []),
    ],
    [
      game.sandbox ? h.empty : servicesCard(model, h),
      doraCard(game, h),
      ...game.teams.map((team, index) => pod(model, team, index, h)),
      Option.match(DragAndDrop.ghostStyle(model.board.team.drag), {
        onNone: () => h.empty,
        onSome: (style) =>
          Option.match(DragAndDrop.maybeDraggedItemId(model.board.team.drag), {
            onNone: () => h.empty,
            onSome: (id) =>
              h.div(
                [
                  h.Style(style),
                  h.Class(
                    cx(
                      PANEL,
                      css({
                        pointerEvents: 'none',
                        zIndex: '50',
                        paddingInline: '4',
                        paddingBlock: '3',
                        fontSize: 'calc(0.875rem * var(--type-scale))',
                        lineHeight: 'calc(1.25 / 0.875)',
                        fontWeight: '500',
                      }),
                    ),
                  ),
                ],
                [nameOf(id)],
              ),
          }),
      }),
      game.stage >= 1 && game.teams.length < MAX_TEAMS
        ? h.button(
            [
              h.Key('new-team'),
              h.Type('button'),
              h.OnClick(Message.TeamChanged({ message: TeamMessage.Created() })),
              h.Class(
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
                    fontSize: 'calc(13px*var(--type-scale))',
                    fontWeight: '500',
                    color: 'mutedForeground',
                    _hover: {
                      borderColor: 'color-mix(in oklab, var(--foreground) 40%, transparent)',
                      color: 'foreground',
                    },
                  }),
                  'press',
                ),
              ),
            ],
            [
              icon(
                h,
                Plus,
                css({
                  width: '4',
                  height: '4',
                }),
              ),
              t.team.newTeam,
            ],
          )
        : h.empty,
    ],
  )
}

const stackName = (t: Messages, runtime: RuntimeId, framework: FrameworkId): string =>
  `${t.catalog.runtimes[runtime].name}${framework === 'none' ? '' : ` · ${t.catalog.frameworks[framework].name}`}`

const migrationCard = (game: Game, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const migration = serviceOf(game).migration
  if (!migration) return h.empty
  const shifted = stepOf(migration)
  const done = migration._tag === 'Finishing'
  const current = shifted > 0 ? (MIGRATION_STEPS[shifted - 1] ?? 1) : 0
  const next = MIGRATION_STEPS[shifted] ?? 1
  const language = RUNTIMES[migration.runtime].language
  const brand = STACK_LOGOS[language].color ?? 'var(--group-compute)'
  const step = game.backlog.find((item) => item.kind === 'migration')
  const percent = (share: number) => `${Math.round(share * 100)}%`
  return h.section(
    [
      h.Key('migration'),
      h.Class(
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
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: '3',
              rowGap: '2',
            }),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  minWidth: '0',
                  flex: '1 1 0%',
                  alignItems: 'center',
                  gap: '2.5',
                }),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    css({
                      opacity: 0.45,
                      filter: 'grayscale(100%)',
                    }),
                  ),
                ],
                [
                  stackLogo(
                    RUNTIMES[migration.fromRuntime].language,
                    css({
                      width: '5',
                      height: '5',
                    }),
                    h,
                  ),
                ],
              ),
              h.span(
                [
                  h.Class(
                    css({
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 'calc(13px*var(--type-scale))',
                      color: 'mutedForeground',
                      textDecorationLine: 'line-through',
                      textDecorationColor:
                        'color-mix(in oklab, var(--foreground) 25%, transparent)',
                    }),
                  ),
                ],
                [stackName(t, migration.fromRuntime, migration.fromFramework)],
              ),
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
                language,
                css({
                  width: '5',
                  height: '5',
                }),
                h,
              ),
              h.span(
                [
                  h.Class(
                    css({
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 'calc(15px*var(--type-scale))',
                      fontWeight: '600',
                      letterSpacing: '-0.02em',
                    }),
                  ),
                ],
                [stackName(t, migration.runtime, migration.framework)],
              ),
              migration.bugs
                ? badge(
                    { variant: 'destructive' },
                    [
                      icon(
                        h,
                        Bug,
                        css({
                          width: '3',
                          height: '3',
                        }),
                      ),
                      t.team.bugs,
                    ],
                    h,
                  )
                : h.empty,
            ],
          ),
          done
            ? badge(
                { variant: 'secondary' },
                [
                  icon(
                    h,
                    Check,
                    css({
                      width: '3',
                      height: '3',
                    }),
                  ),
                  t.team.migrated,
                ],
                h,
              )
            : h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '2',
                    }),
                  ),
                ],
                [
                  h.span(
                    [
                      h.Class(
                        cx(
                          FIGURE,
                          css({
                            fontSize: 'calc(11.5px*var(--type-scale))',
                            color: 'mutedForeground',
                          }),
                        ),
                      ),
                    ],
                    [
                      isReady(migration)
                        ? t.team.ready
                        : step
                          ? `${codeOf('migration', step.ref)} · ${amount(step.spent)}/${dh(t, step.cost)}`
                          : '',
                    ],
                  ),
                  button(
                    { onClick: Message.MigrationCancelled(), variant: 'ghost', size: 'sm' },
                    [t.team.cancel],
                    h,
                  ),
                  button(
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
                    h,
                  ),
                ],
              ),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '1',
            }),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                cx(
                  css({
                    position: 'relative',
                    height: '7',
                    overflow: 'hidden',
                  }),
                  WELL,
                  css({
                    borderRadius: 'lg',
                  }),
                ),
              ),
            ],
            [
              done
                ? h.empty
                : h.div(
                    [
                      h.Class(
                        css({
                          position: 'absolute',
                          inset: '0',
                          transitionProperty: 'clip-path',
                          transitionDuration: '500ms',
                          transitionTimingFunction: 'out',
                        }),
                      ),
                      h.Style({
                        'background-color': `color-mix(in oklch, ${brand} ${isReady(migration) ? 45 : 18}%, transparent)`,
                        'background-image': STRIPES,
                        'clip-path': `inset(0 ${(1 - next) * 100}% 0 0)`,
                      }),
                    ],
                    [],
                  ),
              h.div(
                [
                  h.Class(
                    css({
                      position: 'absolute',
                      inset: '0',
                      boxShadow: 'inset 0 1px 0 oklch(1 0 0/0.3)',
                      transitionProperty: 'clip-path',
                      transitionDuration: '700ms',
                      transitionTimingFunction: 'in-out',
                    }),
                  ),
                  h.Style({
                    'background-color': brand,
                    'clip-path': `inset(0 ${(1 - current) * 100}% 0 0 round 8px)`,
                  }),
                ],
                [],
              ),
              ...MIGRATION_STEPS.slice(0, -1).map((share, at) =>
                h.div(
                  [
                    h.Key(`tick-${at}`),
                    h.Class(
                      css({
                        position: 'absolute',
                        insetBlock: '0',
                        width: '1px',
                        backgroundColor: 'color-mix(in oklab, var(--foreground) 15%, transparent)',
                      }),
                    ),
                    h.Style({ left: `${share * 100}%` }),
                  ],
                  [],
                ),
              ),
              h.span(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        position: 'absolute',
                        insetBlock: '0',
                        right: '2.5',
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: 'calc(11px*var(--type-scale))',
                        color: 'mutedForeground',
                      }),
                    ),
                  ),
                ],
                [t.team.ofTraffic(percent(current))],
              ),
            ],
          ),
          h.div(
            [
              h.Class(
                css({
                  position: 'relative',
                  height: '3.5',
                }),
              ),
            ],
            MIGRATION_STEPS.map((share, at) =>
              h.span(
                [
                  h.Key(`label-${at}`),
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        position: 'absolute',
                        top: '0',
                        fontSize: 'calc(10px*var(--type-scale))',
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
                  ),
                  h.Style({ left: `${share * 100}%` }),
                ],
                [percent(share)],
              ),
            ),
          ),
        ],
      ),
    ],
  )
}

type Status = 'queued' | 'building' | 'shipping' | 'live'

/** A Linear-style status mark: a dashed ring waits, a filling pie builds, a check is live. */
const statusMark = (status: Status, share: number, h: HtmlBuilder<Message>): Html => {
  const pie = 2 * Math.PI * 2.5
  const tone =
    status === 'building'
      ? css({ color: 'warn' })
      : status === 'queued'
        ? css({ color: 'mutedForeground' })
        : css({ color: 'ok' })
  return h.svg(
    [
      h.AriaHidden(true),
      h.Xmlns('http://www.w3.org/2000/svg'),
      h.ViewBox('0 0 14 14'),
      h.Fill('none'),
      h.Class(
        cx(
          css({
            width: '3.5',
            height: '3.5',
            flexShrink: '0',
          }),
          tone,
        ),
      ),
    ],
    status === 'live'
      ? [
          h.circle([h.Cx('7'), h.Cy('7'), h.R('6.5'), h.Fill('currentColor')]),
          h.path([
            h.D('M4.3 7.2 6.2 9 9.8 5.2'),
            h.Stroke('white'),
            h.StrokeWidth('1.5'),
            h.StrokeLinecap('round'),
            h.StrokeLinejoin('round'),
          ]),
        ]
      : [
          h.circle([
            h.Cx('7'),
            h.Cy('7'),
            h.R('6'),
            h.Stroke('currentColor'),
            h.StrokeWidth('1.5'),
            ...(status === 'queued' ? [h.Attribute('stroke-dasharray', '1.6 1.9')] : []),
          ]),
          status === 'queued'
            ? h.empty
            : h.circle([
                h.Cx('7'),
                h.Cy('7'),
                h.R('2.5'),
                h.Stroke('currentColor'),
                h.StrokeWidth('5'),
                h.Attribute('stroke-dasharray', `${pie * clamp(share)} ${pie}`),
                h.Attribute('transform', 'rotate(-90 7 7)'),
              ]),
        ],
  )
}

/** A stable identifier per catalog entry, as an issue tracker would show it. */
const codeOf = (kind: WorkKind, ref: string): string => {
  if (kind === 'feature') return `FEAT-${FEATURE_IDS.indexOf(ref as FeatureId) + 1}`
  if (kind === 'task') return `ENG-${TASK_IDS.indexOf(ref as TaskId) + 1}`
  if (kind === 'patch') return `SEC-${ref.slice(-4)}`
  if (kind === 'move') return ref === 'auth' ? 'MOV-1' : 'MOV-2'
  if (kind === 'split') return `SVC-${ref.replace(/\D/g, '') || '2'}`
  if (kind === 'lever') return `LVG-${LEVER_KINDS.indexOf(ref as LeverKind) + 1}`
  return `MIG-${ref.replace(/\D/g, '') || '1'}`
}

const label = (kind: WorkKind, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.span(
    [
      h.Class(
        css({
          display: 'inline-flex',
          height: '5',
          alignItems: 'center',
          gap: '1',
          borderRadius: '9999px',
          paddingInline: '1.5',
          fontSize: 'calc(10.5px*var(--type-scale))',
          fontWeight: '500',
          color: 'mutedForeground',
          boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
        }),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            cx(
              css({
                width: '1.5',
                height: '1.5',
                borderRadius: '9999px',
              }),
              kindOf(t)[kind].fill,
            ),
          ),
        ],
        [],
      ),
      kindOf(t)[kind].label,
    ],
  )
}

/** The wait that holds an item, in the words the Toast and the Mail use (18 "Blocked"). */
const waitOf = (t: Messages): Record<BlockKind, string> => ({
  decision: t.team.waitForDecision,
  index: t.team.waitForIndex,
  copy: t.team.waitForCopy,
  size: t.team.waitForSize,
})

/**
 * Why an item waits on the player, on its card. Without it a blocked item looks like a queued
 * one, and a full backlog over an idle team reads as a team that will not work.
 */
const waitChip = (item: WorkItem, h: HtmlBuilder<Message>): Html | null => {
  // A patch never waits, so an old save's block on one is not a wait to show.
  if (item.block._tag !== 'Blocked' || item.kind === 'patch') return null
  const t = copy(h)
  return h.span(
    [
      h.Class(
        css({
          display: 'inline-flex',
          height: '5',
          alignItems: 'center',
          gap: '1',
          borderRadius: '9999px',
          paddingInline: '1.5',
          fontSize: 'calc(10.5px*var(--type-scale))',
          fontWeight: '500',
          color: 'warn',
          boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
        }),
      ),
    ],
    [
      icon(
        h,
        Hourglass,
        css({
          width: '3',
          height: '3',
        }),
      ),
      t.team.waitingOnYou(waitOf(t)[item.block.reason]),
    ],
  )
}

/** The blocked items a team may take: what an idle team is waiting on the player for. */
const waitingFor = (game: Game, team: Team): number =>
  game.backlog.filter((item) => item.block._tag === 'Blocked' && worksOn(game, team, item)).length

/**
 * What a live Feature's users have and what A/B testing reads from it (08 "Adoption", "Measured
 * lift"): the adoption share, and the lift with its interval once the research is done.
 */
const featureReadout = (game: Game, id: FeatureId, h: HtmlBuilder<Message>): Html => {
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
  return h.span(
    [
      h.Class(
        css({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '1',
        }),
      ),
    ],
    [
      badge({ variant: 'secondary' }, [t.team.adopted(adopted)], h),
      ...(lift ? [badge({ variant: 'secondary' }, [lift], h)] : []),
    ],
  )
}

/** The share of the Team's Dev Hours that keeps the live Features running (08 "Upkeep"). */
const upkeepPill = (game: Game, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const share = upkeepShare(game, serviceOf(game))
  if (share <= 0) return h.empty
  return h.div(
    [
      h.Key('upkeep'),
      h.Class(
        cx(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            borderRadius: '10px',
            paddingInline: '2.5',
            paddingBlock: '2',
            fontSize: 'calc(11.5px*var(--type-scale))',
            color: 'mutedForeground',
            boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
          }),
        ),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            css({
              flex: '1 1 0%',
            }),
          ),
        ],
        [t.team.upkeep],
      ),
      h.span([h.Class(FIGURE)], [t.team.shareOfDevHours(Math.round(share * 100))]),
    ],
  )
}

/** A patch's clock: the time left, then red and counting how long it is overdue until it is exploited. */
const deadline = (game: Game, item: WorkItem, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  if (item.due === undefined) return h.empty
  const late = overdueBy(game, item)
  return h.span(
    [
      h.Class(
        cx(
          FIGURE,
          css({
            display: 'inline-flex',
            height: '5',
            alignItems: 'center',
            borderRadius: '9999px',
            paddingInline: '1.5',
            fontSize: 'calc(10.5px*var(--type-scale))',
            fontWeight: '500',
            whiteSpace: 'nowrap',
          }),
          late > 0
            ? css({
                backgroundColor: 'danger',
                color: 'white',
              })
            : css({
                color: 'mutedForeground',
                boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
              }),
        ),
      ),
    ],
    [
      late > 0
        ? t.team.exploitIn(wait(t, PATCH_GRACE - late))
        : t.team.dueIn(wait(t, item.due - game.time)),
    ],
  )
}

const estimate = (text: string, h: HtmlBuilder<Message>): Html =>
  h.span(
    [
      h.Class(
        cx(
          FIGURE,
          css({
            display: 'inline-flex',
            height: '5',
            alignItems: 'center',
            borderRadius: '9999px',
            paddingInline: '1.5',
            fontSize: 'calc(10.5px*var(--type-scale))',
            whiteSpace: 'nowrap',
            color: 'mutedForeground',
            boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
          }),
        ),
      ),
    ],
    [text],
  )

/** A small avatar for a card's assignees. */
const mini = (id: string | null, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.span(
    [
      h.Key(id ?? 'founder'),
      h.Title(id ? nameOf(id) : t.team.you),
      h.Class(
        cx(
          css({
            display: 'grid',
            width: '5',
            height: '5',
            flexShrink: '0',
            placeItems: 'center',
            borderRadius: '9999px',
            fontSize: 'calc(9.5px * var(--type-scale))',
            fontWeight: '600',
            color: 'white',
            boxShadow: '0 0 0 2px var(--card)',
            '&:not(:first-child)': { marginLeft: '-0.375rem' },
          }),
          id === null &&
            css({
              layerStyle: 'primaryFill',
              color: 'onPrimaryFill',
            }),
        ),
      ),
      ...(id === null ? [] : [h.Style({ 'background-color': `oklch(0.64 0.14 ${hueOf(id)})` })]),
    ],
    [
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
    ],
  )
}

const assignees = (game: Game, team: Team, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const people: ReadonlyArray<string | null> = [
    ...(game.teams[0]?.id === team.id ? [null] : []),
    ...membersOf(game, team).map((engineer) => engineer.id),
  ]
  const shown = people.slice(0, 4)
  return h.span(
    [
      h.Class(
        css({
          display: 'flex',
          alignItems: 'center',
        }),
      ),
      h.Title(t.team.labelColon(teamName(t, team)) + ` ${people.length}`),
    ],
    [
      ...shown.map((id) => mini(id, h)),
      people.length > shown.length
        ? h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    marginLeft: '1',
                    fontSize: 'calc(10.5px*var(--type-scale))',
                    color: 'mutedForeground',
                  }),
                ),
              ),
            ],
            [`+${people.length - shown.length}`],
          )
        : h.empty,
    ],
  )
}

const unassigned = (h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.span(
    [
      h.Title(t.team.unassigned),
      h.Class(
        css({
          width: '5',
          height: '5',
          borderRadius: '9999px',
          borderWidth: '1.5px',
          borderStyle: 'dashed',
          borderColor: 'color-mix(in oklab, var(--foreground) 25%, transparent)',
        }),
      ),
    ],
    [],
  )
}

const card = (
  key: string,
  code: string,
  title: string,
  status: Status,
  share: number,
  owner: Html,
  chips: ReadonlyArray<Html>,
  actions: ReadonlyArray<Html>,
  late: boolean,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [
      h.Key(key),
      h.Class(
        cx(
          late &&
            css({
              boxShadow: '0 0 0 1.5px var(--danger)',
            }),
          cx(
            css({
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '2',
              borderRadius: '10px',
              backgroundColor: 'card',
              paddingInline: '3',
              paddingBlock: '2.5',
              boxShadow: '0 0 0 1px var(--hairline-soft),0 1px 2px oklch(0 0 0/0.05)',
              transitionProperty: 'box-shadow',
              transitionDuration: '150ms',
              transitionTimingFunction: 'out',
              _hover: {
                boxShadow: '0 0 0 1px var(--hairline),0 2px 6px oklch(0 0 0/0.07)',
              },
            }),
            'group',
          ),
          status === 'live' &&
            css({
              backgroundColor: 'transparent',
              boxShadow: '0 0 0 1px var(--hairline-soft)',
            }),
        ),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    flex: '1 1 0%',
                    fontSize: 'calc(11px*var(--type-scale))',
                    color: 'mutedForeground',
                  }),
                ),
              ),
            ],
            [code],
          ),
          owner,
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'flex-start',
              gap: '2',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  marginTop: '2px',
                }),
              ),
            ],
            [statusMark(status, share, h)],
          ),
          h.span(
            [
              h.Class(
                cx(
                  css({
                    lineClamp: 2,
                    fontSize: 'calc(13px*var(--type-scale))',
                    lineHeight: '1.35',
                    fontWeight: '500',
                  }),
                  status === 'live' &&
                    css({
                      color: 'mutedForeground',
                    }),
                ),
              ),
            ],
            [title],
          ),
        ],
      ),
      chips.length > 0
        ? h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  minHeight: '5',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '1',
                }),
              ),
            ],
            chips,
          )
        : h.empty,
      actions.length > 0
        ? h.div(
            [
              h.Class(
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
                  boxShadow: '0 0 0 1px var(--hairline-soft),0 2px 6px oklch(0 0 0/0.08)',
                  transitionProperty: 'opacity',
                  transitionDuration: '150ms',
                  transitionTimingFunction: 'out',
                  '.group:hover &': {
                    opacity: 1,
                  },
                  '.group:focus-within &': {
                    opacity: 1,
                  },
                }),
              ),
            ],
            actions,
          )
        : h.empty,
    ],
  )

const rush = (game: Game, item: WorkItem, h: HtmlBuilder<Message>): Html => {
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

const cancel = (item: WorkItem, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return item.kind === 'migration' || item.ref === 'fix-bugs'
    ? h.empty
    : iconButton(t.team.cancel, X, Message.WorkCancelled({ id: item.id }), true, h)
}

const backlogCard = (
  game: Game,
  item: WorkItem,
  index: number,
  team: Team | undefined,
  h: HtmlBuilder<Message>,
): Html => {
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
        : h.empty,
      team
        ? h.empty
        : iconButton(
            t.team.up,
            ArrowUp,
            Message.WorkMoved({ id: item.id, direction: -1 }),
            index > 0,
            h,
          ),
      team
        ? h.empty
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

const idleCard = (game: Game, team: Team, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const waits = waitingFor(game, team)
  return h.div(
    [
      h.Key(`idle-${team.id}`),
      h.Class(
        css({
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          borderRadius: '10px',
          borderWidth: '1.5px',
          borderStyle: 'dashed',
          borderColor: 'color-mix(in oklab, var(--foreground) 15%, transparent)',
          paddingInline: '3',
          paddingBlock: '2.5',
        }),
      ),
    ],
    [
      assignees(game, team, h),
      h.span(
        [
          h.Class(
            css({
              minWidth: '0',
              flex: '1 1 0%',
              fontSize: 'calc(12.5px*var(--type-scale))',
              lineHeight: '1.375',
              color: 'mutedForeground',
            }),
          ),
        ],
        [
          game.teams[0]?.id === team.id || membersOf(game, team).length > 0
            ? waits > 0
              ? t.team.idleOnYou(teamName(t, team), waits)
              : t.team.idle(teamName(t, team))
            : t.team.noEngineersOn(teamName(t, team)),
        ],
      ),
    ],
  )
}

const column = (
  key: string,
  status: Status,
  title: string,
  count: number,
  top: Html,
  cards: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [
      h.Key(key),
      h.Class(
        css({
          display: 'flex',
          minHeight: '260px',
          minWidth: '0',
          flexDirection: 'column',
          gap: '1.5',
          borderRadius: 'xl',
          backgroundColor:
            'color-mix(in oklab, var(--foreground) 2.8000000000000003%, transparent)',
          padding: '1.5',
        }),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              paddingInline: '1.5',
              paddingTop: '1',
              paddingBottom: '1',
            }),
          ),
        ],
        [
          statusMark(status, status === 'building' ? 0.5 : 1, h),
          h.span(
            [
              h.Class(
                css({
                  fontSize: 'calc(12.5px*var(--type-scale))',
                  fontWeight: '500',
                }),
              ),
            ],
            [title],
          ),
          h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'calc(12px*var(--type-scale))',
                    color: 'mutedForeground',
                  }),
                ),
              ),
            ],
            [String(count)],
          ),
        ],
      ),
      top,
      ...cards,
    ],
  )

const deployPill = (game: Game, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const built = awaitingFeatures(game).length
  const left = serviceOf(game).nextDeployAt - game.time
  const chance = nextBadDeployChance(game)
  const stalled = game.incident?.kind === 'bad-deploy'
  return h.div(
    [
      h.Key('deploy'),
      h.Class(
        cx(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '2.5',
            borderRadius: '10px',
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
                boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
              }),
        ),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            cx(
              css({
                position: 'relative',
                display: 'grid',
                width: '8',
                height: '8',
                flexShrink: '0',
                placeItems: 'center',
                borderRadius: '9999px',
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
          ),
        ],
        [
          icon(
            h,
            Rocket,
            css({
              width: '3.5',
              height: '3.5',
            }),
          ),
          built > 0 && !stalled
            ? h.span(
                [
                  h.Class(
                    css({
                      position: 'absolute',
                      inset: '-3px',
                    }),
                  ),
                ],
                [
                  ring(
                    1 - left / deployEvery(game),
                    css({
                      width: '38px',
                      height: '38px',
                      color: 'ok',
                    }),
                    h,
                  ),
                ],
              )
            : h.empty,
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              minWidth: '0',
              flexDirection: 'column',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'calc(12.5px*var(--type-scale))',
                  fontWeight: '500',
                }),
              ),
            ],
            [
              built === 0
                ? t.team.nothingToShip
                : stalled
                  ? t.team.held
                  : t.team.deployIn(wait(t, left)),
            ],
          ),
          chance > 0
            ? h.span(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'calc(10.5px*var(--type-scale))',
                      }),
                      chance >= 0.15
                        ? css({
                            color: 'warn',
                          })
                        : css({
                            opacity: 0.6,
                          }),
                    ),
                  ),
                  h.Title(t.team.chanceADeployShipsABug),
                ],
                [t.team.badDeploys(Math.round(chance * 100))],
              )
            : h.empty,
        ],
      ),
    ],
  )
}

const LIVE_SHOWN = 4

const board = (game: Game, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const assigned = assignments(game)
  const building = new Set([...assigned.values()].map((item) => item.id))
  const queue = game.backlog.filter((item) => !building.has(item.id))
  const builders = game.teams.filter((team) => team.kind === 'product')
  const live = [...liveFeatures(game)].reverse()
  return h.div(
    [
      h.Class(
        css({
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '2',
          _narrow: {
            gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
          },
        }),
      ),
    ],
    [
      column(
        'queued',
        'queued',
        t.team.upNext,
        queue.length,
        h.empty,
        queue.map((item) => backlogCard(game, item, game.backlog.indexOf(item), undefined, h)),
        h,
      ),
      column(
        'building',
        'building',
        t.team.inProgress,
        building.size,
        h.empty,
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
            h.empty,
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
                h.empty,
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
            ? h.span(
                [
                  h.Key('more'),
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        paddingInline: '2',
                        paddingBlock: '1',
                        fontSize: 'calc(11px*var(--type-scale))',
                        color: 'mutedForeground',
                      }),
                    ),
                  ),
                ],
                [t.team.more(live.length - LIVE_SHOWN)],
              )
            : h.empty,
        ],
        h,
      ),
    ],
  )
}

const autopilot = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  return h.button(
    [
      h.Type('button'),
      h.Role('switch'),
      h.AriaChecked(game.autopilot),
      h.OnClick(Message.AutopilotToggled()),
      h.Class(
        cx(
          cx(
            css({
              display: 'inline-flex',
              height: '7',
              alignItems: 'center',
              gap: '1.5',
              borderRadius: '9999px',
              paddingRight: '1',
              paddingLeft: '2.5',
              fontSize: 'calc(11.5px*var(--type-scale))',
              fontWeight: '500',
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
                boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
                _hover: {
                  color: 'foreground',
                },
              }),
        ),
      ),
    ],
    [
      icon(
        h,
        Bot,
        css({
          width: '3.5',
          height: '3.5',
        }),
      ),
      t.team.autopilot,
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                borderRadius: '9999px',
                paddingInline: '1.5',
                paddingBlock: '0.5',
                fontSize: 'calc(10px*var(--type-scale))',
              }),
              game.autopilot
                ? css({
                    backgroundColor: 'color-mix(in oklab, white 20%, transparent)',
                  })
                : css({
                    backgroundColor: 'well',
                  }),
            ),
          ),
        ],
        [game.autopilot ? t.team.oN : t.team.oFF],
      ),
    ],
  )
}

/** The Autopilot perk's policies (13 "The Legacy shop"): a switch for each level the perk has. */
const policyCopy = (t: Messages): Readonly<Record<'research' | 'hire' | 'upgrade', string>> => ({
  research: t.team.policyResearch,
  hire: t.team.policyHire,
  upgrade: t.team.policyUpgrade,
})

const policies = (model: Model, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)
  const game = model.board.game
  const level = perkLevel(game, 'autopilot')
  return (['research', 'hire', 'upgrade'] as const)
    .filter((policy) => level >= POLICY_LEVEL[policy])
    .map((policy) =>
      h.button(
        [
          h.Key(`policy-${policy}`),
          h.Type('button'),
          h.Role('switch'),
          h.AriaChecked(game.policies[policy]),
          h.OnClick(Message.PolicyToggled({ policy, on: !game.policies[policy] })),
          h.Class(
            cx(
              cx(
                css({
                  display: 'inline-flex',
                  height: '7',
                  alignItems: 'center',
                  gap: '1.5',
                  borderRadius: '9999px',
                  paddingInline: '2.5',
                  fontSize: 'calc(11.5px*var(--type-scale))',
                  fontWeight: '500',
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
                    boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
                    _hover: {
                      color: 'foreground',
                    },
                  }),
            ),
          ),
        ],
        [policyCopy(t)[policy]],
      ),
    )
}

/** Chaos experiments (10 "Track: Reliability"): the Company's own failure injection, once researched. */
const chaos = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const target = game.weakest
    ? t.catalog.components[game.nodes.find((entry) => entry.id === game.weakest)?.type ?? 'server']
        .name
    : null
  return h.button(
    [
      h.Type('button'),
      h.Role('switch'),
      h.AriaChecked(game.chaos),
      h.AriaLabel(target ? t.team.chaosNextHitsLabel(target) : t.team.chaosExperiments),
      h.Title(target ? t.team.chaosNextHits(target) : t.team.chaosExperiments),
      h.OnClick(Message.ChaosChosen({ chaos: !game.chaos })),
      h.Class(
        cx(
          cx(
            css({
              display: 'inline-flex',
              height: '7',
              alignItems: 'center',
              gap: '1.5',
              borderRadius: '9999px',
              paddingRight: '1',
              paddingLeft: '2.5',
              fontSize: 'calc(11.5px*var(--type-scale))',
              fontWeight: '500',
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
                boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
                _hover: {
                  color: 'foreground',
                },
              }),
        ),
      ),
    ],
    [
      icon(
        h,
        FlaskConical,
        css({
          width: '3.5',
          height: '3.5',
        }),
      ),
      t.team.chaos,
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                borderRadius: '9999px',
                paddingInline: '1.5',
                paddingBlock: '0.5',
                fontSize: 'calc(10px*var(--type-scale))',
              }),
              game.chaos
                ? css({
                    backgroundColor: 'color-mix(in oklab, white 20%, transparent)',
                  })
                : css({
                    backgroundColor: 'well',
                  }),
            ),
          ),
        ],
        [game.chaos ? t.team.oN : t.team.oFF],
      ),
    ],
  )
}

const costPill = (cost: number, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.span(
    [
      h.Class(
        cx(
          FIGURE,
          css({
            flexShrink: '0',
            borderRadius: '9999px',
            layerStyle: 'primaryFill',
            paddingInline: '2',
            paddingBlock: '0.5',
            fontSize: 'calc(10.5px*var(--type-scale))',
            color: 'onPrimaryFill',
            boxShadow: 'primary',
          }),
        ),
      ),
    ],
    [dh(t, cost)],
  )
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
  status: Html,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [
      h.Key(key),
      h.Class(
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
                boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
              })
            : state === 'done'
              ? css({
                  backgroundColor: 'okSoft',
                  boxShadow: 'inset 0 0 0 1px color-mix(in oklch,var(--ok) 18%,transparent)',
                })
              : css({
                  layerStyle: 'raised',
                  boxShadow: 'raised',
                }),
        ),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'flex-start',
              gap: '2',
            }),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  minWidth: '0',
                  flex: '1 1 0%',
                  flexDirection: 'column',
                }),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'calc(10.5px*var(--type-scale))',
                        color: 'mutedForeground',
                      }),
                    ),
                  ),
                ],
                [code],
              ),
              h.span(
                [
                  h.Class(
                    css({
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 'calc(13px*var(--type-scale))',
                      fontWeight: '600',
                    }),
                  ),
                ],
                [name],
              ),
            ],
          ),
          state === 'done' ? h.empty : costPill(cost, h),
        ],
      ),
      h.span(
        [
          h.Class(
            css({
              lineClamp: 2,
              minHeight: '2lh',
              fontSize: 'calc(11.5px*var(--type-scale))',
              lineHeight: '1.375',
              color: 'mutedForeground',
            }),
          ),
        ],
        [effect],
      ),
      extra
        ? h.span(
            [
              h.Class(
                css({
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'calc(11.5px*var(--type-scale))',
                  color: 'warn',
                }),
              ),
            ],
            [extra],
          )
        : h.empty,
      h.div(
        [
          h.Class(
            css({
              marginTop: 'auto',
              display: 'flex',
              justifyContent: 'flex-end',
              paddingTop: '0.5',
            }),
          ),
        ],
        [status],
      ),
    ],
  )

/** A tile's action: queue it, or, while Research locks it, open that Research. */
const queueButton = (
  label: string,
  message: Message,
  refusal: string | null,
  needs: ResearchId | null,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)
  if (refusal !== null && needs !== null)
    return button(
      {
        onClick: Message.ResearchShown({ id: needs }),
        variant: 'outline',
        size: 'sm',
        className: css({
          maxWidth: '100%',
        }),
        attributes: [h.Title(refusal)],
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
        h.span(
          [
            h.Class(
              css({
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }),
            ),
          ],
          [t.catalog.research[needs].name],
        ),
      ],
      h,
    )
  return button(
    {
      onClick: message,
      isDisabled: refusal !== null,
      variant: 'outline',
      size: 'sm',
      attributes: [h.Title(refusal ?? t.team.addToTheBacklog)],
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
    h,
  )
}

/** A tile's place on the board, in the board's own column names. */
const queuedBadge = (building: ReadonlySet<string>, ref: string, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return building.has(ref)
    ? badge(
        {
          variant: 'outline',
        },
        [statusMark('building', 0.5, h), t.team.inProgress],
        h,
      )
    : badge(
        {
          variant: 'outline',
        },
        [statusMark('queued', 0, h), t.team.upNext],
        h,
      )
}

const featureTile = (
  game: Game,
  id: FeatureId,
  review: boolean,
  building: ReadonlySet<string>,
  h: HtmlBuilder<Message>,
) => {
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
    featureHoursOf(game, id),
    def.era > game.stage ? `${t.catalog.eras[def.era]?.name ?? ''} · ${def.effect}` : def.effect,
    review && def.hidden && !live ? def.hidden : null,
    state,
    live
      ? badge(
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
          h,
        )
      : built
        ? badge(
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
            h,
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

/** A runbook names one incident kind: a chip per kind the team has handled, waiting for one. */
const runbookPicker = (game: Game, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const kinds = runbookKinds(game)
  if (kinds.length === 0)
    return h.span(
      [
        h.Class(
          css({
            fontSize: 'calc(11.5px*var(--type-scale))',
            color: 'mutedForeground',
          }),
        ),
      ],
      [t.team.handleIncidentFirst],
    )
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1',
        }),
      ),
    ],
    kinds.map((kind) => {
      const refusal = runbookRefusal(game, kind)
      const queued = game.backlog.some(
        (item) => item.kind === 'task' && item.ref === 'runbook' && item.target === kind,
      )
      return h.button(
        [
          h.Key(`runbook-${kind}`),
          h.Type('button'),
          h.OnClick(Message.RunbookQueued({ kind })),
          h.Disabled(refusal !== null),
          h.Title(
            refusal
              ? runbookWhy(t, game, kind, refusal)
              : t.team.writeRunbookFor(t.catalog.incidents[kind].name),
          ),
          h.Class(
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
              fontSize: 'calc(11px*var(--type-scale))',
              fontWeight: '500',
              color: 'mutedForeground',
              transitionProperty:
                'color, background-color, border-color, text-decoration-color, fill, stroke',
              transitionDuration: '150ms',
              transitionTimingFunction: 'out',
              _hover: {
                color: 'foreground',
              },
              _disabled: {
                opacity: 0.5,
              },
            }),
          ),
        ],
        [
          icon(
            h,
            queued ? Hourglass : Plus,
            css({
              width: '3',
              height: '3',
            }),
          ),
          h.span(
            [
              h.Class(
                css({
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }),
              ),
            ],
            [t.catalog.incidents[kind].name],
          ),
        ],
      )
    }),
  )
}

const taskTile = (
  game: Game,
  id: TaskId,
  building: ReadonlySet<string>,
  h: HtmlBuilder<Message>,
) => {
  const t = copy(h)

  const done = serviceOf(game).fixes.includes(id as never)
  const queued = game.backlog.some((item) => item.ref === id)
  // A runbook tile picks its incident kind in the tile, so its own refusal is only the research.
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
            h,
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

const work = (model: Model, h: HtmlBuilder<Message>): Html => {
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
  return h.div(
    [
      h.Class(
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
      ),
    ],
    [
      migrationCard(game, h),
      heading(
        t.team.board,
        h.div(
          [
            h.Class(
              css({
                display: 'flex',
                alignItems: 'center',
                gap: '2',
              }),
            ),
          ],
          [
            autopilot(model, h),
            ...policies(model, h),
            ...(has(game, 'chaos-engineering') ? [chaos(model, h)] : []),
          ],
        ),
        h,
      ),
      board(game, h),
      heading(
        t.team.features,
        h.span(
          [
            h.Class(
              cx(
                FIGURE,
                css({
                  fontSize: 'calc(11px*var(--type-scale))',
                  color: 'mutedForeground',
                }),
              ),
            ),
          ],
          [t.team.live2(live, features.length)],
        ),
        h,
      ),
      h.div(
        [h.Class(TILES)],
        features.map((id) => featureTile(game, id, review, building, h)),
      ),
      engineering ? heading(t.team.engineering, h.empty, h) : h.empty,
      engineering
        ? h.div(
            [
              h.Class(
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
              ),
            ],
            tasks.map((id) => taskTile(game, id, building, h)),
          )
        : h.empty,
    ],
  )
}

export const teamPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const rate = devHoursRate(game, ledgerOf(model))
  const payroll = payrollOf(game)
  return shell(
    t.team.team,
    [
      payroll > 0
        ? h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'calc(12px*var(--type-scale))',
                    whiteSpace: 'nowrap',
                    color: 'mutedForeground',
                    _compact: {
                      display: 'none',
                    },
                  }),
                ),
              ),
            ],
            [t.team.sPayroll(money(payroll))],
          )
        : h.empty,
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                display: 'flex',
                alignItems: 'baseline',
                gap: '1.5',
                borderRadius: '9999px',
                backgroundColor: 'well',
                paddingInline: '3',
                paddingBlock: '1',
                fontSize: 'calc(15px*var(--type-scale))',
                whiteSpace: 'nowrap',
                boxShadow: 'well',
              }),
            ),
          ),
        ],
        [
          dh(t, game.devHours),
          h.span(
            [
              h.Class(
                css({
                  fontSize: 'calc(11px*var(--type-scale))',
                  color: 'ok',
                }),
              ),
            ],
            [t.team.min(perMinute(rate))],
          ),
        ],
      ),
    ],
    [
      h.div(
        [
          h.Class(
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
          ),
        ],
        [
          h.div(
            [
              h.Class(
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
              ),
            ],
            [floor(model, h)],
          ),
          work(model, h),
        ],
      ),
    ],
    css({ maxWidth: '1360px', height: 'min(820px, 100%)' }),
    h,
  )
}
