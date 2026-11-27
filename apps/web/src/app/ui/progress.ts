import type { H } from '@effect/ui/html/Html'
import type { View } from '@effect/ui'
import { css, cx } from '@quorum/styled-system/css'

type Child<Msg> = View.Input<Msg>

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

const clampValue = (value: number): number => Math.min(100, Math.max(0, value))

const progressIndicator = <Msg>(h: H<Msg>, value: number | undefined): View.Content<Msg> =>
  h.div
    .class(progressIndicatorClass)
    .attr('data-slot', 'progress-indicator')
    .style({
      transform: `translateX(-${100 - (value === undefined ? 0 : clampValue(value))}%)`,
    })
    .children()

export type ProgressConfig = Readonly<{
  value?: number
  className?: string
  label?: string
  trackClassName?: string
}>

export const progress = <Msg>(h: H<Msg>, config: ProgressConfig): View.Content<Msg> =>
  h.div
    .class(cx(progressClass, config.className))
    .attr('role', 'progressbar')
    .attr('aria-valuemin', '0')
    .attr('aria-valuemax', '100')
    .attr('aria-label', config.label)
    .attr('aria-valuenow', config.value === undefined ? undefined : `${clampValue(config.value)}`)
    .attr('data-slot', 'progress')
    .children(
      h.div
        .class(cx(progressTrackClass, config.trackClassName))
        .attr('data-slot', 'progress-track')
        .children(progressIndicator(h, config.value)),
    )

export type ProgressTrackConfig = Readonly<{ className?: string }>

export const progressTrack = <Msg>(
  h: H<Msg>,
  config: ProgressTrackConfig,
  children: ReadonlyArray<Child<Msg>>,
): View.Content<Msg> =>
  h.div
    .class(cx(progressTrackClass, config.className))
    .attr('data-slot', 'progress-track')
    .children(...children)

export const progressLabel = <Msg>(
  h: H<Msg>,
  config: ProgressTrackConfig,
  children: ReadonlyArray<Child<Msg>>,
): View.Content<Msg> =>
  h.span
    .class(cx(progressLabelClass, config.className))
    .attr('data-slot', 'progress-label')
    .children(...children)

export const progressValueText = <Msg>(
  h: H<Msg>,
  config: ProgressTrackConfig,
  children: ReadonlyArray<Child<Msg>>,
): View.Content<Msg> =>
  h.span
    .class(cx(progressValueClass, config.className))
    .attr('data-slot', 'progress-value')
    .children(...children)
