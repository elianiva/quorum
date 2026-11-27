import { Mount } from '@effect/ui'
import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { Effect, Schema, Stream } from 'effect'
import { langOf, type Lang } from '../i18n/lang.ts'
import type { Locale } from '../i18n/locale.ts'

const IDS = ['place', 'wire', 'rearrange'] as const

const MountPractice = Mount.makeStream(
  'MountPractice',
  { args: { id: Schema.Literals(IDS), locale: Schema.Literals(['en', 'es', 'ja']) } },
  (node: HTMLElement, { id, locale }) =>
    Stream.callback<never>(() =>
      Effect.acquireRelease(
        Effect.promise(async () => {
          const { solverReadyForBoard } = await import('../solver.ts')
          await solverReadyForBoard()
          const { mountPractice } = await import('../components/practice-board.ts')
          return mountPractice(id, locale, node)
        }),
        (detach) => Effect.sync(detach),
      ).pipe(Effect.andThen(Effect.never)),
    ),
)

/** A practice board, mounted into the prose by its island. */
export const Practice = <Msg>(
  h: H<Msg>,
  id: (typeof IDS)[number],
  locale: Locale,
): View.Content<Msg> => {
  const l: Lang = langOf(locale)
  return h.section
    .key(`practice-${id}`)
    .attr('aria-label', l.t.islands.practice.boardLabel(l.t.islands.practice.titles[id]))
    .class(
      cx(
        css({
          marginBlock: '6',
          minHeight: '520px',
          borderRadius: 'lg',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'border',
        }),
        'not-prose',
      ),
    )
    .onMount(MountPractice({ id, locale }))
    .children()
}
