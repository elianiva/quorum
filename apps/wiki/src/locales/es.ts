import { catalog } from '@quorum/ui/i18n/catalog/es'
import { CONTENT } from 'virtual:content-index-es'
import { registerContent } from '../content.ts'
import { es } from '../i18n/es/index.ts'
import { registerLocale } from '../i18n/lang.ts'

/* Everything Spanish, in one chunk: the interface copy, the catalog words, and the index of
   `content-es/`. The prose itself loads with the page that needs it (src/content.ts). Importing
   the module registers the language (src/i18n/load.ts). */

registerLocale('es', es, catalog)
registerContent('es', CONTENT)
