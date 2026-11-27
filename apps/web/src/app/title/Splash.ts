import { Component, Mount } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { Effect, Queue, Stream } from 'effect'
import { Locale } from '../../i18n/index.ts'
import { copyIn } from '../../i18n/messages.ts'
import * as S from '../../game/title-styles.ts'

const HIDDEN = css({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  borderWidth: '0',
})

const STAGE = css({
  height: '100dvh',
  width: '100%',
  overflow: 'hidden',
  backgroundColor: 'background',
  color: 'foreground',
  userSelect: 'none',
})

const CARD_PATHS = ['M89 11V150', 'M50 11a39 39 0 1 0 0.01 0']

const formatTime = (locale: Locale): string =>
  new Date().toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

const WallClock = Mount.makeStream(
  'WallClock',
  { args: { locale: Locale } },
  (node: HTMLElement, { locale }) =>
    Stream.callback<string>((queue) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const show = () => Queue.offerUnsafe(queue, formatTime(locale))
          show()
          return setInterval(show, 1000)
        }),
        (timer) => Effect.sync(() => clearInterval(timer)),
      ),
    ).pipe(
      Stream.tap((time) =>
        Effect.sync(() => {
          node.textContent = time
        }),
      ),
      Stream.map(() => Component.noop),
    ),
)

export type SplashProps<Msg> = Readonly<{
  clocking: boolean
  locale: Locale
  onClockIn: () => Msg
}>

/* The shift starts here: a wall badge reader with the badge hanging out of its
   slot. A click, or any key, slides the badge in, the LED turns green, and the
   reader steps back for the menu. */
export const splash = <Msg>(h: H<Msg>, props: SplashProps<Msg>) => {
  const t = copyIn(props.locale)
  return h.div.class(STAGE).children(
    h.main.class(cx('title-screen', S.ROOT)).children(
      h.div
        .key('splash')
        .class(S.SPLASH)
        .children(
          h.h1.class(HIDDEN).children('Quorum'),
          h.div.class(cx(S.READER, props.clocking && 'is-in')).children(
            h.div.class(S.READER_BODY).children(
              ...['is-tl', 'is-tr', 'is-bl', 'is-br'].map((at) =>
                h.span.class(cx(S.READER_SCREW, at)).children(),
              ),
              h.div
                .class(S.READER_SCREEN)
                .attr('aria-live', 'polite')
                .children(
                  h.span
                    .class(S.READER_TIME)
                    .onMount(WallClock({ locale: props.locale }))
                    .children('--:--'),
                  h.span
                    .class(S.READER_STATUS)
                    .children(
                      h.span.class(S.READER_STATUS_OUT).children(t.title.insertBadge),
                      h.span.class(S.READER_STATUS_IN).children(t.title.clockedIn),
                    ),
                ),
              h.span.class(S.READER_LED).children(),
              h.span.class(S.READER_SLOT).children(),
            ),
            h.div.class(S.READER_WELL).children(
              h.button
                .class(S.READER_CARD)
                .attr('type', 'button')
                .attr('aria-label', t.title.clockIn)
                .on('click', props.onClockIn)
                .children(
                  h.svg
                    .class(S.READER_CARD_MARK)
                    .attr('viewBox', '0 0 100 194')
                    .attr('aria-hidden', 'true')
                    .children(
                      ...CARD_PATHS.map((d) =>
                        h.path
                          .attr('d', d)
                          .attr('fill', 'none')
                          .attr('stroke', 'currentColor')
                          .attr('stroke-width', '22')
                          .children(),
                      ),
                      h.circle
                        .attr('fill', 'var(--signal)')
                        .attr('cx', '89')
                        .attr('cy', '180')
                        .attr('r', '14')
                        .children(),
                    ),
                  h.span.class(S.READER_CARD_CHIP).children(),
                  h.span.class(S.READER_CARD_NAME).children(t.title.founder),
                ),
            ),
          ),
          h.p.class(S.READER_HINT).attr('aria-hidden', 'true').children(t.title.clockInHint),
        ),
    ),
  )
}
