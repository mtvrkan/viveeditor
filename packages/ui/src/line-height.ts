import type { CommandAccess } from './commands.js'
import type { MenuItem } from './menu.js'
import { formatDecimal, type Messages } from './messages.js'

const LINE_HEIGHTS = ['1', '1.15', '1.5', '2'] as const

export function lineHeightLabel(
  value: (typeof LINE_HEIGHTS)[number],
  messages: Messages,
  locale: string,
): string {
  const number = formatDecimal(Number(value), locale)
  if (value === '1') return `${messages.lineHeightSingle} (${number})`
  if (value === '2') return `${messages.lineHeightDouble} (${number})`
  return number
}

export function lineHeightItems(
  commands: CommandAccess,
  messages: Messages,
  locale: string,
): MenuItem[] {
  const current = (): unknown => commands.query('lineHeight')
  return [
    ...LINE_HEIGHTS.map<MenuItem>((value) => ({
      id: `lineHeight-${value}`,
      label: lineHeightLabel(value, messages, locale),
      role: 'menuitemradio',
      group: 1,
      checked: () => current() === value,
      disabled: () => !commands.can('setLineHeight', value),
      action: () => {
        commands.run('setLineHeight', value)
      },
    })),
    {
      id: 'lineHeight-default',
      label: messages.lineHeightDefault,
      role: 'menuitemradio',
      group: 2,
      checked: () => current() === null,
      disabled: () => !commands.can('setLineHeight', null),
      action: () => {
        commands.run('setLineHeight', null)
      },
    },
  ]
}
