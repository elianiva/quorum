import { Query } from '@effect/ui'
import { Effect, Schema } from 'effect'
import type { Locale } from '../i18n/locale.ts'
import { Locale as LocaleSchema } from '../i18n/locale.ts'
import { loadProse } from './content.ts'

export class GetProse extends Query.Service<GetProse>()('wiki/GetProse', {
  args: { locale: LocaleSchema, path: Schema.String },
  success: Schema.Struct({ loaded: Schema.Boolean }),
  error: Schema.Never,
  staleTime: 'Infinity',
}) {
  static readonly layer = this.toLayer(
    Effect.succeed(({ locale, path }: { locale: Locale; path: string }) =>
      Effect.promise(async () => {
        await loadProse(locale, path)
        return { loaded: true }
      }),
    ),
  )
}
