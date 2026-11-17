import type { Messages } from '../messages.ts'
import { chrome } from './chrome.ts'
import { islands } from './islands.ts'
import { options } from './options.ts'
import { reference } from './reference.ts'

export const ja: Messages = { ...chrome, islands, options, reference }
