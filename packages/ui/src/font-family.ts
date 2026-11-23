import type { CommandAccess } from './commands.js'
import type { MenuItem } from './menu.js'
import type { MessageKey, Messages } from './messages.js'

const GENERIC_NAMES: Readonly<Record<string, MessageKey>> = {
  serif: 'fontSerif',
  'sans-serif': 'fontSansSerif',
  monospace: 'fontMonospace',
}

export function fontFamilyName(family: string, messages: Messages): string {
  const first = (family.split(',')[0] ?? '').trim().replace(/^'|'$/g, '')
  const generic = GENERIC_NAMES[first.toLowerCase()]
  return generic ? messages[generic] : first
}

export function configuredFontFamilies(commands: CommandAccess): readonly string[] {
  const list = commands.query('fontFamilies')
  return Array.isArray(list) ? list.filter((entry) => typeof entry === 'string') : []
}

export function currentFontFamily(commands: CommandAccess): string | null {
  const family = commands.query('fontFamily')
  return typeof family === 'string' ? family : null
}

export function fontFamilyItems(commands: CommandAccess, messages: Messages): MenuItem[] {
  const current = (): string | null => currentFontFamily(commands)
  return [
    {
      id: 'fontFamily-default',
      label: messages.fontFamilyDefault,
      role: 'menuitemradio',
      group: 1,
      checked: () => current() === null,
      disabled: () => !commands.can('unsetFontFamily'),
      action: () => {
        commands.run('unsetFontFamily')
      },
    },
    ...configuredFontFamilies(commands).map<MenuItem>((family, index) => ({
      id: `fontFamily-${index}`,
      label: fontFamilyName(family, messages),
      font: family,
      role: 'menuitemradio',
      group: 1,
      checked: () => current() === family,
      disabled: () => !commands.can('setFontFamily', family),
      action: () => {
        commands.run('setFontFamily', family)
      },
    })),
  ]
}
