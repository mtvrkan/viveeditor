import type { MarkdownConverter } from '@viveeditor/markdown/paste'
import type { FileOptions, PanelSource } from '@viveeditor/ui'

export interface DropInDefaults {
  files?: FileOptions
  markdown?: () => Promise<MarkdownConverter>
  panels?: PanelSource
}

let current: DropInDefaults = {}

export function setDropInDefaults(defaults: DropInDefaults): void {
  current = defaults
}

export function dropInDefaults(): DropInDefaults {
  return current
}
