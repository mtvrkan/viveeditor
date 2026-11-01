import type { FileOptions } from './file-menu.js'
import type { PanelSource } from './lazy-popover.js'
import type { ReadabilityFormula } from './measure.js'
import type { Messages } from './messages.js'
import type { UiPlugin } from './plugins.js'

export type UiTheme = 'light' | 'dark' | 'auto'

export interface UiOptions {
  locale?: string
  messages?: Partial<Messages>
  theme?: UiTheme
  readability?: ReadabilityFormula | false
  bubble?: boolean
  slash?: boolean
  source?: boolean
  files?: FileOptions | false
  plugins?: readonly UiPlugin[]
  panels?: PanelSource
  onError?: (error: unknown) => void
}

export interface EditorUI {
  readonly root: HTMLElement
  readonly toolbar: HTMLElement
  refresh(): void
  destroy(): void
}
