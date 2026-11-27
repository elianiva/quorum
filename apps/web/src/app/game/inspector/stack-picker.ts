import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { Check, Lock, Search } from 'lucide'
import {
  FRAMEWORKS,
  FRAMEWORK_IDS,
  LANGUAGES,
  RUNTIMES,
  RUNTIME_IDS,
  type RuntimeId,
} from '@quorum/simulation/catalog'
import { frameworkReady, runtimeReady } from '@quorum/simulation/lookups'
import type { GameNode } from '@quorum/simulation/state'
import { copy, type Messages } from '@/i18n/messages.ts'
import { Message } from '@/game/message.ts'
import type { Model } from '@/game/model.ts'
import { StackPickerMessage, type StackPicker } from '@/game/stack-picker.ts'
import { icon } from '../../ui/icon.ts'
import { WELL } from '@quorum/ui/game/bits'
import { stackLogo } from './shared.ts'

type Content = View.Content<Message>

const searchable = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

type PickerConfig<Item extends string> = Readonly<{
  id: string
  picker: StackPicker
  toParentMessage: (message: StackPickerMessage) => Message
  onChoose: (item: Item) => Message
  current: Item
  items: ReadonlyArray<Item>
  labelOf: (item: Item) => string
  searchOf: (item: Item) => string
  logoOf: (item: Item) => Content | null
  isReady: (item: Item) => boolean
  lockHintOf: (item: Item) => string
  proposed: Item | null
  previewOf: ((item: Item) => Message) | null
  t: Messages
  ariaLabel: string
}>

const row = <Item extends string>(
  config: PickerConfig<Item>,
  item: Item,
  index: number,
  isActive: boolean,
  h: H<Message>,
): Content => {
  const isDisabled = !config.isReady(item)
  const isSelected = item === config.current
  const logo = config.logoOf(item)
  const base = h.li
    .key(item)
    .id(`${config.id}-option-${index}`)
    .attr('role', 'option')
    .attr('aria-selected', isSelected ? 'true' : 'false')
    .attr('aria-disabled', isDisabled ? 'true' : undefined)
    .attr('title', isDisabled ? config.lockHintOf(item) : undefined)
    .class(
      cx(
        css({
          display: 'flex',
          minHeight: '8',
          alignItems: 'center',
          gap: '2',
          paddingInline: '2.5',
          fontSize: 'type.12',
          transitionProperty:
            'color, background-color, border-color, text-decoration-color, fill, stroke',
          transitionDuration: 'fast',
          transitionTimingFunction: 'out',
        }),
        isActive
          ? css({
              backgroundColor: 'muted',
              color: 'foreground',
            })
          : css({
              color: 'mutedForeground',
            }),
        isSelected &&
          css({
            color: 'foreground',
          }),
        isDisabled
          ? css({
              cursor: 'not-allowed',
              color: 'color-mix(in oklab, var(--muted-foreground) 45%, transparent)',
              '& svg': {
                opacity: 0.45,
                filter: 'grayscale(100%)',
              },
            })
          : css({
              cursor: 'pointer',
              _hover: {
                backgroundColor: 'muted',
                color: 'foreground',
              },
            }),
      ),
    )
  const hovered =
    config.previewOf && !isDisabled && !isSelected
      ? base
          .on('mouseenter', () => config.previewOf?.(item))
          .on('mouseleave', () => Message.OptionLeft())
      : base
  const clickable = isDisabled ? hovered : hovered.on('click', () => config.onChoose(item))
  return clickable.children(
    ...(logo ? [logo] : []),
    h.span
      .class(
        css({
          minWidth: '0',
          flex: '1 1 0%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }),
      )
      .children(config.labelOf(item)),
    ...(config.proposed === item
      ? [
          h.span
            .class(
              css({
                fontSize: 'type.10',
                color: 'groupCompute',
              }),
            )
            .children(config.t.inspectorShared.proposed),
        ]
      : []),
    ...(isSelected
      ? [
          icon(
            h,
            Check,
            css({
              width: '3.5',
              height: '3.5',
              flexShrink: '0',
              color: 'primary',
            }),
          ),
        ]
      : []),
    ...(isDisabled
      ? [
          icon(
            h,
            Lock,
            css({
              width: '3',
              height: '3',
              flexShrink: '0',
              color: 'color-mix(in oklab, var(--muted-foreground) 45%, transparent)',
            }),
          ),
        ]
      : []),
  )
}

const pickerView = <Item extends string>(config: PickerConfig<Item>, h: H<Message>): Content => {
  const query = config.picker.query.trim()
  const visible =
    query === ''
      ? config.items
      : config.items.filter((item) => searchable(config.searchOf(item)).includes(searchable(query)))
  const active = visible[config.picker.active]
  const activeIndex = active === undefined ? -1 : config.picker.active
  return h.div
    .class(
      cx(
        WELL,
        css({
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }),
      ),
    )
    .children(
      h.label
        .class(
          css({
            display: 'flex',
            height: '8',
            flexShrink: '0',
            alignItems: 'center',
            gap: '2',
            borderBottomWidth: '1px',
            borderBottomStyle: 'solid',
            borderColor: 'hairline',
            paddingInline: '2.5',
            color: 'mutedForeground',
          }),
        )
        .children(
          icon(
            h,
            Search,
            css({
              width: '3.5',
              height: '3.5',
              flexShrink: '0',
            }),
          ),
          h.input
            .id(`${config.id}-search`)
            .attr('type', 'search')
            .value(config.picker.query)
            .attr('placeholder', config.t.inspectorShared.searchPlaceholder)
            .attr('aria-label', config.ariaLabel)
            .attr('role', 'combobox')
            .attr('aria-expanded', 'true')
            .attr('aria-controls', `${config.id}-list`)
            .attr(
              'aria-activedescendant',
              activeIndex >= 0 ? `${config.id}-option-${activeIndex}` : undefined,
            )
            .attr('autocomplete', 'off')
            .attr('spellcheck', 'false')
            .class(
              css({
                height: '100%',
                minWidth: '0',
                flex: '1 1 0%',
                backgroundColor: 'transparent',
                fontSize: 'type.12',
                color: 'foreground',
                outlineStyle: 'none',
                '&::placeholder': {
                  color: 'mutedForeground',
                },
              }),
            )
            .on('input', ({ value }) =>
              config.toParentMessage(StackPickerMessage.Searched({ query: value })),
            )
            .on(
              'keydown',
              ({ key }) => {
                if (key === 'Escape')
                  return config.toParentMessage(StackPickerMessage.Searched({ query: '' }))
                if (key === 'ArrowDown' || key === 'ArrowUp')
                  return config.toParentMessage(
                    StackPickerMessage.Moved({
                      delta: key === 'ArrowDown' ? 1 : -1,
                      count: visible.length,
                    }),
                  )
                if (key === 'Enter' && active !== undefined && config.isReady(active))
                  return config.onChoose(active)
                return undefined
              },
              { preventDefault: true },
            ),
        ),
      ...(visible.length === 0
        ? [
            h.p
              .class(
                css({
                  paddingInline: '2.5',
                  paddingBlock: '2',
                  fontSize: 'type.11',
                  color: 'mutedForeground',
                }),
              )
              .children(config.t.inspectorShared.noMatches),
          ]
        : [
            h.ul
              .id(`${config.id}-list`)
              .attr('role', 'listbox')
              .attr('aria-label', config.ariaLabel)
              .class(
                css({
                  maxHeight: '40',
                  '& > :not(:last-child)': {
                    borderBottomWidth: '1px',
                    borderBottomStyle: 'solid',
                    borderColor: 'hairline',
                  },
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  scrollbarWidth: 'thin',
                }),
              )
              .children(
                ...visible.map((item, index) => row(config, item, index, item === active, h)),
              ),
          ]),
    )
}

export const runtimePickerView = (
  model: Model,
  node: GameNode,
  h: H<Message>,
  proposed: RuntimeId | null,
  preview = true,
): Content => {
  const t = copy(h)
  const game = model.board.game
  return pickerView(
    {
      id: 'stack-runtime',
      picker: model.runtimePicker,
      toParentMessage: (message) => Message.RuntimePickerChanged({ message }),
      onChoose: (id) => Message.OptionChosen({ nodeId: node.id, option: { kind: 'runtime', id } }),
      current: node.runtime,
      items: RUNTIME_IDS,
      labelOf: (id) => t.catalog.runtimes[id].name,
      searchOf: (id) =>
        [
          t.catalog.runtimes[id].name,
          RUNTIMES[id].name,
          LANGUAGES[RUNTIMES[id].language].name,
        ].join(' '),
      logoOf: (id) =>
        stackLogo(
          RUNTIMES[id].language,
          css({
            width: '4',
            height: '4',
          }),
          h,
        ),
      isReady: (id) => runtimeReady(game, id),
      lockHintOf: (id) => t.inspectorShared.researchToUnlock(t.catalog.runtimes[id].name),
      proposed,
      previewOf: preview
        ? (id) => Message.OptionPreviewed({ nodeId: node.id, option: { kind: 'runtime', id } })
        : null,
      t,
      ariaLabel: t.inspectorShared.runtime,
    },
    h,
  )
}

export const frameworkPickerView = (model: Model, node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  const game = model.board.game
  const runtime = RUNTIMES[node.runtime]
  const items = FRAMEWORK_IDS.filter(
    (id) => id === 'none' || FRAMEWORKS[id].language === runtime.language,
  )
  return pickerView(
    {
      id: 'stack-framework',
      picker: model.frameworkPicker,
      toParentMessage: (message) => Message.FrameworkPickerChanged({ message }),
      onChoose: (id) =>
        Message.OptionChosen({ nodeId: node.id, option: { kind: 'framework', id } }),
      current: node.framework,
      items,
      labelOf: (id) => t.catalog.frameworks[id].name,
      searchOf: (id) => `${t.catalog.frameworks[id].name} ${FRAMEWORKS[id].name}`,
      logoOf: (id) =>
        id === 'none'
          ? null
          : stackLogo(
              id,
              css({
                width: '4',
                height: '4',
              }),
              h,
            ),
      isReady: (id) => frameworkReady(game, id),
      lockHintOf: (id) => t.inspectorShared.researchToUnlock(t.catalog.frameworks[id].name),
      proposed: null,
      previewOf: (id) =>
        Message.OptionPreviewed({ nodeId: node.id, option: { kind: 'framework', id } }),
      t,
      ariaLabel: t.inspectorShared.framework,
    },
    h,
  )
}
