import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { STACK_LOGOS, type StackLogoId } from '@quorum/ui/game/icons'

/** The brand logo `@quorum/ui/game/bits` drew for Foldkit, drawn for Effect UI. */
export const stackLogo = <Msg>(
  id: StackLogoId,
  className: string,
  h: H<Msg>,
): View.Content<Msg> => {
  const logo = STACK_LOGOS[id]
  return h.svg
    .attr('aria-hidden', 'true')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('viewBox', '0 0 24 24')
    .class(
      cx(
        css({ flexShrink: '0' }),
        logo.color
          ? ''
          : css({
              color: 'foreground',
            }),
        className,
      ),
    )
    .children(
      h.path
        .attr('d', logo.path)
        .attr('fill', logo.color ?? 'currentColor')
        .children(),
    )
}
