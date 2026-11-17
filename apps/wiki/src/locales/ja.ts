import { catalog } from '@quorum/ui/i18n/catalog/ja'
import { CONTENT } from 'virtual:content-index-ja'
import { registerContent } from '../content.ts'
import { ja } from '../i18n/ja/index.ts'
import { registerLocale } from '../i18n/lang.ts'

registerLocale('ja', ja, catalog)
registerContent('ja', CONTENT)
