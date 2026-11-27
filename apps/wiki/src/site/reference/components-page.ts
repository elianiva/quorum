import type { Page } from '../page.ts'
import { page } from './shared.ts'
import type { Lang } from './shared.ts'

export type PageFields<Msg> = Partial<Page<Msg>> &
  Pick<Page<Msg>, 'kind' | 'path' | 'title' | 'summary'>

/**
 * `shared`'s `page` fills in the defaults for a page drawn without Markdown, but its
 * return type carries no message type. A generated reference page does carry the site's
 * messages, so build it through this typed door.
 */
export const pageOf = <Msg>(l: Lang, fields: PageFields<Msg>): Page<Msg> =>
  page(l, fields as never) as unknown as Page<Msg>
