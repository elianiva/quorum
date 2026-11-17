import { Menu } from '@foldkit/ui'

export type MoreItem =
  | 'exit'
  | 'playbooks'
  | 'dashboard'
  | 'help'
  | 'undo'
  | 'redo'
  | 'tidy'
  | 'fit'
  | 'fullscreen'
  | 'screenshot'

export const moreMenu = Menu.create<MoreItem>()
