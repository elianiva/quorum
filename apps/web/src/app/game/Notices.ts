import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import {
  Check,
  ChevronRight,
  Crosshair,
  FileBadge,
  FlaskConical,
  Lock,
  TriangleAlert,
  X,
} from 'lucide'
import { ALERT_RULES, type InsightPool } from '@quorum/simulation/catalog'
import type { AlertRule } from '@quorum/simulation/events'
import { has } from '@quorum/simulation/lookups'
import { ignored } from '@quorum/simulation/step'
import { activeIncident, type Game } from '@quorum/simulation/state'
import { formats } from '@/i18n/format.ts'
import { copy, insightName, type Messages } from '@/i18n/messages.ts'
import { nameIn } from '@/i18n/refusal.ts'
import { Message } from '@/game/message.ts'
import type { Model } from '@/game/model.ts'
import { badge } from '../ui/badge.ts'
import { buttonClass, type ButtonSize, type ButtonVariant } from '../ui/button-styles.ts'
import { icon } from '../ui/icon.ts'
import { compact } from '@quorum/ui/game/format'
import { recipeOf } from '@quorum/ui/game/pools'
import { EYEBROW, FIGURE, toneText, type Tone } from '@quorum/ui/game/bits'
import { POOL_ICONS, poolColor } from '@quorum/ui/game/pool-visuals'

type Content = View.Content<Message>
type Label = View.Content<Message> | string | false | null | undefined

const button = (
  h: H<Message>,
  config: Readonly<{
    onClick?: Message
    isDisabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    variant?: ButtonVariant
    size?: ButtonSize
    className?: string
    attributes?: Readonly<Record<string, string | undefined>>
  }>,
  label: Label | ReadonlyArray<Label>,
): Content => {
  const base = h.button
    .attr('type', config.type ?? 'button')
    .attr('tabindex', '0')
    .attr('aria-disabled', config.isDisabled ? 'true' : undefined)
    .attr('data-disabled', config.isDisabled ? '' : undefined)
    .class(buttonClass(config.variant, config.size), config.className)
    .attr('data-slot', 'button')
    .attrs(config.attributes ?? {})
  const clickable =
    config.onClick !== undefined && config.isDisabled !== true
      ? base.on('click', () => config.onClick)
      : base
  const inputs: ReadonlyArray<View.Input<Message>> = Array.isArray(label) ? label : [label]
  return clickable.children(...inputs)
}

const closeButton = (
  h: H<Message>,
  config: Readonly<{ label: string; onClick: Message; className?: string }>,
): Content =>
  h.button
    .attr('type', 'button')
    .attr('aria-label', config.label)
    .attr('title', config.label)
    .on('click', () => config.onClick)
    .class(
      cx(
        css({
          position: 'absolute',
          top: '1.5',
          right: '1.5',
          zIndex: 10,
          display: 'grid',
          width: '7',
          height: '7',
          placeItems: 'center',
          borderRadius: 'lg',
          color: 'color-mix(in oklab, var(--muted-foreground) 80%, transparent)',
          _hover: { backgroundColor: 'well', color: 'foreground' },
          _focusVisible: {
            boxShadow: 'focus',
            outlineStyle: 'none',
          },
        }),
        config.className,
      ),
    )
    .children(icon(h, X, css({ width: '3.5', height: '3.5' })))

/* The Insight cost chip `@quorum/ui/game/bits` drew, hand-written for Effect UI. */
const insightChip = (
  h: H<Message>,
  pool: InsightPool,
  figure: string,
  name: string,
  grey = false,
  tone: Tone = 'plain',
): Content =>
  h.span
    .attr('title', `${name} ${figure}`)
    .attr('aria-label', `${name} ${figure}`)
    .class(
      cx(
        FIGURE,
        css({
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.75',
          whiteSpace: 'nowrap',
        }),
      ),
    )
    .children(
      h.span
        .class(
          css({
            display: 'inline-flex',
          }),
        )
        .style({ color: grey ? 'var(--muted-foreground)' : poolColor(pool) })
        .children(
          icon(
            h,
            POOL_ICONS[pool],
            css({
              width: '3',
              height: '3',
              flexShrink: '0',
            }),
          ),
        ),
      h.span
        .attr('aria-hidden', 'true')
        .class(
          grey
            ? css({
                color: 'mutedForeground',
              })
            : tone === 'plain'
              ? ''
              : toneText(tone),
        )
        .children(figure),
    )

const ALARM = cx(
  'enter-down',
  css({
    pointerEvents: 'auto',
    display: 'flex',
    minWidth: '0',
    alignItems: 'center',
    gap: '2.5',
    borderRadius: 'xl',
    backgroundColor: 'danger',
    paddingBlock: '1.5',
    paddingRight: '1.5',
    paddingLeft: '3',
    fontSize: 'type.13',
    fontWeight: 'semibold',
    color: 'white',
    boxShadow:
      'inset 0 1px 0 oklch(1 0 0/0.25), 0 0 0 1px color-mix(in oklch, var(--danger), black 25%), 0 10px 24px -8px color-mix(in oklch, var(--danger) 60%, transparent)',
  }),
)

const STATE = cx(
  'enter-down',
  css({
    pointerEvents: 'auto',
    display: 'flex',
    minWidth: '0',
    alignItems: 'center',
    gap: '2',
    borderRadius: 'xl',
    layerStyle: 'surface',
    paddingBlock: '1',
    paddingRight: '1',
    paddingLeft: '3',
    fontSize: 'type.12-5',
    boxShadow: 'card',
  }),
)

type IncidentAction = Readonly<{
  label: (t: Messages) => string
  on: (nodeId: string) => Message
  node?: true
  locked?: (t: Messages, game: Game) => string | null
}>

const ACTIONS: Readonly<Record<string, IncidentAction>> = {
  'bad-deploy': {
    label: (t) => t.incidents.rollBack,
    on: () => Message.RolledBack(),
    locked: (t, game) =>
      has(game, 'ci') ? null : t.incidents.researchToRollBack(t.catalog.research.ci.name),
  },
  certificate: { label: (t) => t.incidents.renew, on: () => Message.CertificateRenewed() },
  bgp: { label: (t) => t.incidents.rollBack, on: () => Message.RoutesRolledBack() },
  config: { label: (t) => t.incidents.rollBack, on: () => Message.ConfigRolledBack() },
  partition: { label: (t) => t.incidents.fenceLeader, on: () => Message.LeaderFenced() },
  'migration-lock': {
    label: (t) => t.incidents.cancelMigration,
    on: () => Message.SchemaMigrationCancelled(),
  },
  'supply-chain': {
    label: (t) => t.incidents.pinAndRedeploy,
    on: () => Message.DependencyPinned(),
  },
  'accidental-delete': { label: (t) => t.incidents.restore, on: () => Message.TableRestored() },
  'leap-second': { label: (t) => t.incidents.restartNodes, on: () => Message.ClocksRestarted() },
  loop: { label: (t) => t.incidents.moveLogin, on: () => Message.KindMoved() },
  zone: { label: (t) => t.incidents.failOver, on: () => Message.ZoneFailedOver() },
  region: { label: (t) => t.incidents.failOver, on: () => Message.RegionFailedOver() },
  'dr-drill': { label: (t) => t.incidents.failOver, on: () => Message.RegionFailedOver() },
  'stale-opcache': {
    label: (t) => t.incidents.restart,
    node: true,
    on: (nodeId) => Message.RestartChosen({ nodeId }),
  },
  'gevent-compat': {
    label: (t) => t.incidents.restart,
    node: true,
    on: (nodeId) => Message.RestartChosen({ nodeId }),
  },
  'bun-compat': {
    label: (t) => t.incidents.restart,
    node: true,
    on: (nodeId) => Message.RestartChosen({ nodeId }),
  },
  'split-brain': {
    label: (t) => t.incidents.restartHub,
    node: true,
    on: (nodeId) => Message.RestartChosen({ nodeId }),
  },
  reconnect: {
    label: (t) => t.incidents.throttleConnects,
    node: true,
    on: (nodeId) => Message.ConnectsThrottled({ nodeId }),
  },
}

const severity = (h: H<Message>, value: number, t: Messages): Content =>
  h.span
    .class(
      cx(
        FIGURE,
        css({
          flexShrink: '0',
          borderRadius: 'md',
          paddingInline: '1',
          fontSize: 'type.10-5',
          fontWeight: 'medium',
          boxShadow: 'highlightLineStrong',
        }),
      ),
    )
    .children(t.incidents.sev(value))

export const incidentNotice = (h: H<Message>, model: Model): View.Input<Message> => {
  const t = copy(h)

  const incident = activeIncident(model.board.game)
  if (incident === null) return undefined
  const action = ACTIONS[incident.kind]
  const nodeId = incident.nodeId
  const ready = action !== undefined && (action.node !== true || nodeId !== null)
  const locked = ready && action?.locked ? action.locked(t, model.board.game) : null
  return h.div
    .key(`incident-${incident.kind}`)
    .attr('data-morph', 'notice')
    .attr('data-exit', 'notice')
    .class(ALARM)
    .children(
      icon(
        h,
        TriangleAlert,
        css({
          width: '4',
          height: '4',
          flexShrink: '0',
        }),
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
          h.div
            .class(
              css({
                display: 'flex',
                minWidth: '0',
                alignItems: 'center',
                gap: '2',
              }),
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
                .children(t.catalog.incidents[incident.kind].name),
              severity(h, incident.severity, t),
            ),
          incident.causedBy
            ? h.span
                .class(
                  css({
                    fontSize: 'type.11-5',
                    fontWeight: 'medium',
                    color: 'color-mix(in oklab, white 80%, transparent)',
                  }),
                )
                .children(
                  t.incidents.followedLeftAlone(t.catalog.incidents[incident.causedBy].name),
                )
            : undefined,
        ),
      ready && action !== undefined
        ? button(
            h,
            {
              onClick: action.on(nodeId ?? ''),
              isDisabled: locked !== null,
              size: 'sm',
              variant: 'outline',
              attributes: { title: locked ?? action.label(t) },
            },
            [
              icon(
                h,
                locked === null ? FileBadge : Lock,
                css({
                  width: '3.5',
                  height: '3.5',
                }),
              ),
              action.label(t),
            ],
          )
        : undefined,
      nodeId
        ? h.button
            .attr('type', 'button')
            .attr('title', t.incidents.showOnBoard)
            .attr('aria-label', t.incidents.showOnBoard)
            .on('click', () => Message.RevealNode({ nodeId }))
            .class(
              css({
                display: 'grid',
                width: '7',
                height: '7',
                flexShrink: '0',
                placeItems: 'center',
                borderRadius: 'lg',
                color: 'color-mix(in oklab, white 90%, transparent)',
                boxShadow: 'highlightLine',
                _hover: {
                  backgroundColor: 'color-mix(in oklab, white 10%, transparent)',
                },
              }),
            )
            .children(
              icon(
                h,
                Crosshair,
                css({
                  width: '3.5',
                  height: '3.5',
                }),
              ),
            )
        : undefined,
    )
}

export const alertsNotice = (h: H<Message>, model: Model): View.Input<Message> => {
  const t = copy(h)

  const game = model.board.game
  if (!has(game, 'alerting')) return undefined
  const rules = Object.keys(ALERT_RULES) as Array<AlertRule>
  const firing = rules.filter(
    (rule) => !ignored(game, rule) && game.alarms[rule] >= ALERT_RULES[rule].seconds,
  )
  const muted = rules.filter((rule) => ignored(game, rule))
  if (firing.length === 0 && muted.length === 0) return undefined
  const quiet = new Set<AlertRule>(model.board.alertQuiet)
  const loud = firing.filter((rule) => !quiet.has(rule))
  const folded = firing.length > 0 && loud.length === 0
  const shown = firing.length > 0 ? firing : muted
  const named = loud[0] ?? shown[0]
  if (named === undefined) return undefined
  const others = shown.length - 1
  const detail = folded ? null : formats(t).alertText(named, game.alertRules[named])
  return h.div
    .key(`alerts-${firing.join()}-${muted.join()}-${folded ? 'quiet' : 'loud'}`)
    .attr('data-morph', 'notice')
    .attr('data-exit', 'notice')
    .class(STATE)
    .children(
      h.span
        .attr('aria-hidden', 'true')
        .class(
          cx(
            css({
              width: '7px',
              height: '7px',
              flexShrink: '0',
              borderRadius: 'full',
            }),
            loud.length > 0
              ? css({
                  backgroundColor: 'warn',
                })
              : css({
                  backgroundColor: 'mutedForeground',
                }),
          ),
        )
        .children(),
      h.span
        .class(
          css({
            flexShrink: '0',
            fontWeight: 'semibold',
          }),
        )
        .children(
          firing.length > 0
            ? t.incidents.alertsFiring(firing.length)
            : t.incidents.ruleIgnored(muted.length),
        ),
      detail === null
        ? undefined
        : h.span
            .class(
              css({
                minWidth: '0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: 'mutedForeground',
              }),
            )
            .children(others > 0 ? `${detail} ${t.incidents.andMore(others)}` : detail),
      muted.length > 0 ? badge(h, { variant: 'warn' }, [t.incidents.ignored]) : undefined,
      loud.length > 0
        ? button(
            h,
            {
              onClick: Message.AlertsAcknowledged({ rules: [...firing] }),
              size: 'icon-sm',
              variant: 'ghost',
              attributes: {
                title: t.incidents.acknowledge,
                'aria-label': t.incidents.acknowledge,
              },
            },
            [
              icon(
                h,
                Check,
                css({
                  width: '3.5',
                  height: '3.5',
                }),
              ),
            ],
          )
        : undefined,
      button(
        h,
        {
          onClick: Message.AlertsShown(),
          size: 'sm',
          variant: 'ghost',
          attributes: { title: t.incidents.openAlerts },
        },
        [
          t.incidents.alerts,
          icon(
            h,
            ChevronRight,
            css({
              width: '3.5',
              height: '3.5',
            }),
          ),
        ],
      ),
    )
}

export const researchOffer = (h: H<Message>, model: Model): View.Input<Message> => {
  const t = copy(h)

  const offer = model.board.researchOffer
  if (offer === null || has(model.board.game, offer.id)) return undefined
  const research = t.catalog.research[offer.id]
  return h.div
    .key(`offer-${offer.id}`)
    .attr('role', 'status')
    .attr('aria-label', t.team.refusal.locked(nameIn(t, offer.what), research.name))
    .attr('data-morph', 'notice')
    .attr('data-exit', 'notice')
    .class(
      cx(
        css({
          pointerEvents: 'auto',
          position: 'fixed',
          bottom: '76px',
          left: '3',
          zIndex: '20',
          width: 'min(21rem,calc(100%-16px))',
          overflow: 'hidden',
          borderRadius: 'xl',
          layerStyle: 'surface',
          boxShadow: 'float',
          _compact: {
            position: 'relative',
            width: 'auto',
          },
        }),
        'enter-left',
      ),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'flex-start',
            gap: '2',
            paddingInline: '3',
            paddingTop: '2',
            paddingRight: '9',
            paddingBottom: '1.5',
          }),
        )
        .children(
          icon(
            h,
            FlaskConical,
            css({
              marginTop: '0.5',
              width: '4',
              height: '4',
              flexShrink: '0',
              color: 'mutedForeground',
            }),
          ),
          h.div
            .class(
              css({
                display: 'flex',
                minWidth: '0',
                flexDirection: 'column',
                gap: '0.5',
              }),
            )
            .children(
              h.span
                .class(
                  cx(
                    EYEBROW,
                    css({
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }),
                  ),
                )
                .children(t.research.locked, ' · ', nameIn(t, offer.what)),
              h.span
                .class(
                  css({
                    lineClamp: 2,
                    fontSize: 'type.13',
                    fontWeight: 'semibold',
                    lineHeight: 'snug',
                    textWrap: 'pretty',
                  }),
                )
                .children(research.name),
            ),
        ),
      closeButton(h, { label: t.inbox.dismiss, onClick: Message.ResearchOfferDismissed() }),
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            borderStyle: 'dashed',
            borderColor: 'hairline',
            paddingInline: '3',
            paddingBlock: '1.5',
          }),
        )
        .children(
          ...recipeOf(offer.id).map(([pool, cost]) =>
            insightChip(h, pool, compact(cost), insightName(t, pool)),
          ),
          h.div
            .class(
              css({
                marginLeft: 'auto',
                display: 'flex',
                flexShrink: '0',
                alignItems: 'center',
                gap: '1',
              }),
            )
            .children(
              button(
                h,
                {
                  onClick: Message.ResearchShown({ id: offer.id }),
                  size: 'sm',
                  attributes: { title: t.research.openResearch(research.name) },
                },
                [t.research.research],
              ),
            ),
        ),
    )
}
