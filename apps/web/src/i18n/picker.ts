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
            height: '2rem',
            minWidth: '8rem',
            cursor: 'pointer',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            borderRadius: 'lg',
            backgroundColor: 'var(--well)',
            paddingInline: '0.625rem',
            fontSize: 'calc(0.875rem * var(--type-scale))',
            lineHeight: 'calc(1.25 / 0.875)',
            color: 'var(--foreground)',
            boxShadow: 'well',
            outlineStyle: 'none',
            _hover: { backgroundColor: 'var(--muted)' },
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
                  gap: '0.75rem',
                }),
              ),
            ],
            [
              h.span(
                [h.Attribute('lang', locale)],
                [supportedLocales.find((choice) => choice.value === locale)?.label ?? locale],
              ),
              icon(
                h,
                ChevronDown,
                css({ width: '1rem', height: '1rem', color: 'var(--muted-foreground)' }),
              ),
            ],
          ),
          itemsClassName: css({
            zIndex: '50',
            minWidth: '10rem',
            borderRadius: 'xl',
            borderWidth: '1px',
            borderColor: 'var(--border)',
            layerStyle: 'raised',
            padding: '0.25rem',
            color: 'var(--foreground)',
            boxShadow: 'lg',
            outlineStyle: 'none',
          }),
          itemsScrollClassName: css({ maxHeight: '16rem', overflowY: 'auto' }),
          backdropClassName: css({ position: 'fixed', inset: '0', zIndex: '40' }),
          itemToConfig: (choice, { isActive, isSelected }) => ({
            className: cx(
              css({
                display: 'flex',
                minHeight: '2.25rem',
                cursor: 'pointer',
                alignItems: 'center',
                gap: '0.5rem',
                borderRadius: 'lg',
                paddingInline: '0.625rem',
                fontSize: 'calc(0.875rem * var(--type-scale))',
                lineHeight: 'calc(1.25 / 0.875)',
                outlineStyle: 'none',
              }),
              isActive ? css({ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }) : '',
            ),
            content: h.span(
              [
                h.Class(
                  css({
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                  }),
                ),
                h.Attribute('lang', choice.value),
              ],
              [
                h.span([], [choice.label]),
                h.span(
                  [h.AriaHidden(true), h.Class(isSelected ? '' : css({ visibility: 'hidden' }))],
                  [icon(h, Check, css({ width: '1rem', height: '1rem', color: 'var(--primary)' }))],
                ),
              ],
            ),
          }),
        },
      }),
    ],
  )
