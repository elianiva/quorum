import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css } from '@quorum/styled-system/css'
import { siGithub } from 'simple-icons'

const DEFAULT = css({ width: '4', height: '4', flexShrink: '0' })

export const githubMark = <Msg>(h: H<Msg>, className: string = DEFAULT): View.Content<Msg> =>
  h.svg
    .class(className)
    .attr('aria-hidden', 'true')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('viewBox', '0 0 24 24')
    .attr('fill', 'currentColor')
    .children(h.path.attr('d', siGithub.path).children())
