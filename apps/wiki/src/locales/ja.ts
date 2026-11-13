import { catalog } from '@quorum/ui/i18n/catalog/ja'
import { registerProse, type ProseModule } from '../content.ts'
import { ja } from '../i18n/ja/index.ts'
import { registerLocale } from '../i18n/lang.ts'

/* Everything Japanese, in one chunk: the interface copy, the catalog words and the prose of
   `content-ja/`. Importing the module registers them (src/i18n/load.ts). */

registerLocale('ja', ja, catalog)
registerProse('ja', import.meta.glob<ProseModule>('../../content-ja/**/*.md', { eager: true }))
