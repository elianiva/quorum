import { Component, Mount } from '@effect/ui'
import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { clockOf } from '@quorum/simulation/calendar'
import {
  FAMILIES,
  FAMILY_IDS,
  LANGUAGES,
  RUNTIMES,
  SIZES,
  STORAGE_IOPS,
} from '@quorum/simulation/catalog'
import type { FamilyId } from '@quorum/simulation/catalog'
import { burnOf, has, ramOf, resizePrice, vcpuOf } from '@quorum/simulation/lookups'
import {
  installedPart,
  marketDirection,
  marketPercent,
  partPrice,
  partsUnlocked,
  presetPlan,
  type SlotKind,
} from '@quorum/simulation/parts'
import type { GameNode, IopsClass } from '@quorum/simulation/state'
import { money } from '@quorum/ui/game/format'
import { Effect } from 'effect'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Cpu,
  HardDrive,
  Lock,
  MemoryStick,
  Search,
  X,
} from 'lucide'
import { copyIn, nodeTitle, type Messages } from '../../i18n/messages.ts'
import { Message } from '../../game/message.ts'
import type { Model, ShopMode, ShopSort } from '../../game/model.ts'
import { buttonClass } from '../ui/button-styles.ts'
import { icon } from '../ui/icon.ts'

/* The eyebrow and figure type styles come from @quorum/ui/game/bits, which
   imports Foldkit. The same Panda calls here produce the same classes. */
const EYEBROW = css({
  fontFamily: 'mono',
  fontSize: 'type.10-5',
  fontWeight: 'medium',
  textTransform: 'uppercase',
  letterSpacing: 'eyebrow',
  color: 'mutedForeground',
})

const FIGURE = css({
  fontFamily: 'mono',
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: 'subtle',
})

const FLOAT = css({ borderRadius: '2xl', layerStyle: 'surface', boxShadow: 'float' })

const SLOT_ORDER: ReadonlyArray<SlotKind> = ['cpu', 'ram', 'disk']
const SLOT_ICON = { cpu: Cpu, ram: MemoryStick, disk: HardDrive } as const
const WEEK_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

const searchable = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const SORTS: ReadonlyArray<readonly [ShopSort, string]> = [
  ['recommended', 'Recommended'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['capacity', 'Capacity'],
]

type PartCard = Readonly<{
  key: string
  title: string
  subtitle: string
  specs: ReadonlyArray<string>
  price: number
  priceLabel?: string | undefined
  cta?: string | undefined
  burn: string | null
  installed: boolean
  ready: boolean
  locked: boolean
  capacity: number
  search: string
  message: Message
}>

const slotTitle = (slot: SlotKind, t: Messages): string =>
  slot === 'cpu'
    ? t.inspector.partsCpu
    : slot === 'ram'
      ? t.inspector.partsMemory
      : t.inspector.partsDisk

const slotCopy = (t: Messages): Readonly<Record<ShopSort, string>> => ({
  recommended: t.shop.sortRecommended,
  'price-asc': t.shop.sortPriceLow,
  'price-desc': t.shop.sortPriceHigh,
  capacity: t.shop.sortCapacity,
})

const MODE_BAR = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.5',
  borderRadius: 'lg',
  backgroundColor: 'well',
  padding: '0.5',
})

const MODE_TAB = css({
  borderRadius: 'md',
  paddingInline: '2.5',
  paddingBlock: '1',
  fontSize: 'type.11-5',
  fontWeight: 'medium',
  color: 'mutedForeground',
  _hover: { color: 'foreground' },
})

const MODE_TAB_ACTIVE = css({
  backgroundColor: 'card',
  boxShadow: 'raised',
  color: 'foreground',
})

const MODE_TAB_LOCKED = css({
  cursor: 'not-allowed',
  opacity: 0.55,
  _hover: { color: 'mutedForeground' },
})

const modeSwitch = (h: H<Message>, model: Model, t: Messages) => {
  const unlocked = partsUnlocked(model.board.game)
  const mode = unlocked ? model.shopMode : 'instance'
  const tab = (value: ShopMode, label: string) => {
    const active = mode === value
    const locked = value === 'parts' && !unlocked
    const base = h.button.attr('type', 'button').attr('aria-pressed', active ? 'true' : 'false')
    const held = locked ? base.disabled(true).attr('title', t.shop.partsLocked) : base
    const clickable =
      active || locked ? held : held.on('click', () => Message.ShopModeChosen({ mode: value }))
    return clickable
      .class(cx(MODE_TAB, active ? MODE_TAB_ACTIVE : '', locked ? MODE_TAB_LOCKED : ''))
      .children(label)
  }
  return h.div
    .class(MODE_BAR)
    .children(tab('instance', t.shop.instances), tab('parts', t.shop.parts))
}

const CARD = css({
  display: 'flex',
  height: 'auto',
  minHeight: '27',
  justifyContent: 'flex-start',
  alignItems: 'stretch',
  flexDirection: 'column',
  gap: '1.5',
  whiteSpace: 'normal',
  padding: '3',
  textAlign: 'left',
  lineHeight: 'snug',
  _narrow: { minHeight: '24', padding: '2.5' },
})

const CARD_INSTALLED = css({
  layerStyle: 'raised',
  boxShadow: 'raised',
  borderColor: 'foreground',
})

const cardStyle = (installed: boolean) => cx(CARD, installed ? CARD_INSTALLED : '')

const CARD_HEAD = css({
  display: 'flex',
  width: '100%',
  minWidth: '0',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '2',
})

const CARD_TITLES = css({
  display: 'flex',
  minWidth: '0',
  flexDirection: 'column',
  gap: '0.25',
})

const CARD_TITLE = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 'type.14',
  fontWeight: 'semibold',
})

const CARD_SUBTITLE = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 'type.11-5',
  color: 'mutedForeground',
})

const CARD_CHECK = css({ width: '3.5', height: '3.5', flexShrink: '0', color: 'ok' })
const CARD_LOCK = css({
  width: '3.5',
  height: '3.5',
  flexShrink: '0',
  color: 'mutedForeground',
})

const CARD_SPECS = css({ display: 'flex', flexWrap: 'wrap', gap: '1' })

const CHIP = css({
  borderRadius: 'full',
  backgroundColor: 'well',
  paddingInline: '1.5',
  paddingBlock: '0.5',
  fontFamily: 'mono',
  fontSize: 'type.11',
  color: 'mutedForeground',
  whiteSpace: 'nowrap',
})

const CARD_FOOT = css({
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '2',
  marginTop: 'auto',
  paddingTop: '1',
})

const CARD_PRICE = cx(FIGURE, css({ fontSize: 'type.13' }))
const CARD_ACTION_OK = css({ fontSize: 'type.11', color: 'ok' })
const CARD_ACTION = css({ fontSize: 'type.11', color: 'mutedForeground' })

const partCard = (h: H<Message>, card: PartCard, t: Messages) => {
  const disabled = !card.installed && !card.ready
  const base = h.button
    .attr('type', 'button')
    .attr('tabindex', '0')
    .attr('aria-disabled', disabled ? 'true' : undefined)
    .attr('data-disabled', disabled ? '' : undefined)
    .class(buttonClass('outline', 'default', cardStyle(card.installed)))
    .attr('data-slot', 'button')
    .attr('title', card.locked ? t.shop.armLocked : `${card.title} · ${card.subtitle}`)
  const clickable = card.installed || disabled ? base : base.on('click', () => card.message)
  return clickable.children(
    h.div
      .class(CARD_HEAD)
      .children(
        h.div
          .class(CARD_TITLES)
          .children(
            h.span.class(CARD_TITLE).children(card.title),
            h.span.class(CARD_SUBTITLE).children(card.subtitle),
          ),
        card.installed
          ? icon(h, Check, CARD_CHECK)
          : card.locked
            ? icon(h, Lock, CARD_LOCK)
            : undefined,
      ),
    h.div.class(CARD_SPECS).children(
      card.specs.map((spec) => h.span.class(CHIP).children(spec)),
      card.burn === null ? undefined : h.span.class(CHIP).children(card.burn),
    ),
    h.div
      .class(CARD_FOOT)
      .children(
        h.span.class(CARD_PRICE).children(card.priceLabel ?? money(card.price)),
        h.span
          .class(card.installed ? CARD_ACTION_OK : CARD_ACTION)
          .children(
            card.installed
              ? t.shop.installed
              : card.locked
                ? t.research.locked
                : (card.cta ?? t.shop.install),
          ),
      ),
  )
}

const WEEK = css({ display: 'flex', flexDirection: 'column', gap: '1' })
const WEEK_LABEL = EYEBROW
const WEEK_GRID = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
  gap: '0.5',
})
const WEEK_DAY_ON = css({
  display: 'grid',
  height: '5',
  placeItems: 'center',
  borderRadius: 'md',
  fontSize: 'type.10',
  fontFamily: 'mono',
  color: 'onPrimaryFill',
  backgroundColor: 'primary',
})
const WEEK_DAY_OFF = css({
  display: 'grid',
  height: '5',
  placeItems: 'center',
  borderRadius: 'md',
  fontSize: 'type.10',
  fontFamily: 'mono',
  color: 'mutedForeground',
  backgroundColor: 'transparent',
})

const weekStrip = (h: H<Message>, model: Model, t: Messages) => {
  const day = (clockOf(model.board.game.time).day - 1) % 7
  return h.div.class(WEEK).children(
    h.span.class(WEEK_LABEL).children(t.shop.week),
    h.div.class(WEEK_GRID).children(
      WEEK_LABELS.map((label, index) =>
        h.span
          .key(`week-day-${index}`)
          .class(index === day ? WEEK_DAY_ON : WEEK_DAY_OFF)
          .children(label),
      ),
    ),
  )
}

const SLOT_BUTTON = css({
  display: 'flex',
  width: '100%',
  minWidth: '0',
  alignItems: 'center',
  gap: '2',
  borderRadius: 'lg',
  paddingInline: '2',
  paddingBlock: '2',
  textAlign: 'left',
  color: 'mutedForeground',
  _narrow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '1',
    paddingInline: '1.5',
    paddingBlock: '2',
  },
  _hover: {
    color: 'foreground',
  },
})

const SLOT_BUTTON_ACTIVE = css({
  layerStyle: 'raised',
  boxShadow: 'raised',
  color: 'foreground',
})

const SLOT_GLYPH = css({ width: '3.5', height: '3.5', flexShrink: '0' })

const SLOT_NAME = css({
  minWidth: '0',
  flex: '1 1 0%',
  fontSize: 'type.12',
  fontWeight: 'medium',
})

const SLOT_VALUE = cx(FIGURE, css({ fontSize: 'type.10-5', color: 'mutedForeground' }))
const SLOT_VALUE_SET = cx(FIGURE, css({ fontSize: 'type.10-5', color: 'foreground' }))

const slotButton = (
  h: H<Message>,
  slot: SlotKind,
  active: boolean,
  value: string | null,
  t: Messages,
  nodeId: string,
) =>
  h.button
    .attr('type', 'button')
    .on('click', () => Message.ShopSlotChosen({ slot }))
    .attr('aria-pressed', active ? 'true' : 'false')
    .class(cx(SLOT_BUTTON, active ? SLOT_BUTTON_ACTIVE : ''))
    .key(`shop-slot-${nodeId}-${slot}`)
    .children(
      icon(h, SLOT_ICON[slot], SLOT_GLYPH),
      h.span.class(SLOT_NAME).children(slotTitle(slot, t)),
      h.span.class(value === null ? SLOT_VALUE : SLOT_VALUE_SET).children(value ?? t.shop.empty),
    )

const instanceSwitchPrice = (
  game: Model['board']['game'],
  node: GameNode,
  size: number,
): number => {
  if (size <= node.size) return 0
  const priced = game.sandbox ? { ...game, sandbox: false } : game
  let total = 0
  for (let at = node.size; at < size; at += 1) {
    total += resizePrice(priced, { ...node, size: at }) ?? 0
  }
  return total
}

const RAIL = css({ display: 'flex', minWidth: '0', flexDirection: 'column', gap: '4' })
const RAIL_GROUP = css({ display: 'flex', flexDirection: 'column', gap: '1.5' })
const RAIL_EYEBROW = cx(EYEBROW, css({ paddingInline: '2' }))

const FAMILY_BUTTON = css({
  display: 'flex',
  width: '100%',
  minWidth: '0',
  alignItems: 'center',
  gap: '2',
  borderRadius: 'lg',
  paddingInline: '2',
  paddingBlock: '2',
  textAlign: 'left',
  color: 'mutedForeground',
  _hover: { color: 'foreground' },
})

const FAMILY_BUTTON_SELECTED = css({
  layerStyle: 'raised',
  boxShadow: 'raised',
  color: 'foreground',
})

const FAMILY_TEXT = css({
  display: 'flex',
  minWidth: '0',
  flexDirection: 'column',
  gap: '0.25',
})

const FAMILY_NAME = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 'type.12',
  fontWeight: 'medium',
})

const FAMILY_META = css({ fontSize: 'type.10-5', color: 'mutedForeground' })

const FAMILY_LOCK = css({
  width: '3',
  height: '3',
  flexShrink: '0',
  color: 'mutedForeground',
})

const LOCKED_NOTE = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderColor: 'border',
  paddingInline: '2',
  paddingTop: '3',
})

const HINT = css({ fontSize: 'type.10-5', lineHeight: 'snug', color: 'mutedForeground' })

const CENTER = css({
  display: 'flex',
  minWidth: '0',
  flexDirection: 'column',
  gap: '3',
})

const CENTER_HEAD = css({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '3',
})

const CENTER_TITLE = css({ fontSize: 'type.17', fontWeight: 'semibold' })
const CENTER_META = css({ fontSize: 'type.11-5', color: 'mutedForeground' })
const CENTER_BLURB = css({ fontSize: 'type.11-5', color: 'mutedForeground' })

const INSTANCE_GRID = cx(
  css({
    display: 'grid',
    gap: '2',
    _narrow: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  }),
  css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
)

const SUMMARY = css({
  display: 'flex',
  minWidth: '0',
  flexDirection: 'column',
  gap: '3',
  borderLeftWidth: '1px',
  borderLeftStyle: 'solid',
  borderColor: 'border',
  paddingLeft: '4',
  _narrow: {
    borderLeftWidth: '0',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    paddingLeft: '0',
    paddingTop: '4',
  },
})

const SUMMARY_GROUP = css({ display: 'flex', flexDirection: 'column', gap: '1.5' })
const SUMMARY_EYEBROW = EYEBROW

const SUMMARY_ROW = css({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '2',
  fontSize: 'type.11-5',
})

const SUMMARY_LABEL = css({ color: 'mutedForeground' })
const SUMMARY_VALUE = FIGURE
const INSTANCE_VALUE_SMALL = cx(FIGURE, css({ fontSize: 'type.11-5' }))
const PARTS_VALUE_SMALL = cx(FIGURE, css({ color: 'foreground', fontSize: 'type.11-5' }))
const PARTS_VALUE_SMALL_MUTED = cx(FIGURE, css({ color: 'mutedForeground', fontSize: 'type.11-5' }))

const SUMMARY_STAT = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '2',
  fontSize: 'type.11-5',
})

const SUMMARY_FOOT = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderColor: 'border',
  paddingTop: '3',
})

const SUMMARY_BURN = css({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '2',
})

const SUMMARY_BURN_LABEL = css({ fontSize: 'type.11-5', color: 'mutedForeground' })
const SUMMARY_BURN_VALUE = cx(FIGURE, css({ fontSize: 'type.12' }))

const SUMMARY_BURN_TOTAL = css({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '2',
  paddingTop: '2',
})

const TODAY = css({ fontSize: 'type.10', color: 'mutedForeground' })

const SUMMARY_HINT = css({
  paddingTop: '1',
  fontSize: 'type.10-5',
  lineHeight: 'snug',
  color: 'mutedForeground',
})

const FREE = css({ fontSize: 'type.10-5', color: 'ok' })

const INSTANCE_BODY = css({
  display: 'grid',
  gridTemplateColumns: '180px minmax(0, 1fr) 200px',
  gap: '4',
  paddingInline: '5',
  paddingBottom: '5',
  overflowY: 'auto',
  _narrow: {
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '4',
    paddingInline: '4',
  },
})

const PANEL_WIDTH = css({ maxWidth: 'calc(980px * var(--type-scale))' })

const instancePanel = (h: H<Message>, model: Model, node: GameNode, t: Messages) => {
  const game = model.board.game
  const family = model.shopFamily
  const kit = FAMILIES[family]
  const unlocked = partsUnlocked(game)
  const armLocked = family === 'arm' && !has(game, 'arm-instances')
  const sizes = SIZES.map((size, index) => ({ size, index })).filter(
    ({ index }) => !unlocked || !node.parts.cpu || index >= node.size,
  )
  const cards: ReadonlyArray<PartCard> = sizes.map(({ size, index }) => {
    const vcpu = size.vcpu
    const gb = Math.round(vcpu * kit.ramPerVcpu)
    const port =
      family === 'arm' && node.type === 'server' && node.family !== 'arm' && !game.sandbox
        ? LANGUAGES[RUNTIMES[node.runtime].language].armPortDh
        : 0
    const plan = unlocked ? presetPlan(game, node, family, index) : null
    const price = unlocked ? (plan?.price ?? 0) : instanceSwitchPrice(game, node, index)
    const projected = {
      ...node,
      family,
      size: index,
      ...(unlocked
        ? {
            parts: {
              ...node.parts,
              cpu: true,
              ram: true,
              disk: node.type === 'database' ? true : node.parts.disk,
            },
          }
        : {}),
    }
    const installed = unlocked
      ? node.family === family &&
        node.size === index &&
        node.parts.cpu &&
        node.parts.ram &&
        (node.type !== 'database' || node.parts.disk)
      : node.family === family && node.size === index
    const downgrade = !unlocked && index < node.size
    const sameSize = !unlocked && index === node.size
    return {
      key: `shop-instance-${family}-${index}`,
      title: `${Number.isInteger(vcpu) ? vcpu : vcpu.toFixed(1)}c`,
      subtitle: t.nodeList.sizes[size.name],
      specs: [`${gb} GB`, `${size.gbps} Gbps`, ...(port > 0 ? [t.units.devHours(port)] : [])],
      price,
      priceLabel: installed
        ? t.shop.current
        : downgrade || sameSize
          ? t.shop.freeSwitch
          : undefined,
      cta: installed
        ? undefined
        : unlocked
          ? undefined
          : downgrade
            ? t.shop.downgrade
            : t.shop.select,
      burn: t.units.perSecond(money(burnOf(game, projected))),
      installed,
      ready:
        (unlocked ? plan !== null : true) &&
        !armLocked &&
        game.devHours >= port &&
        (game.sandbox || game.cash >= price),
      locked: armLocked,
      capacity: vcpu,
      search: `${size.name} ${family} ${vcpu} ${gb} gb ${size.gbps} gbps`,
      message: Message.SelectInstance({ nodeId: node.id, family, size: index }),
    }
  })

  const familyRail = h.aside.class(RAIL).children(
    h.div.class(RAIL_GROUP).children(
      h.span.class(RAIL_EYEBROW).children(t.shop.family),
      FAMILY_IDS.map((id) => {
        const selected = id === family
        const locked = id === 'arm' && !has(game, 'arm-instances')
        return h.button
          .attr('type', 'button')
          .on('click', () => Message.ShopFamilyChosen({ family: id }))
          .attr('aria-pressed', selected ? 'true' : 'false')
          .key(`shop-family-${id}`)
          .class(cx(FAMILY_BUTTON, selected ? FAMILY_BUTTON_SELECTED : ''))
          .children(
            icon(h, selected ? Check : Cpu, SLOT_GLYPH),
            h.div
              .class(FAMILY_TEXT)
              .children(
                h.span.class(FAMILY_NAME).children(t.catalog.families[id].name),
                h.span.class(FAMILY_META).children(`${FAMILIES[id].ramPerVcpu} GB/vCPU`),
              ),
            locked ? icon(h, Lock, FAMILY_LOCK) : undefined,
          )
      }),
    ),
    unlocked
      ? undefined
      : h.div.class(LOCKED_NOTE).children(
          h.p.class(HINT).children(t.shop.partsLocked),
          h.button
            .attr('type', 'button')
            .attr('tabindex', '0')
            .class(buttonClass('outline', 'sm'))
            .attr('data-slot', 'button')
            .on('click', () => Message.ResearchShown({ id: 'custom-instances' }))
            .children(t.shop.openResearch),
        ),
  )

  const center = h.section
    .class(CENTER)
    .children(
      h.div
        .class(CENTER_HEAD)
        .children(
          h.span.class(CENTER_TITLE).children(t.catalog.families[family].name),
          h.span.class(CENTER_META).children(t.shop.sizeCount(cards.length)),
        ),
      h.p.class(CENTER_BLURB).children(t.catalog.families[family].blurb),
      h.div.class(INSTANCE_GRID).children(cards.map((card) => partCard(h, card, t))),
    )

  const current = {
    cpu: node.parts.cpu ? `${vcpuOf(node)}c` : '+',
    ram: node.parts.ram ? `${Math.round(ramOf(node))}g` : '+',
    disk:
      node.type === 'database'
        ? node.parts.disk
          ? node.iops === 'provisioned'
            ? '64k'
            : '3k'
          : '+'
        : t.shop.swap,
  }
  const summary = h.aside.class(SUMMARY).children(
    h.div.class(SUMMARY_GROUP).children(
      h.span.class(SUMMARY_EYEBROW).children(t.shop.build),
      h.div
        .class(SUMMARY_ROW)
        .children(
          h.span.class(SUMMARY_LABEL).children(t.shop.family),
          h.span.class(SUMMARY_VALUE).children(t.catalog.families[node.family].name),
        ),
      [
        [t.inspector.partsCpu, current.cpu] as const,
        [t.inspector.partsMemory, current.ram] as const,
        [t.inspector.partsDisk, current.disk] as const,
      ].map(([label, value]) =>
        h.div
          .class(SUMMARY_STAT)
          .children(
            h.span.class(SUMMARY_LABEL).children(label),
            h.span.class(INSTANCE_VALUE_SMALL).children(value),
          ),
      ),
    ),
    h.div
      .class(SUMMARY_FOOT)
      .children(
        h.div
          .class(SUMMARY_BURN)
          .children(
            h.span.class(SUMMARY_BURN_LABEL).children(t.shop.burn),
            h.span.class(SUMMARY_BURN_VALUE).children(t.units.perSecond(money(burnOf(game, node)))),
          ),
        h.p.class(SUMMARY_HINT).children(unlocked ? t.shop.presetHint : t.shop.instanceHint),
        game.sandbox ? h.span.class(FREE).children(t.shop.free) : undefined,
      ),
  )

  return shell(
    h,
    t,
    t.shop.instanceTitle,
    [modeSwitch(h, model, t)],
    [h.div.class(INSTANCE_BODY).children(familyRail, center, summary)],
    PANEL_WIDTH,
  )
}

const SEARCH = css({
  display: 'flex',
  height: '9',
  minWidth: '0',
  alignItems: 'center',
  gap: '2',
  borderRadius: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'border',
  backgroundColor: 'background',
  paddingInline: '2.5',
  _focusWithin: { borderColor: 'mutedForeground' },
})

const SEARCH_GLYPH = css({
  width: '3.5',
  height: '3.5',
  flexShrink: '0',
  color: 'mutedForeground',
})

const SEARCH_INPUT = css({
  height: '100%',
  minWidth: '0',
  flex: '1 1 0%',
  backgroundColor: 'transparent',
  fontSize: 'type.12',
  color: 'foreground',
  outlineStyle: 'none',
  '&::placeholder': { color: 'mutedForeground' },
})

const CLEAR = css({
  display: 'grid',
  width: '5',
  height: '5',
  flexShrink: '0',
  placeItems: 'center',
  borderRadius: 'sm',
  color: 'mutedForeground',
  _hover: { color: 'foreground', backgroundColor: 'well' },
})

const CLEAR_GLYPH = css({ width: '3.5', height: '3.5' })

const SORT = css({
  display: 'flex',
  height: '9',
  alignItems: 'center',
  gap: '1.5',
  borderRadius: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'border',
  backgroundColor: 'background',
  paddingLeft: '2',
  paddingRight: '1',
  color: 'mutedForeground',
})

const SORT_GLYPH = css({ width: '3.5', height: '3.5', flexShrink: '0' })

const SORT_SELECT = css({
  height: '100%',
  minWidth: '0',
  flex: '1 1 0%',
  backgroundColor: 'transparent',
  fontSize: 'type.11-5',
  color: 'foreground',
  outlineStyle: 'none',
})

const SLOT_HEAD = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
  _narrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: '2',
  },
})

const SLOT_HEAD_EYEBROW = cx(
  EYEBROW,
  css({
    paddingInline: '2',
    _narrow: { paddingInline: '0' },
  }),
)

const NODE_LINE = css({
  display: 'flex',
  alignItems: 'center',
  gap: '2',
  paddingInline: '2',
  _narrow: { paddingInline: '0' },
})

const NODE_GLYPH = css({
  width: '4',
  height: '4',
  flexShrink: '0',
  color: 'mutedForeground',
})

const NODE_NAME = css({
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 'type.13',
  fontWeight: 'semibold',
})

const SLOT_LIST = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5',
  _narrow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '1',
  },
})

const SLOT_EYEBROW = cx(
  EYEBROW,
  css({
    paddingInline: '2',
    _narrow: { display: 'none' },
  }),
)

const RAIL_FOOT = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderColor: 'border',
  paddingInline: '2',
  paddingTop: '3',
  _narrow: {
    gap: '1.5',
    paddingInline: '0',
    paddingTop: '2',
  },
})

const TREND = css({ display: 'flex', alignItems: 'center', gap: '1.5' })
const TREND_UP = css({
  width: '3.5',
  height: '3.5',
  flexShrink: '0',
  color: 'danger',
})
const TREND_DOWN = css({ width: '3.5', height: '3.5', flexShrink: '0', color: 'ok' })
const TREND_FLAT = css({
  width: '3.5',
  height: '3.5',
  flexShrink: '0',
  color: 'mutedForeground',
})

const TREND_LABEL = css({ fontSize: 'type.11-5', fontWeight: 'medium' })

const SEARCH_ROW = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 190px',
  gap: '2',
  alignItems: 'center',
  _narrow: { gridTemplateColumns: 'minmax(0, 1fr)' },
})

const EMPTY_NOTE = css({
  borderRadius: 'lg',
  backgroundColor: 'well',
  paddingInline: '3',
  paddingBlock: '2',
  fontSize: 'type.12',
  color: 'mutedForeground',
})

const DISK_EMPTY = css({
  display: 'flex',
  minHeight: '40',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2',
  borderRadius: 'xl',
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: 'border',
  color: 'mutedForeground',
})

const NO_RESULTS = css({
  display: 'flex',
  minHeight: '40',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2',
  borderRadius: 'xl',
  borderWidth: '1px',
  borderStyle: 'dashed',
  borderColor: 'border',
  padding: '4',
  color: 'mutedForeground',
})

const EMPTY_GLYPH = css({ width: '6', height: '6', opacity: 0.6 })
const EMPTY_TEXT = css({ fontSize: 'type.12', textAlign: 'center' })

const RESULT_GRID = css({
  display: 'grid',
  gap: '2',
  _narrow: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
})
const GRID_TWO = css({ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' })
const GRID_THREE = css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' })

const SLOT_HINT = css({
  paddingInline: '1',
  fontSize: 'type.11-5',
  lineHeight: 'snug',
  color: 'mutedForeground',
})

const PARTS_BODY = css({
  display: 'grid',
  gridTemplateColumns: '168px minmax(0, 1fr) 196px',
  gap: '4',
  paddingInline: '5',
  paddingBottom: '5',
  overflowY: 'auto',
  _narrow: {
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: '4',
    paddingInline: '4',
  },
})

const partsPanel = (h: H<Message>, model: Model, node: GameNode, t: Messages) => {
  const game = model.board.game
  const slot = model.shopSlot
  const percent = marketPercent(game, slot)
  const percentLabel = `${percent > 0 ? '+' : ''}${percent}%`
  const direction = marketDirection(game, slot)
  const trend = percent === 0 ? 'flat' : direction
  const title = nodeTitle(t, game, node)
  const isDatabase = node.type === 'database'
  const cpuReady = node.parts.cpu
  const sorts = slotCopy(t)
  const prices = {
    cpu: (size: number) => partPrice(game, node, 'cpu', size),
    ram: (family: FamilyId) => partPrice(game, node, 'ram', family),
    disk: (iops: IopsClass) => partPrice(game, node, 'disk', iops),
  }

  const cards: ReadonlyArray<PartCard> =
    slot === 'cpu'
      ? SIZES.map((size, index) => ({ size, index }))
          .filter(({ index }) => !node.parts.cpu || index >= node.size)
          .map(({ size, index }) => {
            const price = prices.cpu(index)
            return {
              key: `shop-cpu-${index}`,
              title: `${Number.isInteger(size.vcpu) ? size.vcpu : size.vcpu.toFixed(1)}c`,
              subtitle: t.nodeList.sizes[size.name],
              specs: [`${size.vcpu} vCPU`, `${size.gbps} Gbps`],
              price,
              burn: null,
              installed: node.parts.cpu && node.size === index,
              ready: game.sandbox || game.cash >= price,
              locked: false,
              capacity: size.vcpu,
              search: `${size.name} ${size.vcpu} ${size.vcpu}c ${size.gbps} gbps`,
              message: Message.InstallCpu({ nodeId: node.id, size: index }),
            }
          })
      : slot === 'ram'
        ? FAMILY_IDS.map((family) => {
            const kit = FAMILIES[family]
            const gb = cpuReady ? Math.round((SIZES[node.size]?.vcpu ?? 0) * kit.ramPerVcpu) : 0
            const price = prices.ram(family)
            const locked = family === 'arm' && !has(game, 'arm-instances')
            const port =
              family === 'arm' && node.type === 'server' && node.family !== 'arm' && !game.sandbox
                ? LANGUAGES[RUNTIMES[node.runtime].language].armPortDh
                : 0
            return {
              key: `shop-ram-${family}`,
              title: t.catalog.families[family].name,
              subtitle: `${kit.ramPerVcpu} GB/vCPU`,
              specs: cpuReady
                ? [`${gb} GB now`, ...(port > 0 ? [t.units.devHours(port)] : [])]
                : [],
              price,
              burn: t.inspector.partsBurn(kit.price),
              installed: node.parts.ram && node.family === family,
              ready:
                cpuReady &&
                !locked &&
                game.devHours >= port &&
                (game.sandbox || game.cash >= price),
              locked,
              capacity: kit.ramPerVcpu,
              search: `${family} ${kit.ramPerVcpu} gb vcpu ${kit.price} burn ${port} dh`,
              message: Message.InstallRam({ nodeId: node.id, family }),
            }
          })
        : isDatabase
          ? (Object.keys(STORAGE_IOPS) as ReadonlyArray<IopsClass>).map((iops) => {
              const volume = STORAGE_IOPS[iops]
              const price = prices.disk(iops)
              return {
                key: `shop-disk-${iops}`,
                title: t.catalog.storageIops[iops].name,
                subtitle: `${Math.round(volume.iops / 1_000)}k IOPS`,
                specs: [`${volume.iops.toLocaleString('en-US')} IOPS`],
                price,
                burn: t.inspector.partsBurn(volume.burn),
                installed: node.parts.disk && node.iops === iops,
                ready: game.sandbox || game.cash >= price,
                locked: false,
                capacity: volume.iops,
                search: `${iops} ${volume.iops} iops ${volume.burn} burn`,
                message: Message.InstallDisk({ nodeId: node.id, iops }),
              }
            })
          : []

  const query = searchable(model.shopQuery.trim())
  const filtered = cards.filter(
    (card) =>
      query === '' || searchable(`${card.title} ${card.subtitle} ${card.search}`).includes(query),
  )
  const sorted = [...filtered].sort((a, b) => {
    if (model.shopSort === 'price-asc') return a.price - b.price
    if (model.shopSort === 'price-desc') return b.price - a.price
    if (model.shopSort === 'capacity') return b.capacity - a.capacity
    return cards.indexOf(a) - cards.indexOf(b)
  })
  const serverDisk = slot === 'disk' && !isDatabase
  const empty = slot === 'ram' && !cpuReady ? t.shop.cpuFirst : null

  const currentPrices = {
    cpu: node.parts.cpu ? prices.cpu(node.size) : 0,
    ram: node.parts.ram ? prices.ram(node.family) : 0,
    disk: isDatabase && node.parts.disk ? prices.disk(node.iops) : 0,
  }
  const total = currentPrices.cpu + currentPrices.ram + currentPrices.disk
  const burn = burnOf(game, node)
  const columns = sorted.length <= 2 ? 2 : 3

  const searchField = h.div.class(SEARCH).children(
    icon(h, Search, SEARCH_GLYPH),
    h.input
      .attr('type', 'text')
      .value(model.shopQuery)
      .attr('placeholder', t.shop.search)
      .attr('aria-label', t.shop.search)
      .attr('autocomplete', 'off')
      .attr('spellcheck', 'false')
      .on('input', ({ value }) => Message.ShopQueryChanged({ query: value }))
      .attr('autofocus', '')
      .class(SEARCH_INPUT),
    model.shopQuery === ''
      ? undefined
      : h.button
          .attr('type', 'button')
          .attr('aria-label', t.shop.clearSearch)
          .attr('title', t.shop.clearSearch)
          .on('click', () => Message.ShopQueryChanged({ query: '' }))
          .class(CLEAR)
          .children(icon(h, X, CLEAR_GLYPH)),
  )

  const sortField = h.label.class(SORT).children(
    icon(h, ArrowUpDown, SORT_GLYPH),
    h.select
      .value(model.shopSort)
      .attr('aria-label', t.shop.sort)
      .on('change', ({ value }) => Message.ShopSortChosen({ sort: value as ShopSort }))
      .class(SORT_SELECT)
      .children(
        SORTS.map(([value, label]) =>
          h.option
            .attr('value', value)
            .selected(value === model.shopSort)
            .children(sorts[value] ?? label),
        ),
      ),
  )

  const slotRail = h.aside.class(RAIL).children(
    h.div
      .class(SLOT_HEAD)
      .children(
        h.span.class(SLOT_HEAD_EYEBROW).children(t.shop.build),
        h.div
          .class(NODE_LINE)
          .children(
            icon(h, node.type === 'database' ? HardDrive : Cpu, NODE_GLYPH),
            h.span.class(NODE_NAME).children(title),
          ),
      ),
    h.div.class(SLOT_LIST).children(
      h.span.class(SLOT_EYEBROW).children(t.shop.slots),
      SLOT_ORDER.map((entry) =>
        slotButton(
          h,
          entry,
          entry === slot,
          entry === 'disk' && !isDatabase ? t.shop.swap : installedPart(node, entry),
          t,
          node.id,
        ),
      ),
    ),
    h.div
      .class(RAIL_FOOT)
      .children(
        weekStrip(h, model, t),
        h.div
          .class(TREND)
          .children(
            icon(
              h,
              trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : ArrowUpDown,
              trend === 'up' ? TREND_UP : trend === 'down' ? TREND_DOWN : TREND_FLAT,
            ),
            h.span.class(TREND_LABEL).children(t.shop.market(percentLabel)),
          ),
        game.sandbox ? h.span.class(FREE).children(t.shop.free) : undefined,
      ),
  )

  const slotHint =
    slot === 'ram'
      ? t.inspector.partsMemoryHint
      : slot === 'disk' && isDatabase
        ? t.inspector.partsDiskHint
        : null

  const center = h.section.class(CENTER).children(
    h.div
      .class(CENTER_HEAD)
      .children(
        h.span.class(CENTER_TITLE).children(slotTitle(slot, t)),
        serverDisk
          ? undefined
          : h.span.class(CENTER_META).children(t.shop.resultCount(sorted.length)),
      ),
    serverDisk ? undefined : h.div.class(SEARCH_ROW).children(searchField, sortField),
    empty === null ? undefined : h.div.class(EMPTY_NOTE).children(empty),
    serverDisk
      ? h.div
          .class(DISK_EMPTY)
          .children(
            icon(h, HardDrive, EMPTY_GLYPH),
            h.span.class(EMPTY_TEXT).children(t.shop.appDisk),
          )
      : sorted.length === 0
        ? h.div.class(NO_RESULTS).children(
            icon(h, Search, EMPTY_GLYPH),
            h.span.class(EMPTY_TEXT).children(t.shop.noResults),
            h.button
              .attr('type', 'button')
              .attr('tabindex', '0')
              .class(buttonClass('outline', 'sm'))
              .attr('data-slot', 'button')
              .on('click', () => Message.ShopQueryChanged({ query: '' }))
              .children(t.shop.clearSearch),
          )
        : h.div
            .class(cx(RESULT_GRID, columns === 2 ? GRID_TWO : GRID_THREE))
            .children(sorted.map((card) => partCard(h, card, t))),
    slotHint === null ? undefined : h.p.class(SLOT_HINT).children(slotHint),
  )

  const summaryRows = (['cpu', 'ram', 'disk'] as const).map((entry) => {
    const value = entry === 'disk' && !isDatabase ? t.shop.swap : installedPart(node, entry)
    return h.div
      .class(SUMMARY_STAT)
      .children(
        h.span.class(SUMMARY_LABEL).children(slotTitle(entry, t)),
        h.span
          .class(value === null ? PARTS_VALUE_SMALL_MUTED : PARTS_VALUE_SMALL)
          .children(value ?? '—'),
      )
  })

  const summary = h.aside
    .class(SUMMARY)
    .children(
      h.div
        .class(SUMMARY_GROUP)
        .children(h.span.class(SUMMARY_EYEBROW).children(t.shop.build), summaryRows),
      h.div
        .class(SUMMARY_FOOT)
        .children(
          h.div
            .class(SUMMARY_BURN)
            .children(
              h.span.class(SUMMARY_BURN_LABEL).children(t.shop.partsTotal),
              h.span.class(CARD_PRICE).children(money(total)),
            ),
          h.span.class(TODAY).children(t.shop.today),
          h.div
            .class(SUMMARY_BURN_TOTAL)
            .children(
              h.span.class(SUMMARY_BURN_LABEL).children(t.shop.burn),
              h.span.class(SUMMARY_BURN_VALUE).children(t.units.perSecond(money(burn))),
            ),
        ),
    )

  return shell(
    h,
    t,
    t.shop.title,
    [modeSwitch(h, model, t)],
    [h.div.class(PARTS_BODY).children(slotRail, center, summary)],
    PANEL_WIDTH,
  )
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

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

const HEADER = css({
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

const HEADER_TITLE = css({
  fontSize: 'type.17',
  fontWeight: 'semibold',
  letterSpacing: 'tight',
})

const HEADER_TOOLS = css({ display: 'flex', alignItems: 'center', gap: '3' })
const CLOSE = css({
  color: 'mutedForeground',
  _compact: {
    width: '11',
    height: '11',
  },
})
const CLOSE_GLYPH = css({ width: '4', height: '4' })

const shell = (
  h: H<Message>,
  t: Messages,
  title: string,
  right: ReadonlyArray<View.Input<Message>>,
  body: ReadonlyArray<View.Input<Message>>,
  width: string,
) =>
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
          h.div.class(HEADER).children(
            h.span.class(HEADER_TITLE).children(title),
            h.div.class(HEADER_TOOLS).children(
              ...right,
              h.button
                .attr('type', 'button')
                .attr('tabindex', '0')
                .class(buttonClass('ghost', 'icon', CLOSE))
                .attr('data-slot', 'button')
                .attr('aria-label', t.panels.closeEsc)
                .on('click', () => Message.PanelClosed())
                .children(icon(h, X, CLOSE_GLYPH)),
            ),
          ),
          ...body,
        ),
    )

export const Shop = (h: H<Message>, model: Model): View.Input<Message> => {
  const t = copyIn(model.prefs.locale)
  const game = model.board.game
  const node = game.nodes.find((entry) => entry.id === model.board.selected)
  if (node === undefined || (node.type !== 'server' && node.type !== 'database')) return undefined
  const mode = partsUnlocked(game) ? model.shopMode : 'instance'
  return mode === 'instance' ? instancePanel(h, model, node, t) : partsPanel(h, model, node, t)
}
