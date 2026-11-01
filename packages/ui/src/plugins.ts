import type { Editor } from '@viveeditor/core'
import type { CommandAccess } from './commands.js'
import type { IconName } from './icons.js'
import type { Locale, Messages } from './messages.js'

export interface SlashEntry {
  id: string
  label: string
  keywords: string
  icon?: IconName | Node
  hint?: string
  run(): void
}

export interface UiPluginHost {
  readonly editor: Editor
  readonly commands: CommandAccess
  readonly messages: Messages
  readonly locale: Locale
  readonly root: HTMLElement
  announce(text: string): void
  report(error: unknown): void
  closeFloating(): void
}

export interface UiPluginInstance {
  slash?: readonly SlashEntry[]
  bubble?: readonly HTMLButtonElement[]
  handleKey?(event: KeyboardEvent): boolean
  update?(focused: boolean): void
  isOpen?(): boolean
  destroy?(): void
}

export type UiPlugin = (host: UiPluginHost) => UiPluginInstance

export interface PluginSet {
  slash(): SlashEntry[]
  bubble(): HTMLButtonElement[]
  isOpen(): boolean
  handleKey(event: KeyboardEvent): boolean
  update(focused: boolean): void
  destroy(): void
}

export function startPlugins(
  plugins: readonly UiPlugin[],
  host: UiPluginHost,
  report: (error: unknown) => void,
): PluginSet {
  const guard = <T>(fallback: T, run: () => T): T => {
    try {
      return run()
    } catch (error) {
      report(error)
      return fallback
    }
  }
  const instances = plugins.flatMap((plugin) => guard<UiPluginInstance[]>([], () => [plugin(host)]))
  return {
    slash: () => instances.flatMap((plugin) => plugin.slash ?? []),
    bubble: () => instances.flatMap((plugin) => plugin.bubble ?? []),
    isOpen: () => instances.some((plugin) => guard(false, () => plugin.isOpen?.() ?? false)),
    handleKey: (event) =>
      instances.some((plugin) => guard(false, () => plugin.handleKey?.(event) ?? false)),
    update: (focused) => {
      for (const plugin of instances) guard(undefined, () => plugin.update?.(focused))
    },
    destroy: () => {
      for (const plugin of instances) guard(undefined, () => plugin.destroy?.())
    },
  }
}
