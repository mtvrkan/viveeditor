import type { Autosave, AutosaveOptions } from './autosave.js'
import type { DocumentMessages } from './doc-messages.js'
import type { FileOptions } from './file-menu.js'
import type { PanelSource } from './lazy-popover.js'
import type { ReadabilityFormula } from './measure.js'
import type { Messages } from './messages.js'
import type { UiPlugin } from './plugins.js'

export type UiTheme = 'light' | 'dark' | 'auto'

export interface UiOptions {
  locale?: string
  messages?: Partial<Messages & DocumentMessages>
  theme?: UiTheme
  readability?: ReadabilityFormula | false
  bubble?: boolean
  slash?: boolean
  source?: boolean
  files?: FileOptions | false
  plugins?: readonly UiPlugin[]
  panels?: PanelSource
  exclude?: readonly string[]
  autosave?: AutosaveOptions
  onError?: (error: unknown) => void
}

export interface EditorUI {
  readonly root: HTMLElement
  readonly toolbar: HTMLElement
  readonly autosave: Autosave | null
  refresh(): void
  destroy(): void
}
