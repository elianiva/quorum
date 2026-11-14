import { css, cx } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'

type Child = Html | string

/**
 * foldkit gap: upstream drives the indicator transform and the value text
 * from the Base UI Progress primitive. Here `value` (0–100) positions the
 * indicator directly; `undefined` renders an EMPTY track — animated
 * indeterminate needs primitive support. The label/value builders render
 * static content the consumer owns.
 *
 */

export const progressClass = css({
  display: 'flex',
  flexWrap: 'wrap',
  gap: '3',
})

export const progressTrackClass = css({
  backgroundColor: 'well',
  boxShadow: 'well',
  height: '1.5',
  borderRadius: 'full',
  position: 'relative',
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  overflowX: 'hidden',
})

export const progressIndicatorClass = css({
  layerStyle: 'primaryFill',
  borderRadius: 'full',
  boxShadow: 'highlightTop',
  height: '100%',
  width: '100%',
  transitionProperty: 'all',
  transitionDuration: 'fast',
  transitionTimingFunction: 'out',
})

export const progressLabelClass = css({
  fontSize: 'type.14',
  lineHeight: 'fine',
  fontWeight: 'medium',
})

export const progressValueClass = css({
  color: 'mutedForeground',
  marginLeft: 'auto',
  fontSize: 'type.14',
  lineHeight: 'fine',
  fontVariantNumeric: 'tabular-nums',
})

type StyleConfig = Readonly<{ className?: string }>

type ProgressConfig = Readonly<{
  value?: number
  className?: string
  label?: string
  trackClassName?: string
}>

const clampValue = (value: number): number => Math.min(100, Math.max(0, value))

const progressIndicator = <M>(value: number | undefined, h: HtmlBuilder<M>): Html =>
  h.div(
    [
      h.Class(progressIndicatorClass),
      h.DataAttribute('slot', 'progress-indicator'),
      // Undefined = indeterminate: empty track until primitives can animate.
      h.Style({
        transform: `translateX(-${100 - (value === undefined ? 0 : clampValue(value))}%)`,
      }),
    ],
    [],
  )

/** Styled progress bar with an accessible track. */
export const progress = <M>(config: ProgressConfig, h: HtmlBuilder<M>): Html =>
  h.div(
    [
      h.Class(cx(progressClass, config.className)),
      h.Role('progressbar'),
      h.AriaValuemin(0),
      h.AriaValuemax(100),
      ...(config.label === undefined ? [] : [h.AriaLabel(config.label)]),
      ...(config.value === undefined ? [] : [h.AriaValuenow(clampValue(config.value))]),
      h.DataAttribute('slot', 'progress'),
    ],
    [
      h.div(
        [
          h.Class(cx(progressTrackClass, config.trackClassName)),
          h.DataAttribute('slot', 'progress-track'),
        ],
        [progressIndicator(config.value, h)],
      ),
    ],
  )

/** Static label for the bar (consumer-owned text). */
export const progressLabel = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.span(
    [h.Class(cx(progressLabelClass, config.className)), h.DataAttribute('slot', 'progress-label')],
    children,
  )

/** Static value readout (consumer-owned text, e.g. "3 of 5"). */
export const progressValue = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.span(
    [h.Class(cx(progressValueClass, config.className)), h.DataAttribute('slot', 'progress-value')],
    children,
  )

export const Progress = Object.assign(progress, {
  track: <M>(config: StyleConfig, children: ReadonlyArray<Child>, h: HtmlBuilder<M>): Html =>
    h.div(
      [
        h.Class(cx(progressTrackClass, config.className)),
        h.DataAttribute('slot', 'progress-track'),
      ],
      children,
    ),
  indicator: progressIndicator,
  label: progressLabel,
  value: progressValue,
})
