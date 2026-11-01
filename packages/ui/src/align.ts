import type { CommandAccess } from './commands.js'
import type { IconName } from './icons.js'
import type { MenuItem } from './menu.js'
import type { MessageKey, Messages } from './messages.js'
import { displayShortcut } from './tools.js'

interface AlignSpec {
  value: string
  label: MessageKey
  icon: IconName
  shortcut: string
}

const ALIGNMENTS: readonly AlignSpec[] = [
  { value: 'left', label: 'alignLeft', icon: 'alignLeft', shortcut: 'Mod-Shift-L' },
  { value: 'center', label: 'alignCenter', icon: 'alignCenter', shortcut: 'Mod-Shift-E' },
  { value: 'right', label: 'alignRight', icon: 'alignRight', shortcut: 'Mod-Shift-R' },
  { value: 'justify', label: 'alignJustify', icon: 'alignJustify', shortcut: 'Mod-Shift-J' },
]

export interface AlignControl {
  readonly items: MenuItem[]
  icon(): IconName
}

export function createAlignControl(commands: CommandAccess, messages: Messages): AlignControl {
  const current = (): unknown => commands.query('textAlign')
  return {
    items: ALIGNMENTS.map<MenuItem>((spec) => ({
      id: `align-${spec.value}`,
      label: messages[spec.label],
      icon: spec.icon,
      hint: displayShortcut(spec.shortcut),
      role: 'menuitemradio',
      checked: () => current() === spec.value,
      disabled: () => !commands.can('setTextAlign', spec.value),
      action: () => {
        commands.run('setTextAlign', spec.value)
      },
    })),
    icon: () => ALIGNMENTS.find((spec) => spec.value === current())?.icon ?? 'alignLeft',
  }
}
