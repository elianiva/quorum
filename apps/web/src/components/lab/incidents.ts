import { css, cx } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'
import {
  Check,
  ChevronRight,
  Crosshair,
  FileBadge,
  FlaskConical,
  Lock,
  TriangleAlert,
} from 'lucide'
import { ALERT_RULES } from '@quorum/simulation/catalog'
import type { AlertRule } from '@quorum/simulation/events'
import { has } from '@quorum/simulation/lookups'
import { ignored } from '@quorum/simulation/step'
import type { Game } from '@quorum/simulation/state'
import { formats } from '@/i18n/format.ts'
import { copy, insightName, type Messages } from '@/i18n/messages.ts'
import { nameIn } from '@/i18n/refusal.ts'
import { Message } from '@/game/message.ts'
import type { Model } from '@/game/model.ts'
import { badge } from '@quorum/ui/primitives/badge'
import { button, closeButton } from '@quorum/ui/primitives/button'
import { icon } from '@quorum/ui/primitives/icon'
import { cn } from '@/lib/utils'
import { compact } from '@quorum/ui/game/format'
import { recipeOf } from '@quorum/ui/game/pools'
import { EYEBROW, FIGURE, insightChip } from '@quorum/ui/game/bits'

/**
 * Notices, in two weights. The Alarm is the live incident: it is red because one click ends it, and
 * there is never more than one. The State chip is a standing condition, such as a rule that fires
 * or a team that has stopped trusting one, so it stays quiet and waits to be read.
 *
 * Everything the player may want to reread is Mail. Nothing here is a record.
 */

const ALARM = cx(
  'enter-down',
  css({
    pointerEvents: 'auto',
    display: 'flex',
    minWidth: '0',
    alignItems: 'center',
    gap: '0.625rem',
    borderRadius: 'xl',
    backgroundColor: 'var(--danger)',
    paddingBlock: '0.375rem',
    paddingRight: '0.375rem',
    paddingLeft: '0.75rem',
    fontSize: 'calc(13px * var(--type-scale))',
    fontWeight: '600',
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
    gap: '0.5rem',
    borderRadius: 'xl',
    layerStyle: 'surface',
    paddingBlock: '0.25rem',
    paddingRight: '0.25rem',
    paddingLeft: '0.75rem',
    fontSize: 'calc(12.5px * var(--type-scale))',
    boxShadow: 'card',
  }),
)

type IncidentAction = Readonly<{
  label: (t: Messages) => string
  on: (nodeId: string) => Message
  /** The button presses a Node's own action, so it needs the Node the incident hit. */
  node?: true
  /** Why the action is not ready, or null when it is. */
  locked?: (t: Messages, game: Game) => string | null
}>

/** What one click ends each incident, if a click ends it at all. */
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

/** A severity reads the same whether or not the player can pick the colour out, so the bar carries it. */
const severity = (value: number, t: Messages, h: HtmlBuilder<Message>): Html =>
  h.span(
    [
      h.Class(
        cn(
          FIGURE,
          css({
            flexShrink: '0',
            borderRadius: 'md',
            paddingInline: '0.25rem',
            fontSize: 'calc(10.5px*var(--type-scale))',
            fontWeight: '500',
            boxShadow: 'inset 0 0 0 1px oklch(1 0 0/0.42)',
          }),
        ),
      ),
    ],
    [t.incidents.sev(value)],
  )

/** The live incident, and the one click that ends it. Every incident shows, fix or no fix. */
export const incidentNotice = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const incident = model.board.game.incident
  if (!incident) return h.empty
  const action = ACTIONS[incident.kind]
  const nodeId = incident.nodeId
  const ready = action !== undefined && (action.node !== true || nodeId !== null)
  const locked = ready && action?.locked ? action.locked(t, model.board.game) : null
  return h.div(
    [
      h.Key(`incident-${incident.kind}`),
      h.DataAttribute('morph', 'notice'),
      h.DataAttribute('exit', 'notice'),
      h.Class(ALARM),
    ],
    [
      icon(
        h,
        TriangleAlert,
        css({
          width: '1rem',
          height: '1rem',
          flexShrink: '0',
        }),
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
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  minWidth: '0',
                  alignItems: 'center',
                  gap: '0.5rem',
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
                    }),
                  ),
                ],
                [t.catalog.incidents[incident.kind].name],
              ),
              severity(incident.severity, t, h),
            ],
          ),
          // A cascade carries the incident it followed (11 "Cascades"), so this reads as the second
          // page and not the first.
          incident.causedBy
            ? h.span(
                [
                  h.Class(
                    css({
                      fontSize: 'calc(11.5px*var(--type-scale))',
                      fontWeight: '500',
                      color: 'color-mix(in oklab, white 80%, transparent)',
                    }),
                  ),
                ],
                [t.incidents.followedLeftAlone(t.catalog.incidents[incident.causedBy].name)],
              )
            : h.empty,
        ],
      ),
      ready && action
        ? button(
            {
              onClick: action.on(nodeId ?? ''),
              isDisabled: locked !== null,
              size: 'sm',
              variant: 'outline',
              attributes: [h.Title(locked ?? action.label(t))],
            },
            [
              icon(
                h,
                locked === null ? FileBadge : Lock,
                css({
                  width: '0.875rem',
                  height: '0.875rem',
                }),
              ),
              action.label(t),
            ],
            h,
          )
        : h.empty,
      nodeId
        ? h.button(
            [
              h.Type('button'),
              h.Title(t.incidents.showOnBoard),
              h.AriaLabel(t.incidents.showOnBoard),
              h.OnClick(Message.RevealNode({ nodeId })),
              h.Class(
                css({
                  display: 'grid',
                  width: '1.75rem',
                  height: '1.75rem',
                  flexShrink: '0',
                  placeItems: 'center',
                  borderRadius: 'lg',
                  color: 'color-mix(in oklab, white 90%, transparent)',
                  boxShadow: 'inset 0 0 0 1px oklch(1 0 0/0.4)',
                  _hover: {
                    backgroundColor: 'color-mix(in oklab, white 10%, transparent)',
                  },
                }),
              ),
            ],
            [
              icon(
                h,
                Crosshair,
                css({
                  width: '0.875rem',
                  height: '0.875rem',
                }),
              ),
            ],
          )
        : h.empty,
    ],
  )
}

/**
 * The alert rules as one chip: what fires, what the team has stopped trusting, and the door to the
 * Alerts row, where the thresholds live. Acknowledged rules fold to a count until one clears.
 */
export const alertsNotice = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  if (!has(game, 'alerting')) return h.empty
  const rules = Object.keys(ALERT_RULES) as Array<AlertRule>
  const firing = rules.filter(
    (rule) => !ignored(game, rule) && game.alarms[rule] >= ALERT_RULES[rule].seconds,
  )
  const muted = rules.filter((rule) => ignored(game, rule))
  if (firing.length === 0 && muted.length === 0) return h.empty
  const quiet = new Set<AlertRule>(model.board.alertQuiet)
  const loud = firing.filter((rule) => !quiet.has(rule))
  const folded = firing.length > 0 && loud.length === 0
  const shown = firing.length > 0 ? firing : muted
  const named = loud[0] ?? shown[0]
  if (named === undefined) return h.empty
  const others = shown.length - 1
  const detail = folded ? null : formats(t).alertText(named, game.alertRules[named])
  return h.div(
    [
      h.Key(`alerts-${firing.join()}-${muted.join()}-${folded ? 'quiet' : 'loud'}`),
      h.DataAttribute('morph', 'notice'),
      h.DataAttribute('exit', 'notice'),
      h.Class(STATE),
    ],
    [
      h.span(
        [
          h.AriaHidden(true),
          h.Class(
            cn(
              css({
                width: '7px',
                height: '7px',
                flexShrink: '0',
                borderRadius: '9999px',
              }),
              loud.length > 0
                ? css({
                    backgroundColor: 'var(--warn)',
                  })
                : css({
                    backgroundColor: 'var(--muted-foreground)',
                  }),
            ),
          ),
        ],
        [],
      ),
      h.span(
        [
          h.Class(
            css({
              flexShrink: '0',
              fontWeight: '600',
            }),
          ),
        ],
        [
          firing.length > 0
            ? t.incidents.alertsFiring(firing.length)
            : t.incidents.ruleIgnored(muted.length),
        ],
      ),
      detail === null
        ? h.empty
        : h.span(
            [
              h.Class(
                css({
                  minWidth: '0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'var(--muted-foreground)',
                }),
              ),
            ],
            [others > 0 ? `${detail} ${t.incidents.andMore(others)}` : detail],
          ),
      muted.length > 0 ? badge({ variant: 'warn' }, [t.incidents.ignored], h) : h.empty,
      loud.length > 0
        ? button(
            {
              onClick: Message.AlertsAcknowledged({ rules: [...firing] }),
              size: 'icon-sm',
              variant: 'ghost',
              attributes: [h.Title(t.incidents.acknowledge), h.AriaLabel(t.incidents.acknowledge)],
            },
            [
              icon(
                h,
                Check,
                css({
                  width: '0.875rem',
                  height: '0.875rem',
                }),
              ),
            ],
            h,
          )
        : h.empty,
      button(
        {
          onClick: Message.AlertsShown(),
          size: 'sm',
          variant: 'ghost',
          attributes: [h.Title(t.incidents.openAlerts)],
        },
        [
          t.incidents.alerts,
          icon(
            h,
            ChevronRight,
            css({
              width: '0.875rem',
              height: '0.875rem',
            }),
          ),
        ],
        h,
      ),
    ],
  )
}

/**
 * The study slip a locked click leaves behind. It reads like a work order: what was blocked, the
 * Research that unblocks it, and its price. The width never changes, so a late Era's name wraps
 * inside the slip instead of stretching a sentence across the board. It waits, because a decision to
 * spend Insight does not belong on a timer.
 */
export const researchOffer = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const offer = model.board.researchOffer
  if (offer === null || has(model.board.game, offer.id)) return h.empty
  const research = t.catalog.research[offer.id]
  return h.div(
    [
      h.Key(`offer-${offer.id}`),
      h.Role('status'),
      h.AriaLabel(t.team.refusal.locked(nameIn(t, offer.what), research.name)),
      h.DataAttribute('morph', 'notice'),
      h.DataAttribute('exit', 'notice'),
      h.Class(
        cx(
          css({
            pointerEvents: 'auto',
            position: 'fixed',
            bottom: '76px',
            left: '0.75rem',
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
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              paddingInline: '0.75rem',
              paddingTop: '0.5rem',
              paddingRight: '2.25rem',
              paddingBottom: '0.375rem',
            }),
          ),
        ],
        [
          icon(
            h,
            FlaskConical,
            css({
              marginTop: '0.125rem',
              width: '1rem',
              height: '1rem',
              flexShrink: '0',
              color: 'var(--muted-foreground)',
            }),
          ),
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  minWidth: '0',
                  flexDirection: 'column',
                  gap: '0.125rem',
                }),
              ),
            ],
            [
              // The option that was refused is context, so it gives way; the Research is the offer.
              h.span(
                [
                  h.Class(
                    cn(
                      EYEBROW,
                      css({
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }),
                    ),
                  ),
                ],
                [t.research.locked, ' · ', nameIn(t, offer.what)],
              ),
              h.span(
                [
                  h.Class(
                    css({
                      lineClamp: 2,
                      fontSize: 'calc(13px*var(--type-scale))',
                      fontWeight: '600',
                      lineHeight: '1.375',
                      textWrap: 'pretty',
                    }),
                  ),
                ],
                [research.name],
              ),
            ],
          ),
        ],
      ),
      closeButton({ label: t.inbox.dismiss, onClick: Message.ResearchOfferDismissed() }, h),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderStyle: 'dashed',
              borderColor: 'var(--hairline)',
              paddingInline: '0.75rem',
              paddingBlock: '0.375rem',
            }),
          ),
        ],
        [
          ...recipeOf(offer.id).map(([pool, cost]) =>
            insightChip(pool, compact(cost), h, false, 'plain', insightName(t, pool)),
          ),
          h.div(
            [
              h.Class(
                css({
                  marginLeft: 'auto',
                  display: 'flex',
                  flexShrink: '0',
                  alignItems: 'center',
                  gap: '0.25rem',
                }),
              ),
            ],
            [
              button(
                {
                  onClick: Message.ResearchShown({ id: offer.id }),
                  size: 'sm',
                  attributes: [h.Title(t.research.openResearch(research.name))],
                },
                [t.research.research],
                h,
              ),
            ],
          ),
        ],
      ),
    ],
  )
}
