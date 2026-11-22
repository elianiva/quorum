import { css, cx } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'
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
import type { GameNode, IopsClass } from '@quorum/simulation/state'
import { burnOf, has, ramOf, resizePrice, vcpuOf } from '@quorum/simulation/lookups'
import {
  installedPart,
  marketDirection,
  marketPercent,
  partPrice,
  partsUnlocked,
  type SlotKind,
} from '@quorum/simulation/parts'
import { copy, nodeTitle, type Messages } from '@/i18n/messages.ts'
import { money } from '@quorum/ui/game/format'
import { button } from '@quorum/ui/primitives/button'
import { icon } from '@quorum/ui/primitives/icon'
import { EYEBROW, FIGURE } from '@quorum/ui/game/bits'
import { Message } from '@/game/message.ts'
import type { Model, ShopSort } from '@/game/model.ts'
import { shell } from './panels.ts'

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

const cardStyle = (installed: boolean) =>
  cx(
    css({
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
    }),
    installed
      ? css({
          layerStyle: 'raised',
          boxShadow: 'raised',
          borderColor: 'foreground',
        })
      : css({}),
  )

const partCard = (card: PartCard, t: Messages, h: HtmlBuilder<Message>): Html =>
  button<Message>(
    {
      ...(card.installed ? {} : { onClick: card.message }),
      isDisabled: !card.installed && !card.ready,
      variant: 'outline',
      className: cardStyle(card.installed),
      attributes: [h.Title(card.locked ? t.shop.armLocked : `${card.title} · ${card.subtitle}`)],
    },
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              width: '100%',
              minWidth: '0',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '2',
            }),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({ display: 'flex', minWidth: '0', flexDirection: 'column', gap: '0.25' }),
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
                      fontSize: 'type.14',
                      fontWeight: 'semibold',
                    }),
                  ),
                ],
                [card.title],
              ),
              h.span(
                [
                  h.Class(
                    css({
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 'type.11-5',
                      color: 'mutedForeground',
                    }),
                  ),
                ],
                [card.subtitle],
              ),
            ],
          ),
          card.installed
            ? icon(h, Check, css({ width: '3.5', height: '3.5', flexShrink: '0', color: 'ok' }))
            : card.locked
              ? icon(
                  h,
                  Lock,
                  css({ width: '3.5', height: '3.5', flexShrink: '0', color: 'mutedForeground' }),
                )
              : h.empty,
        ],
      ),
      h.div(
        [h.Class(css({ display: 'flex', flexWrap: 'wrap', gap: '1' }))],
        [
          ...card.specs.map((spec) =>
            h.span(
              [
                h.Class(
                  css({
                    borderRadius: 'full',
                    backgroundColor: 'well',
                    paddingInline: '1.5',
                    paddingBlock: '0.5',
                    fontFamily: 'mono',
                    fontSize: 'type.11',
                    color: 'mutedForeground',
                    whiteSpace: 'nowrap',
                  }),
                ),
              ],
              [spec],
            ),
          ),
          ...(card.burn === null
            ? []
            : [
                h.span(
                  [
                    h.Class(
                      css({
                        borderRadius: 'full',
                        backgroundColor: 'well',
                        paddingInline: '1.5',
                        paddingBlock: '0.5',
                        fontFamily: 'mono',
                        fontSize: 'type.11',
                        color: 'mutedForeground',
                        whiteSpace: 'nowrap',
                      }),
                    ),
                  ],
                  [card.burn],
                ),
              ]),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '2',
              marginTop: 'auto',
              paddingTop: '1',
            }),
          ),
        ],
        [
          h.span(
            [h.Class(cx(FIGURE, css({ fontSize: 'type.13' })))],
            [card.priceLabel ?? money(card.price)],
          ),
          h.span(
            [
              h.Class(
                css({
                  fontSize: 'type.11',
                  color: card.installed ? 'ok' : card.ready ? 'mutedForeground' : 'mutedForeground',
                }),
              ),
            ],
            [
              card.installed
                ? t.shop.installed
                : card.locked
                  ? t.research.locked
                  : (card.cta ?? t.shop.install),
            ],
          ),
        ],
      ),
    ],
    h,
  )

const weekStrip = (model: Model, t: Messages, h: HtmlBuilder<Message>): Html => {
  const day = (clockOf(model.board.game.time).day - 1) % 7
  return h.div(
    [h.Class(css({ display: 'flex', flexDirection: 'column', gap: '1' }))],
    [
      h.span([h.Class(cx(EYEBROW, css({ color: 'mutedForeground' })))], [t.shop.week]),
      h.div(
        [
          h.Class(
            css({
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gap: '0.5',
            }),
          ),
        ],
        WEEK_LABELS.map((label, index) =>
          h.span(
            [
              h.Key(`week-day-${index}`),
              h.Class(
                css({
                  display: 'grid',
                  height: '5',
                  placeItems: 'center',
                  borderRadius: 'md',
                  fontSize: 'type.10',
                  fontFamily: 'mono',
                  color: index === day ? 'onPrimaryFill' : 'mutedForeground',
                  backgroundColor: index === day ? 'primary' : 'transparent',
                }),
              ),
            ],
            [label],
          ),
        ),
      ),
    ],
  )
}

const slotButton = (
  slot: SlotKind,
  active: boolean,
  value: string | null,
  t: Messages,
  nodeId: string,
  h: HtmlBuilder<Message>,
): Html => {
  const Icon = SLOT_ICON[slot]
  return h.button(
    [
      h.Type('button'),
      h.OnClick(Message.ShopSlotChosen({ slot })),
      h.AriaPressed(active ? 'true' : 'false'),
      h.Class(
        cx(
          css({
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
          }),
          active
            ? css({
                layerStyle: 'raised',
                boxShadow: 'raised',
                color: 'foreground',
              })
            : css({}),
        ),
      ),
      h.Key(`shop-slot-${nodeId}-${slot}`),
    ],
    [
      icon(h, Icon, css({ width: '3.5', height: '3.5', flexShrink: '0' })),
      h.span(
        [
          h.Class(
            css({ minWidth: '0', flex: '1 1 0%', fontSize: 'type.12', fontWeight: 'medium' }),
          ),
        ],
        [slotTitle(slot, t)],
      ),
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                fontSize: 'type.10-5',
                color: value === null ? 'mutedForeground' : 'foreground',
              }),
            ),
          ),
        ],
        [value ?? t.shop.empty],
      ),
    ],
  )
}

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

const instancePanel = (model: Model, node: GameNode, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const game = model.board.game
  const family = model.shopFamily
  const kit = FAMILIES[family]
  const armLocked = family === 'arm' && !has(game, 'arm-instances')
  const cards: ReadonlyArray<PartCard> = SIZES.map((size, index) => {
    const vcpu = size.vcpu
    const gb = Math.round(vcpu * kit.ramPerVcpu)
    const port =
      family === 'arm' && node.type === 'server' && node.family !== 'arm' && !game.sandbox
        ? LANGUAGES[RUNTIMES[node.runtime].language].armPortDh
        : 0
    const projected = { ...node, family, size: index }
    const installed = node.family === family && node.size === index
    const downgrade = index < node.size
    const sameSize = index === node.size
    return {
      key: `shop-instance-${family}-${index}`,
      title: `${Number.isInteger(vcpu) ? vcpu : vcpu.toFixed(1)}c`,
      subtitle: t.nodeList.sizes[size.name],
      specs: [`${gb} GB`, `${size.gbps} Gbps`, ...(port > 0 ? [t.units.devHours(port)] : [])],
      price: instanceSwitchPrice(game, node, index),
      priceLabel: installed
        ? t.shop.current
        : downgrade || sameSize
          ? t.shop.freeSwitch
          : undefined,
      cta: installed ? undefined : downgrade ? t.shop.downgrade : t.shop.select,
      burn: t.units.perSecond(money(burnOf(game, projected))),
      installed,
      ready:
        !armLocked &&
        game.devHours >= port &&
        (game.sandbox || game.cash >= instanceSwitchPrice(game, node, index)),
      locked: armLocked,
      capacity: vcpu,
      search: `${size.name} ${family} ${vcpu} ${gb} gb ${size.gbps} gbps`,
      message: Message.SelectInstance({ nodeId: node.id, family, size: index }),
    }
  })

  const familyRail = h.aside(
    [h.Class(css({ display: 'flex', minWidth: '0', flexDirection: 'column', gap: '4' }))],
    [
      h.div(
        [h.Class(css({ display: 'flex', flexDirection: 'column', gap: '1.5' }))],
        [
          h.span(
            [h.Class(cx(EYEBROW, css({ paddingInline: '2', color: 'mutedForeground' })))],
            [t.shop.family],
          ),
          ...FAMILY_IDS.map((id) => {
            const selected = id === family
            const locked = id === 'arm' && !has(game, 'arm-instances')
            return h.button(
              [
                h.Type('button'),
                h.OnClick(Message.ShopFamilyChosen({ family: id })),
                h.AriaPressed(selected ? 'true' : 'false'),
                h.Key(`shop-family-${id}`),
                h.Class(
                  cx(
                    css({
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
                    }),
                    selected
                      ? css({
                          layerStyle: 'raised',
                          boxShadow: 'raised',
                          color: 'foreground',
                        })
                      : css({}),
                  ),
                ),
              ],
              [
                icon(
                  h,
                  selected ? Check : Cpu,
                  css({ width: '3.5', height: '3.5', flexShrink: '0' }),
                ),
                h.div(
                  [
                    h.Class(
                      css({
                        display: 'flex',
                        minWidth: '0',
                        flexDirection: 'column',
                        gap: '0.25',
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
                            fontSize: 'type.12',
                            fontWeight: 'medium',
                          }),
                        ),
                      ],
                      [t.catalog.families[id].name],
                    ),
                    h.span(
                      [h.Class(css({ fontSize: 'type.10-5', color: 'mutedForeground' }))],
                      [`${FAMILIES[id].ramPerVcpu} GB/vCPU`],
                    ),
                  ],
                ),
                ...(locked
                  ? [
                      icon(
                        h,
                        Lock,
                        css({
                          width: '3',
                          height: '3',
                          flexShrink: '0',
                          color: 'mutedForeground',
                        }),
                      ),
                    ]
                  : []),
              ],
            )
          }),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '2',
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderColor: 'border',
              paddingInline: '2',
              paddingTop: '3',
            }),
          ),
        ],
        [
          h.p(
            [h.Class(css({ fontSize: 'type.10-5', lineHeight: 'snug', color: 'mutedForeground' }))],
            [t.shop.partsLocked],
          ),
          button<Message>(
            {
              onClick: Message.ResearchShown({ id: 'custom-instances' }),
              variant: 'outline',
              size: 'sm',
            },
            t.shop.openResearch,
            h,
          ),
        ],
      ),
    ],
  )

  const center = h.section(
    [h.Class(css({ display: 'flex', minWidth: '0', flexDirection: 'column', gap: '3' }))],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '3',
            }),
          ),
        ],
        [
          h.span(
            [h.Class(css({ fontSize: 'type.17', fontWeight: 'semibold' }))],
            [t.catalog.families[family].name],
          ),
          h.span(
            [h.Class(css({ fontSize: 'type.11-5', color: 'mutedForeground' }))],
            [t.shop.sizeCount(cards.length)],
          ),
        ],
      ),
      h.p(
        [h.Class(css({ fontSize: 'type.11-5', color: 'mutedForeground' }))],
        [t.catalog.families[family].blurb],
      ),
      h.div(
        [
          h.Class(
            cx(
              css({
                display: 'grid',
                gap: '2',
                _narrow: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
              }),
              css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
            ),
          ),
        ],
        cards.map((card) => partCard(card, t, h)),
      ),
    ],
  )

  const current = {
    cpu: `${vcpuOf(node)}c`,
    ram: `${Math.round(ramOf(node))}g`,
    disk: node.type === 'database' ? (node.iops === 'provisioned' ? '64k' : '3k') : t.shop.swap,
  }
  const summary = h.aside(
    [
      h.Class(
        css({
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
        }),
      ),
    ],
    [
      h.div(
        [h.Class(css({ display: 'flex', flexDirection: 'column', gap: '1.5' }))],
        [
          h.span([h.Class(cx(EYEBROW, css({ color: 'mutedForeground' })))], [t.shop.build]),
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '2',
                  fontSize: 'type.11-5',
                }),
              ),
            ],
            [
              h.span([h.Class(css({ color: 'mutedForeground' }))], [t.shop.family]),
              h.span([h.Class(FIGURE)], [t.catalog.families[node.family].name]),
            ],
          ),
          ...[
            [t.inspector.partsCpu, current.cpu] as const,
            [t.inspector.partsMemory, current.ram] as const,
            [t.inspector.partsDisk, current.disk] as const,
          ].map(([label, value]) =>
            h.div(
              [
                h.Class(
                  css({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '2',
                    fontSize: 'type.11-5',
                  }),
                ),
              ],
              [
                h.span([h.Class(css({ color: 'mutedForeground' }))], [label]),
                h.span([h.Class(cx(FIGURE, css({ fontSize: 'type.11-5' })))], [value]),
              ],
            ),
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
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderColor: 'border',
              paddingTop: '3',
            }),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '2',
                }),
              ),
            ],
            [
              h.span(
                [h.Class(css({ fontSize: 'type.11-5', color: 'mutedForeground' }))],
                [t.shop.burn],
              ),
              h.span(
                [h.Class(cx(FIGURE, css({ fontSize: 'type.12' })))],
                [t.units.perSecond(money(burnOf(game, node)))],
              ),
            ],
          ),
          h.p(
            [
              h.Class(
                css({
                  paddingTop: '1',
                  fontSize: 'type.10-5',
                  lineHeight: 'snug',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [t.shop.instanceHint],
          ),
          ...(game.sandbox
            ? [h.span([h.Class(css({ fontSize: 'type.10-5', color: 'ok' }))], [t.shop.free])]
            : []),
        ],
      ),
    ],
  )

  return shell(
    t.shop.instanceTitle,
    [],
    [
      h.div(
        [
          h.Class(
            css({
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
            }),
          ),
        ],
        [familyRail, center, summary],
      ),
    ],
    css({ maxWidth: 'calc(980px * var(--type-scale))' }),
    h,
  )
}

export const shopPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const game = model.board.game
  const node = game.nodes.find((entry) => entry.id === model.board.selected)
  if (!node || (node.type !== 'server' && node.type !== 'database')) return h.empty
  if (!partsUnlocked(game)) return instancePanel(model, node, h)

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

  const searchField = h.div(
    [
      h.Class(
        css({
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
        }),
      ),
    ],
    [
      icon(
        h,
        Search,
        css({ width: '3.5', height: '3.5', flexShrink: '0', color: 'mutedForeground' }),
      ),
      h.input([
        h.Type('text'),
        h.Value(model.shopQuery),
        h.Placeholder(t.shop.search),
        h.AriaLabel(t.shop.search),
        h.Autocomplete('off'),
        h.Spellcheck(false),
        h.OnInput((value: string) => Message.ShopQueryChanged({ query: value })),
        h.Autofocus(true),
        h.Class(
          css({
            height: '100%',
            minWidth: '0',
            flex: '1 1 0%',
            backgroundColor: 'transparent',
            fontSize: 'type.12',
            color: 'foreground',
            outlineStyle: 'none',
            '&::placeholder': { color: 'mutedForeground' },
          }),
        ),
      ]),
      ...(model.shopQuery === ''
        ? []
        : [
            h.button(
              [
                h.Type('button'),
                h.AriaLabel(t.shop.clearSearch),
                h.Title(t.shop.clearSearch),
                h.OnClick(Message.ShopQueryChanged({ query: '' })),
                h.Class(
                  css({
                    display: 'grid',
                    width: '5',
                    height: '5',
                    flexShrink: '0',
                    placeItems: 'center',
                    borderRadius: 'sm',
                    color: 'mutedForeground',
                    _hover: { color: 'foreground', backgroundColor: 'well' },
                  }),
                ),
              ],
              [icon(h, X, css({ width: '3.5', height: '3.5' }))],
            ),
          ]),
    ],
  )

  const sortField = h.label(
    [
      h.Class(
        css({
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
        }),
      ),
    ],
    [
      icon(h, ArrowUpDown, css({ width: '3.5', height: '3.5', flexShrink: '0' })),
      h.select(
        [
          h.Value(model.shopSort),
          h.AriaLabel(t.shop.sort),
          h.OnChange((value: string) => Message.ShopSortChosen({ sort: value as ShopSort })),
          h.Class(
            css({
              height: '100%',
              minWidth: '0',
              flex: '1 1 0%',
              backgroundColor: 'transparent',
              fontSize: 'type.11-5',
              color: 'foreground',
              outlineStyle: 'none',
            }),
          ),
        ],
        SORTS.map(([value, label]) =>
          h.option(
            [h.Value(value), ...(value === model.shopSort ? [h.Selected(true)] : [])],
            [sorts[value] ?? label],
          ),
        ),
      ),
    ],
  )

  const slotRail = h.aside(
    [h.Class(css({ display: 'flex', minWidth: '0', flexDirection: 'column', gap: '4' }))],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '1',
              _narrow: {
                flexDirection: 'row',
                alignItems: 'center',
                gap: '2',
              },
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                cx(
                  EYEBROW,
                  css({
                    paddingInline: '2',
                    color: 'mutedForeground',
                    _narrow: { paddingInline: '0' },
                  }),
                ),
              ),
            ],
            [t.shop.build],
          ),
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2',
                  paddingInline: '2',
                  _narrow: { paddingInline: '0' },
                }),
              ),
            ],
            [
              icon(
                h,
                node.type === 'database' ? HardDrive : Cpu,
                css({ width: '4', height: '4', flexShrink: '0', color: 'mutedForeground' }),
              ),
              h.span(
                [
                  h.Class(
                    css({
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 'type.13',
                      fontWeight: 'semibold',
                    }),
                  ),
                ],
                [title],
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
              gap: '0.5',
              _narrow: {
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '1',
              },
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                cx(
                  EYEBROW,
                  css({
                    paddingInline: '2',
                    color: 'mutedForeground',
                    _narrow: { display: 'none' },
                  }),
                ),
              ),
            ],
            [t.shop.slots],
          ),
          ...SLOT_ORDER.map((entry) =>
            slotButton(
              entry,
              entry === slot,
              entry === 'disk' && !isDatabase ? t.shop.swap : installedPart(node, entry),
              t,
              node.id,
              h,
            ),
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
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
            }),
          ),
        ],
        [
          weekStrip(model, t, h),
          h.div(
            [h.Class(css({ display: 'flex', alignItems: 'center', gap: '1.5' }))],
            [
              icon(
                h,
                trend === 'up' ? ArrowUp : trend === 'down' ? ArrowDown : ArrowUpDown,
                css({
                  width: '3.5',
                  height: '3.5',
                  flexShrink: '0',
                  color: trend === 'up' ? 'danger' : trend === 'down' ? 'ok' : 'mutedForeground',
                }),
              ),
              h.span(
                [h.Class(css({ fontSize: 'type.11-5', fontWeight: 'medium' }))],
                [t.shop.market(percentLabel)],
              ),
            ],
          ),
          ...(game.sandbox
            ? [h.span([h.Class(css({ fontSize: 'type.10-5', color: 'ok' }))], [t.shop.free])]
            : []),
        ],
      ),
    ],
  )

  const slotHint =
    slot === 'ram'
      ? t.inspector.partsMemoryHint
      : slot === 'disk' && isDatabase
        ? t.inspector.partsDiskHint
        : null

  const center = h.section(
    [h.Class(css({ display: 'flex', minWidth: '0', flexDirection: 'column', gap: '3' }))],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '3',
            }),
          ),
        ],
        [
          h.span(
            [h.Class(css({ fontSize: 'type.17', fontWeight: 'semibold' }))],
            [slotTitle(slot, t)],
          ),
          ...(serverDisk
            ? []
            : [
                h.span(
                  [h.Class(css({ fontSize: 'type.11-5', color: 'mutedForeground' }))],
                  [t.shop.resultCount(sorted.length)],
                ),
              ]),
        ],
      ),
      ...(serverDisk
        ? []
        : [
            h.div(
              [
                h.Class(
                  css({
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 190px',
                    gap: '2',
                    alignItems: 'center',
                    _narrow: { gridTemplateColumns: 'minmax(0, 1fr)' },
                  }),
                ),
              ],
              [searchField, sortField],
            ),
          ]),
      ...(empty === null
        ? []
        : [
            h.div(
              [
                h.Class(
                  css({
                    borderRadius: 'lg',
                    backgroundColor: 'well',
                    paddingInline: '3',
                    paddingBlock: '2',
                    fontSize: 'type.12',
                    color: 'mutedForeground',
                  }),
                ),
              ],
              [empty],
            ),
          ]),
      ...(serverDisk
        ? [
            h.div(
              [
                h.Class(
                  css({
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
                  }),
                ),
              ],
              [
                icon(h, HardDrive, css({ width: '6', height: '6', opacity: 0.6 })),
                h.span(
                  [h.Class(css({ fontSize: 'type.12', textAlign: 'center' }))],
                  [t.shop.appDisk],
                ),
              ],
            ),
          ]
        : sorted.length === 0
          ? [
              h.div(
                [
                  h.Class(
                    css({
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
                    }),
                  ),
                ],
                [
                  icon(h, Search, css({ width: '6', height: '6', opacity: 0.6 })),
                  h.span(
                    [h.Class(css({ fontSize: 'type.12', textAlign: 'center' }))],
                    [t.shop.noResults],
                  ),
                  button(
                    {
                      onClick: Message.ShopQueryChanged({ query: '' }),
                      variant: 'outline',
                      size: 'sm',
                    },
                    t.shop.clearSearch,
                    h,
                  ),
                ],
              ),
            ]
          : [
              h.div(
                [
                  h.Class(
                    cx(
                      css({
                        display: 'grid',
                        gap: '2',
                        _narrow: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
                      }),
                      columns === 2
                        ? css({ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' })
                        : css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
                    ),
                  ),
                ],
                sorted.map((card) => partCard(card, t, h)),
              ),
            ]),
      ...(slotHint === null
        ? []
        : [
            h.p(
              [
                h.Class(
                  css({
                    paddingInline: '1',
                    fontSize: 'type.11-5',
                    lineHeight: 'snug',
                    color: 'mutedForeground',
                  }),
                ),
              ],
              [slotHint],
            ),
          ]),
    ],
  )

  const summaryRows = (['cpu', 'ram', 'disk'] as const).map((entry) => {
    const value = entry === 'disk' && !isDatabase ? t.shop.swap : installedPart(node, entry)
    return h.div(
      [
        h.Class(
          css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '2',
            fontSize: 'type.11-5',
          }),
        ),
      ],
      [
        h.span([h.Class(css({ color: 'mutedForeground' }))], [slotTitle(entry, t)]),
        h.span(
          [
            h.Class(
              cx(
                FIGURE,
                css({
                  color: value === null ? 'mutedForeground' : 'foreground',
                  fontSize: 'type.11-5',
                }),
              ),
            ),
          ],
          [value ?? '—'],
        ),
      ],
    )
  })

  const summary = h.aside(
    [
      h.Class(
        css({
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
        }),
      ),
    ],
    [
      h.div(
        [h.Class(css({ display: 'flex', flexDirection: 'column', gap: '1.5' }))],
        [
          h.span([h.Class(cx(EYEBROW, css({ color: 'mutedForeground' })))], [t.shop.build]),
          ...summaryRows,
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '1',
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderColor: 'border',
              paddingTop: '3',
            }),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '2',
                }),
              ),
            ],
            [
              h.span(
                [h.Class(css({ fontSize: 'type.11-5', color: 'mutedForeground' }))],
                [t.shop.partsTotal],
              ),
              h.span([h.Class(cx(FIGURE, css({ fontSize: 'type.13' })))], [money(total)]),
            ],
          ),
          h.span([h.Class(css({ fontSize: 'type.10', color: 'mutedForeground' }))], [t.shop.today]),
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '2',
                  paddingTop: '2',
                }),
              ),
            ],
            [
              h.span(
                [h.Class(css({ fontSize: 'type.11-5', color: 'mutedForeground' }))],
                [t.shop.burn],
              ),
              h.span(
                [h.Class(cx(FIGURE, css({ fontSize: 'type.12' })))],
                [t.units.perSecond(money(burn))],
              ),
            ],
          ),
        ],
      ),
    ],
  )

  return shell(
    t.shop.title,
    [],
    [
      h.div(
        [
          h.Class(
            css({
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
            }),
          ),
        ],
        [slotRail, center, summary],
      ),
    ],
    css({ maxWidth: 'calc(980px * var(--type-scale))' }),
    h,
  )
}
