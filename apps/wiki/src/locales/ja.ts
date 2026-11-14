import { catalog } from '@quorum/ui/i18n/catalog/ja'
import { CONTENT } from 'virtual:content-index-ja'
import { registerContent } from '../content.ts'
import { ja } from '../i18n/ja/index.ts'
import { registerLocale } from '../i18n/lang.ts'

/* Everything Japanese, in one chunk: the interface copy, the catalog words, and the index of
   `content-ja/`. The prose itself loads with the page that needs it (src/content.ts). Importing
   the module registers the language (src/i18n/load.ts). */

registerLocale('ja', ja, catalog)
registerContent('ja', CONTENT)
