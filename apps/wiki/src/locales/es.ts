import { catalog } from '@quorum/ui/i18n/catalog/es'
import { CONTENT } from 'virtual:content-index-es'
import { registerContent } from '../content.ts'
import { es } from '../i18n/es/index.ts'
import { registerLocale } from '../i18n/lang.ts'

registerLocale('es', es, catalog)
registerContent('es', CONTENT)
