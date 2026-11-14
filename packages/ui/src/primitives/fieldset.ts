import { css, cx } from '@quorum/styled-system/css'
import { Fieldset as FoldkitFieldset } from '@foldkit/ui'
import type { Html, HtmlBuilder } from 'foldkit/html'

type Child = Html | string

import { separatorClass } from './separator'

export const fieldsetClass = css({
  gap: '4',
  '&:has(> [data-slot=checkbox-group])': {
    gap: '3',
  },
  '&:has(> [data-slot=radio-group])': {
    gap: '3',
  },
  display: 'flex',
  flexDirection: 'column',
})

export const fieldsetLegendClass = css({
  marginBottom: '1.5',
  fontWeight: '500',
  '&[data-variant="label"]': {
    fontSize: 'calc(0.875rem * var(--type-scale))',
    lineHeight: 'calc(1.25 / 0.875)',
  },
  '&[data-variant="legend"]': {
    fontSize: 'calc(1rem * var(--type-scale))',
    lineHeight: 'calc(1.5 / 1)',
  },
})

export const fieldGroupClass = cx(
  css({
    gap: '5',
    '&[data-slot="checkbox-group"]': { gap: '3' },
    '& > [data-slot="field-group"]': { gap: '4' },
    containerType: 'inline-size',
    containerName: 'field-group',
    display: 'flex',
    width: '100%',
    flexDirection: 'column',
  }),
  'group-field-group',
)

/** Upstream cva base + per-orientation variant strings. */
export const fieldBaseClass = cx(
  css({
    '&[data-invalid="true"]': { color: 'destructive' },
    gap: '2',
    display: 'flex',
    width: '100%',
  }),
  'group-field',
)

export const fieldOrientationClasses = {
  vertical: css({
    flexDirection: 'column',
    '& > *': {
      width: '100%',
    },
  }),
  horizontal: css({
    flexDirection: 'row',
    alignItems: 'center',
    '&:has(> [data-slot="field-content"])': {
      alignItems: 'flex-start',
      '& > [role=checkbox], & > [role=radio]': {
        marginTop: '1px',
      },
    },
    '& > *': {
      '&[data-slot="field-label"]': {
        flex: '1 1 auto',
      },
    },
  }),
  responsive: css({
    flexDirection: 'column',
    '& > *': { width: '100%' },
    '@container field-group (min-width: 28rem)': {
      flexDirection: 'row',
      alignItems: 'center',
      '& > *': { width: 'auto' },
      '&:has(> [data-slot="field-content"])': {
        alignItems: 'flex-start',
        '& > [role=checkbox], & > [role=radio]': { marginTop: '1px' },
      },
      '& > *[data-slot="field-label"]': { flex: '1 1 auto' },
    },
  }),
} as const

export type FieldOrientation = keyof typeof fieldOrientationClasses

export const fieldContentClass = css({
  gap: '0.5',
  display: 'flex',
  flex: '1 1 0%',
  flexDirection: 'column',
  lineHeight: '1.375',
})

/** Upstream keys label disabling on a native peer-disabled sibling variant
 *  (no foldkit `.peer` sibling exists) and `group-data-[disabled=true]`
 *  (foldkit emits `data-disabled=""`, never "true"). Re-keyed onto the
 *  fieldset wrapper's live group + data-disabled signal. */
export const labelClass = css({
  gap: '2',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: '1',
  fontWeight: '500',
  '.group[data-disabled] &': {
    opacity: 0.5,
  },
  display: 'flex',
  alignItems: 'center',
  userSelect: 'none',
  '.group-field-set[data-disabled] &': {
    pointerEvents: 'none',
    cursor: 'not-allowed',
    opacity: 0.5,
  },
})

export const fieldLabelClass = cx(
  css({
    gap: '2',
    lineHeight: '1.375',
    '.group-field[data-disabled] &': { opacity: 0.5 },
    '&:has(> [data-slot="field"])': {
      borderRadius: 'xl',
      layerStyle: 'raised',
      boxShadow: 'raised',
      transitionProperty: 'box-shadow',
      transitionTimingFunction: 'default',
      transitionDuration: 'default',
      width: '100%',
      flexDirection: 'column',
      '&:has(:focus-visible)': {
        boxShadow:
          'var(--elev-raised), 0 0 0 3px color-mix(in oklab, var(--ring) 40%, transparent)',
      },
    },
    '&:has([data-checked])': {
      boxShadow: 'var(--elev-raised), 0 0 0 1.5px var(--primary)',
    },
    '& > [data-slot="field"]': { padding: '3' },
    display: 'flex',
    width: 'fit-content',
  }),
  'group-field-label',
)

export const fieldTitleClass = css({
  gap: '2',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  fontWeight: '500',
  '.group-field[data-disabled] &': {
    opacity: 0.5,
  },
  display: 'flex',
  width: 'fit-content',
  alignItems: 'center',
})

export const fieldDescriptionClass = css({
  color: 'mutedForeground',
  textAlign: 'left',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  '[data-variant="legend"] + &': { marginTop: '-0.375rem' },
  lineHeight: '1.5',
  fontWeight: '400',
  '.group-field:has([data-horizontal]) &': { textWrap: 'balance' },
  '&:last-child': { marginTop: '0' },
  '&:nth-last-child(2)': { marginTop: '-0.25rem' },
  '& > a': {
    textDecorationLine: 'underline',
    textUnderlineOffset: '4px',
    _hover: { color: 'primary' },
  },
})

export const fieldSeparatorClass = css({
  marginBlock: '-0.5rem',
  height: '5',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  '.group-field-group[data-variant=outline] &': {
    marginBottom: '-0.5rem',
  },
  position: 'relative',
})

export const fieldSeparatorLineClass = css({
  position: 'absolute',
  inset: '0',
  top: '50%',
})

export const fieldSeparatorContentClass = css({
  color: 'mutedForeground',
  paddingInline: '2',
  position: 'relative',
  marginInline: 'auto',
  display: 'block',
  width: 'fit-content',
  backgroundColor: 'background',
})

export const fieldErrorClass = css({
  color: 'destructive',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  fontWeight: '400',
})

type StyleConfig = Readonly<{ className?: string }>

export const fieldSet = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.fieldset(
    [h.DataAttribute('slot', 'field-set'), h.Class(cx(fieldsetClass, config.className))],
    children,
  )

/** Legend naming the fieldset. `variant` toggles legend vs label sizing. */
export const fieldLegend = <M>(
  config: StyleConfig & Readonly<{ variant?: 'legend' | 'label' }>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.legend(
    [
      h.DataAttribute('slot', 'field-legend'),
      h.DataAttribute('variant', config.variant ?? 'legend'),
      h.Class(cx(fieldsetLegendClass, config.className)),
    ],
    children,
  )

/** Groups a set of fields; provides the container context the responsive
 *  field orientation reacts to. */
export const fieldGroup = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.DataAttribute('slot', 'field-group'), h.Class(cx(fieldGroupClass, config.className))],
    children,
  )

/** A single field row: label + content + description + error. */
export const field = <M>(
  config: StyleConfig & Readonly<{ orientation?: FieldOrientation; isInvalid?: boolean }>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html => {
  const orientation = config.orientation ?? 'vertical'
  return h.div(
    [
      h.Role('group'),
      h.DataAttribute('slot', 'field'),
      h.DataAttribute('orientation', orientation),
      ...(config.isInvalid === true ? [h.DataAttribute('invalid', 'true')] : []),
      h.Class(cx(fieldBaseClass, fieldOrientationClasses[orientation], config.className)),
    ],
    children,
  )
}

/** Content column of a field (the control plus its description/error). */
export const fieldContent = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.DataAttribute('slot', 'field-content'), h.Class(cx(fieldContentClass, config.className))],
    children,
  )

export const label = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.label([h.DataAttribute('slot', 'label'), h.Class(cx(labelClass, config.className))], children)

/** Label for a field; optionally associates with its control via `for`. */
export const fieldLabel = <M>(
  config: StyleConfig & Readonly<{ for?: string }>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.label(
    [
      ...(config.for === undefined ? [] : [h.For(config.for)]),
      h.DataAttribute('slot', 'field-label'),
      h.Class(cx(labelClass, fieldLabelClass, config.className)),
    ],
    children,
  )

export const fieldTitle = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.DataAttribute('slot', 'field-label'), h.Class(cx(fieldTitleClass, config.className))],
    children,
  )

export const fieldDescription = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.p(
    [
      h.DataAttribute('slot', 'field-description'),
      h.Class(cx(fieldDescriptionClass, config.className)),
    ],
    children,
  )

/** Divider between fields, with optional centered content. */
export const fieldSeparator = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html => {
  const hasContent = children.length > 0
  return h.div(
    [
      h.DataAttribute('slot', 'field-separator'),
      h.DataAttribute('content', hasContent ? 'true' : 'false'),
      h.Class(cx(fieldSeparatorClass, config.className)),
    ],
    [
      h.div([
        h.Role('separator'),
        h.DataAttribute('horizontal', ''),
        h.Class(cx(separatorClass, fieldSeparatorLineClass)),
      ]),
      ...(hasContent
        ? [
            h.span(
              [
                h.DataAttribute('slot', 'field-separator-content'),
                h.Class(cx(fieldSeparatorContentClass)),
              ],
              children,
            ),
          ]
        : []),
    ],
  )
}

/** Field error, alerting for explicit children or a list of unique error
 *  messages. Renders nothing when there is no content. */
export const fieldError = <M>(
  config: StyleConfig &
    Readonly<{
      children?: ReadonlyArray<Child>
      errors?: ReadonlyArray<{ message?: string } | undefined>
    }>,
  h: HtmlBuilder<M>,
): Html => {
  const hasChildren = config.children !== undefined && config.children.length > 0
  const uniqueErrors =
    config.errors === undefined
      ? []
      : [...new Map(config.errors.map((error) => [error?.message, error])).values()].filter(
          (error) => error?.message !== undefined,
        )

  let content: ReadonlyArray<Child> | undefined
  if (hasChildren) {
    content = config.children
  } else if (uniqueErrors.length === 1) {
    content = [uniqueErrors[0]!.message!]
  } else if (uniqueErrors.length > 1) {
    content = [
      h.ul(
        [
          h.Class(
            css({
              marginLeft: '4',
              display: 'flex',
              listStyleType: 'disc',
              flexDirection: 'column',
              gap: '1',
            }),
          ),
        ],
        uniqueErrors.map((error) => h.li([], [error!.message!])),
      ),
    ]
  }

  if (content === undefined) {
    return h.empty
  }

  return h.div(
    [
      h.Role('alert'),
      h.DataAttribute('slot', 'field-error'),
      h.Class(cx(fieldErrorClass, config.className)),
    ],
    content,
  )
}

export type FieldsetConfig = Readonly<{
  id: string
  legend: string
  description?: string
  isDisabled?: boolean
  className?: string
  legendClass?: string
  descriptionClass?: string
  contentClass?: string
  children: ReadonlyArray<Child>
}>

/** Styled fieldset with legend, optional description and grouped fields,
 *  built on the @foldkit/ui Fieldset helper for native fieldset/legend
 *  semantics plus id / aria-describedby / disabled wiring. */
export const fieldset = <M>(config: FieldsetConfig, h: HtmlBuilder<M>): Html =>
  FoldkitFieldset.view<M>(
    {
      id: config.id,
      ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
      toView: (attributes) =>
        h.fieldset(
          [
            ...attributes.fieldset,
            h.DataAttribute('slot', 'field-set'),
            h.Class(cx(fieldsetClass, config.className)),
          ],
          [
            h.legend(
              [
                ...attributes.legend,
                h.DataAttribute('slot', 'field-legend'),
                h.DataAttribute('variant', 'legend'),
                h.Class(cx(fieldsetLegendClass, config.legendClass)),
              ],
              [config.legend],
            ),
            config.description === undefined
              ? h.empty
              : h.p(
                  [
                    ...attributes.description,
                    h.DataAttribute('slot', 'field-description'),
                    h.Class(cx(fieldDescriptionClass, config.descriptionClass)),
                  ],
                  [config.description],
                ),
            h.div(
              [
                h.DataAttribute('slot', 'field-group'),
                h.Class(cx(fieldGroupClass, config.contentClass)),
              ],
              config.children,
            ),
          ],
        ),
    },
    h,
  )
