import { css, cx } from '@quorum/styled-system/css'
import { Listbox } from '@foldkit/ui'
import { Option } from 'effect'
import type { HtmlBuilder } from 'foldkit/html'
import { Check, ChevronDown } from 'lucide'
import { icon } from '@quorum/ui/primitives/icon'
import { Message } from '../game/message.ts'
import { languageListbox } from './listbox.ts'
import { supportedLocales, type Locale } from './index.ts'
import { copyIn } from './messages.ts'

export const languagePicker = (locale: Locale, model: Listbox.Model, h: HtmlBuilder<Message>) =>
  h.div(
    [h.DataAttribute('language-picker', '')],
    [
      h.submodel({
        slotId: 'interface-language',
        model,
        view: languageListbox.view,
        toParentMessage: (message) => Message.LanguagePickerChanged({ message }),
        viewInputs: {
          items: supportedLocales,
          itemToValue: (choice) => choice.value,
          itemToSearchText: (choice) => choice.label,
          maybeSelectedValue: Option.some(locale),
          ariaLabel: copyIn(locale).panels.language,
          // Settings clips its overflow, so the menu portals out of it.
          anchor: { placement: 'bottom-end', gap: 6, portal: true },
          buttonClassName: css({
            display: 'flex',
            height: '8',
            minWidth: '32',
            cursor: 'pointer',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '3',
            borderRadius: 'lg',
            backgroundColor: 'well',
            paddingInline: '2.5',
            fontSize: 'type.14',
            lineHeight: 'fine',
            color: 'foreground',
            boxShadow: 'well',
            outlineStyle: 'none',
            _hover: { backgroundColor: 'muted' },
            _focusVisible: {
              boxShadow:
                'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
            },
          }),
          buttonContent: h.span(
            [
              h.Class(
                css({
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '3',
                }),
              ),
            ],
            [
              h.span(
                [h.Attribute('lang', locale)],
                [supportedLocales.find((choice) => choice.value === locale)?.label ?? locale],
              ),
              icon(h, ChevronDown, css({ width: '4', height: '4', color: 'mutedForeground' })),
            ],
          ),
          itemsClassName: css({
            zIndex: '50',
            minWidth: '40',
            borderRadius: 'xl',
            borderWidth: '1px',
            borderColor: 'border',
            layerStyle: 'raised',
            padding: '1',
            color: 'foreground',
            boxShadow: 'lg',
            outlineStyle: 'none',
          }),
          itemsScrollClassName: css({ maxHeight: '64', overflowY: 'auto' }),
          backdropClassName: css({ position: 'fixed', inset: '0', zIndex: '40' }),
          itemToConfig: (choice, { isActive, isSelected }) => ({
            className: cx(
              css({
                display: 'flex',
                minHeight: '9',
                cursor: 'pointer',
                alignItems: 'center',
                gap: '2',
                borderRadius: 'lg',
                paddingInline: '2.5',
                fontSize: 'type.14',
                lineHeight: 'fine',
                outlineStyle: 'none',
              }),
              isActive ? css({ backgroundColor: 'muted', color: 'foreground' }) : '',
            ),
            content: h.span(
              [
                h.Class(
                  css({
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '4',
                  }),
                ),
                h.Attribute('lang', choice.value),
              ],
              [
                h.span([], [choice.label]),
                h.span(
                  [h.AriaHidden(true), h.Class(isSelected ? '' : css({ visibility: 'hidden' }))],
                  [icon(h, Check, css({ width: '4', height: '4', color: 'primary' }))],
                ),
              ],
            ),
          }),
        },
      }),
    ],
  )
