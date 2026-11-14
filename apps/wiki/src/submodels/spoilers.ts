import { Effect, Option, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { defineView } from 'foldkit/submodel'
import { defineMessageUnion } from 'foldkit/message'
import { Check, ChevronDown, Shield, ShieldOff } from 'lucide'
import { icon } from '@quorum/ui/primitives/icon'
import { langOf } from '../i18n/lang.ts'
import type { Locale } from '../i18n/locale.ts'
import { css, cx } from '@quorum/styled-system/css'

/* The spoiler filter: the last Era the reader reached. Pages about later Eras fold. Kept in the browser. */

/** Every Era: content from any Era shows. */
export const ALL_ERAS = -1

export const Model = Schema.Struct({ era: Schema.Finite, open: Schema.Boolean })
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  Chosen: { era: Schema.Finite },
  Loaded: { era: Schema.Finite },
  MenuToggled: {},
  Closed: {},
  Toggled: {},
  Saved: {},
})
export type Message = typeof Message.Type

const KEY = 'quorum.wiki.era'

export const init: Model = { era: ALL_ERAS, open: false }

export const Load = Command.define('LoadEra', {
  messages: [Message.Loaded],
  execute: Effect.sync(() => {
    const stored = Number(globalThis.localStorage?.getItem(KEY) ?? ALL_ERAS)
    return Message.Loaded({ era: Number.isInteger(stored) ? stored : ALL_ERAS })
  }),
})

const Save = Command.define('SaveEra', {
  args: { era: Schema.Finite },
  messages: [Message.Saved],
  execute: ({ era }) =>
    Effect.sync(() => {
      globalThis.localStorage?.setItem(KEY, String(era))
      return Message.Saved()
    }),
})

/** After a choice or Escape, return keyboard focus to the chip that opened the menu. */
const FocusTrigger = Command.define('FocusSpoilerTrigger', {
  messages: [Message.Saved],
  execute: Effect.promise(async () => {
    // The menu leaves the tree in the same update, so wait for its frame before focusing.
    await new Promise((resolve) => requestAnimationFrame(resolve))
    document.getElementById('spoiler-era')?.focus()
    return Message.Saved()
  }),
})

/** Move focus into the open menu, onto the chosen Era, so Escape and Tab work at once. */
const FocusMenu = Command.define('FocusSpoilerMenu', {
  args: { era: Schema.Finite },
  messages: [Message.Saved],
  execute: ({ era }) =>
    Effect.promise(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
      document.getElementById(era === ALL_ERAS ? 'spoiler-era-all' : `spoiler-era-${era}`)?.focus()
      return Message.Saved()
    }),
})

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match<Update.Return<Model, Message>>(message, {
    Chosen: ({ era }) => ({
      model: { era, open: false },
      commands: [Save({ era }), FocusTrigger()],
    }),
    Loaded: ({ era }) => ({ model: { era, open: false } }),
    MenuToggled: () => {
      const open = !model.open
      return {
        model: { ...model, open },
        commands: open ? [FocusMenu({ era: model.era })] : [],
      }
    },
    Closed: () => ({ model: { ...model, open: false }, commands: [FocusTrigger()] }),
    Toggled: () => {
      const era = model.era === ALL_ERAS ? 0 : ALL_ERAS
      return { model: { ...model, era, open: false }, commands: [Save({ era })] }
    },
    Saved: () => ({ model }),
  })

/** A page about `era` folds for this reader. */
export const hides = (model: Model, era: number | null): boolean =>
  era !== null && model.era !== ALL_ERAS && era > model.era

/** The control at the foot of the sidebar: a shield switch and the Era boundary it protects. */
export const view = defineView<Model, Message, Readonly<{ locale: Locale }>>(
  (model, { locale }, h) => {
    const l = langOf(locale)
    const t = l.t.spoilers
    const ERAS = l.cat.ERAS
    const all = model.era === ALL_ERAS
    const after = all ? t.allEras : t.after(ERAS[model.era]?.name ?? '')
    const chip = css({
      display: 'flex',
      height: '8',
      overflow: 'hidden',
      borderRadius: 'md',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'border',
      backgroundColor: 'nested',
    })
    const shield = css({
      display: 'grid',
      width: '8',
      height: '100%',
      flexShrink: '0',
      placeItems: 'center',
      borderRightWidth: '1px',
      borderRightStyle: 'solid',
      borderColor: 'hairline',
      backgroundColor: 'transparent',
      color: all ? 'mutedForeground' : 'foreground',
      cursor: 'pointer',
      _hover: { backgroundColor: 'muted' },
    })
    const value = css({
      display: 'flex',
      minWidth: '0',
      flex: '1 1 0%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '2',
      paddingInline: '2.5',
      backgroundColor: 'transparent',
      color: 'foreground',
      cursor: 'pointer',
      fontSize: 'calc(12px * var(--type-scale))',
      _hover: { backgroundColor: 'muted' },
    })
    const menu = css({
      position: 'absolute',
      right: '0',
      bottom: 'calc(100% + 6px)',
      left: '0',
      zIndex: '22',
      maxHeight: 'min(60dvh, 260px)',
      overflowY: 'auto',
      borderRadius: 'xl',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'hairline',
      backgroundColor: 'popover',
      boxShadow: 'float',
      padding: '1',
    })
    const item = css({
      display: 'flex',
      width: '100%',
      minWidth: '0',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1',
      borderRadius: 'sm',
      paddingInline: '2',
      paddingBlock: '1.5',
      backgroundColor: 'transparent',
      color: 'foreground',
      cursor: 'pointer',
      fontSize: 'calc(12px * var(--type-scale))',
      textAlign: 'left',
      _hover: { backgroundColor: 'muted' },
    })
    const chosen = css({ backgroundColor: 'muted', fontWeight: '500' })
    const check = css({ width: '3', height: '3', flexShrink: '0', color: 'mutedForeground' })
    const itemFor = (name: string, index: number) =>
      h.button(
        [
          h.Id(`spoiler-era-${index}`),
          h.Key(name),
          h.Type('button'),
          h.Role('menuitemradio'),
          h.AriaChecked(model.era === index),
          h.AriaLabel(t.upTo(name)),
          h.OnClick(Message.Chosen({ era: index })),
          h.Class(cx(item, model.era === index ? chosen : '')),
        ],
        [
          h.span([h.Class(css({ overflow: 'hidden', textOverflow: 'ellipsis' }))], [name]),
          model.era === index ? icon(h, Check, check) : h.empty,
        ],
      )
    return h.div(
      [
        h.Class(
          css({
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            borderColor: 'border',
            paddingTop: '3',
          }),
        ),
      ],
      [
        h.span(
          [
            h.Class(
              css({
                fontSize: 'calc(12px * var(--type-scale))',
                fontWeight: '600',
                color: 'foreground',
              }),
            ),
          ],
          [t.title],
        ),
        h.div(
          [
            h.Class(css({ position: 'relative', marginTop: '2' })),
            h.OnKeyDownPreventDefault((key) =>
              key === 'Escape' && model.open ? Option.some(Message.Closed()) : Option.none(),
            ),
          ],
          [
            model.open
              ? h.button(
                  [
                    h.Type('button'),
                    h.Tabindex(-1),
                    h.AriaHidden(true),
                    h.OnClick(Message.Closed()),
                    h.Class(
                      css({
                        position: 'fixed',
                        inset: '0',
                        zIndex: '20',
                        borderWidth: '0',
                        padding: '0',
                        backgroundColor: 'transparent',
                        cursor: 'default',
                      }),
                    ),
                  ],
                  [],
                )
              : h.empty,
            h.div(
              [h.Class(cx(chip, css({ position: 'relative', zIndex: '21' })))],
              [
                h.button(
                  [
                    h.Type('button'),
                    h.Role('switch'),
                    h.AriaChecked(!all),
                    h.AriaLabel(t.hideFuture),
                    h.Title(t.hideFuture),
                    h.DataAttribute('spoiler-toggle', ''),
                    h.OnClick(Message.Toggled()),
                    h.Class(shield),
                  ],
                  [
                    icon(
                      h,
                      all ? ShieldOff : Shield,
                      css({ width: '4', height: '4', flexShrink: '0' }),
                    ),
                  ],
                ),
                h.button(
                  [
                    h.Id('spoiler-era'),
                    h.Type('button'),
                    h.AriaLabel(t.chooseEra),
                    h.AriaHasPopup('menu'),
                    h.AriaControls('spoiler-era-menu'),
                    h.AriaExpanded(model.open),
                    h.DataAttribute('spoiler-era', ''),
                    h.OnClick(Message.MenuToggled()),
                    h.Class(value),
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
                      [after],
                    ),
                    icon(
                      h,
                      ChevronDown,
                      css({
                        width: '3.5',
                        height: '3.5',
                        flexShrink: '0',
                        color: 'mutedForeground',
                      }),
                    ),
                  ],
                ),
              ],
            ),
            model.open
              ? h.div(
                  [
                    h.Id('spoiler-era-menu'),
                    h.Role('menu'),
                    h.AriaLabel(t.chooseEra),
                    h.Class(menu),
                  ],
                  [
                    h.button(
                      [
                        h.Id('spoiler-era-all'),
                        h.Type('button'),
                        h.Role('menuitemradio'),
                        h.AriaChecked(all),
                        h.AriaLabel(t.showEvery),
                        h.OnClick(Message.Chosen({ era: ALL_ERAS })),
                        h.Class(cx(item, all ? chosen : '')),
                      ],
                      [h.span([], [t.allEras]), all ? icon(h, Check, check) : h.empty],
                    ),
                    h.div(
                      [
                        h.Class(
                          css({
                            height: '1px',
                            marginBlock: '1',
                            backgroundColor: 'hairline',
                          }),
                        ),
                      ],
                      [],
                    ),
                    h.div(
                      [
                        h.Class(
                          css({
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                            gap: '1',
                          }),
                        ),
                      ],
                      ERAS.map((era, index) => itemFor(era.name, index)),
                    ),
                  ],
                )
              : h.empty,
          ],
        ),
      ],
    )
  },
)
