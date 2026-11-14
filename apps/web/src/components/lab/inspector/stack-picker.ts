import { css, cx } from '@quorum/styled-system/css'
import { Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'
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
import { icon } from '@quorum/ui/primitives/icon'
import { WELL, stackLogo } from '@quorum/ui/game/bits'

/** Accept unaccented keyboard input as well as the spelling shown in the list. */
const searchable = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

type PickerConfig<Item extends string> = Readonly<{
  /** The DOM id prefix, so a page can hold both lists. */
  id: string
  picker: StackPicker
  toParentMessage: (message: StackPickerMessage) => Message
  onChoose: (item: Item) => Message
  current: Item
  items: ReadonlyArray<Item>
  labelOf: (item: Item) => string
  searchOf: (item: Item) => string
  logoOf: (item: Item) => Html | null
  isReady: (item: Item) => boolean
  lockHintOf: (item: Item) => string
  proposed: Item | null
  /** Hovering a ready option previews it on a Tradeoff card. */
  previewOf: ((item: Item) => Message) | null
  t: Messages
  ariaLabel: string
}>

const row = <Item extends string>(
  config: PickerConfig<Item>,
  item: Item,
  index: number,
  isActive: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const isDisabled = !config.isReady(item)
  const isSelected = item === config.current
  const logo = config.logoOf(item)
  return h.li(
    [
      h.Key(item),
      h.Id(`${config.id}-option-${index}`),
      h.Role('option'),
      h.AriaSelected(isSelected),
      ...(isDisabled ? [h.AriaDisabled(true), h.Title(config.lockHintOf(item))] : []),
      ...(config.previewOf && !isDisabled && !isSelected
        ? [h.OnMouseEnter(config.previewOf(item)), h.OnMouseLeave(Message.OptionLeft())]
        : []),
      ...(isDisabled ? [] : [h.OnClick(config.onChoose(item))]),
      h.Class(
        cx(
          css({
            display: 'flex',
            minHeight: '8',
            alignItems: 'center',
            gap: '2',
            paddingInline: '2.5',
            fontSize: 'calc(12px*var(--type-scale))',
            transitionProperty:
              'color, background-color, border-color, text-decoration-color, fill, stroke',
            transitionDuration: '150ms',
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
      ),
    ],
    [
      ...(logo ? [logo] : []),
      h.span(
        [
          h.Class(
            css({
              minWidth: '0',
              flex: '1 1 0%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }),
          ),
        ],
        [config.labelOf(item)],
      ),
      config.proposed === item
        ? h.span(
            [
              h.Class(
                css({
                  fontSize: 'calc(10px*var(--type-scale))',
                  color: 'groupCompute',
                }),
              ),
            ],
            [config.t.inspectorShared.proposed],
          )
        : h.empty,
      isSelected
        ? icon(
            h,
            Check,
            css({
              width: '3.5',
              height: '3.5',
              flexShrink: '0',
              color: 'primary',
            }),
          )
        : h.empty,
      isDisabled
        ? icon(
            h,
            Lock,
            css({
              width: '3',
              height: '3',
              flexShrink: '0',
              color: 'color-mix(in oklab, var(--muted-foreground) 45%, transparent)',
            }),
          )
        : h.empty,
    ],
  )
}

const pickerView = <Item extends string>(
  config: PickerConfig<Item>,
  h: HtmlBuilder<Message>,
): Html => {
  const query = config.picker.query.trim()
  const visible =
    query === ''
      ? config.items
      : config.items.filter((item) => searchable(config.searchOf(item)).includes(searchable(query)))
  const active = visible[config.picker.active]
  const activeIndex = active === undefined ? -1 : config.picker.active
  return h.div(
    [
      h.Class(
        cx(
          WELL,
          css({
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }),
        ),
      ),
    ],
    [
      h.label(
        [
          h.Class(
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
          ),
        ],
        [
          icon(
            h,
            Search,
            css({
              width: '3.5',
              height: '3.5',
              flexShrink: '0',
            }),
          ),
          h.input([
            h.Id(`${config.id}-search`),
            h.Type('search'),
            h.Value(config.picker.query),
            h.Placeholder(config.t.inspectorShared.searchPlaceholder),
            h.AriaLabel(config.ariaLabel),
            h.Role('combobox'),
            h.AriaExpanded(true),
            h.AriaControls(`${config.id}-list`),
            ...(activeIndex >= 0
              ? [h.AriaActiveDescendant(`${config.id}-option-${activeIndex}`)]
              : []),
            h.Autocomplete('off'),
            h.Spellcheck(false),
            h.Class(
              css({
                height: '100%',
                minWidth: '0',
                flex: '1 1 0%',
                backgroundColor: 'transparent',
                fontSize: 'calc(12px*var(--type-scale))',
                color: 'foreground',
                outlineStyle: 'none',
                '&::placeholder': {
                  color: 'mutedForeground',
                },
              }),
            ),
            h.OnInput((value) =>
              config.toParentMessage(StackPickerMessage.Searched({ query: value })),
            ),
            h.OnKeyDownSelfPreventDefault((key) => {
              if (key === 'Escape')
                return Option.some(
                  config.toParentMessage(StackPickerMessage.Searched({ query: '' })),
                )
              if (key === 'ArrowDown' || key === 'ArrowUp')
                return Option.some(
                  config.toParentMessage(
                    StackPickerMessage.Moved({
                      delta: key === 'ArrowDown' ? 1 : -1,
                      count: visible.length,
                    }),
                  ),
                )
              if (key === 'Enter' && active !== undefined && config.isReady(active))
                return Option.some(config.onChoose(active))
              return Option.none()
            }),
          ]),
        ],
      ),
      visible.length === 0
        ? h.p(
            [
              h.Class(
                css({
                  paddingInline: '2.5',
                  paddingBlock: '2',
                  fontSize: 'calc(11px*var(--type-scale))',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [config.t.inspectorShared.noMatches],
          )
        : h.ul(
            [
              h.Id(`${config.id}-list`),
              h.Role('listbox'),
              h.AriaLabel(config.ariaLabel),
              h.Class(
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
              ),
            ],
            visible.map((item, index) => row(config, item, index, item === active, h)),
          ),
    ],
  )
}

/** The Runtime on an App Server, Worker or Realtime Hub. */
export const runtimePickerView = (
  model: Model,
  node: GameNode,
  h: HtmlBuilder<Message>,
  proposed: RuntimeId | null,
  preview = true,
): Html => {
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

/** The Framework on an App Server or Worker, limited to the Runtime's language. */
export const frameworkPickerView = (
  model: Model,
  node: GameNode,
  h: HtmlBuilder<Message>,
): Html => {
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
