import type { Editor } from '@viveeditor/core'
import type { CommandAccess } from './commands.js'
import type { IconName } from './icons.js'
import type { MenuItem } from './menu.js'
import type { MessageKey, Messages } from './messages.js'
import { displayShortcut } from './tools.js'

const SCRIPTS: readonly {
  mark: string
  command: string
  label: MessageKey
  shortcut: string
  glyph: string
}[] = [
  {
    mark: 'superscript',
    command: 'toggleSuperscript',
    label: 'superscript',
    shortcut: 'Mod-.',
    glyph: 'x²',
  },
  {
    mark: 'subscript',
    command: 'toggleSubscript',
    label: 'subscript',
    shortcut: 'Mod-,',
    glyph: 'x₂',
  },
]

const CASES: readonly { value: string; label: MessageKey; glyph: string }[] = [
  { value: 'upper', label: 'caseUpper', glyph: 'AB' },
  { value: 'lower', label: 'caseLower', glyph: 'ab' },
  { value: 'title', label: 'caseTitle', glyph: 'Ab' },
  { value: 'sentence', label: 'caseSentence', glyph: 'Ab.' },
]

const INDENTS: readonly { command: string; label: MessageKey; icon: IconName; shortcut: string }[] =
  [
    { command: 'indent', label: 'indent', icon: 'indent', shortcut: 'Mod-]' },
    { command: 'outdent', label: 'outdent', icon: 'outdent', shortcut: 'Mod-[' },
  ]

export function textStyleItems(
  editor: Editor,
  commands: CommandAccess,
  messages: Messages,
  locale: string,
): MenuItem[] {
  const items: MenuItem[] = []
  for (const script of SCRIPTS) {
    if (!commands.has(script.command)) continue
    items.push({
      id: script.mark,
      label: messages[script.label],
      glyph: script.glyph,
      hint: displayShortcut(script.shortcut),
      role: 'menuitemcheckbox',
      group: 1,
      checked: () => editor.isActive(script.mark),
      disabled: () => !commands.can(script.command),
      action: () => {
        commands.run(script.command)
      },
    })
  }
  if (commands.has('changeCase')) {
    for (const mode of CASES) {
      items.push({
        id: `case-${mode.value}`,
        label: messages[mode.label],
        glyph: mode.glyph,
        role: 'menuitem',
        group: 2,
        disabled: () => !commands.can('changeCase', mode.value, locale),
        action: () => {
          commands.run('changeCase', mode.value, locale)
        },
      })
    }
  }
  return items
}

export function indentItems(commands: CommandAccess, messages: Messages): MenuItem[] {
  return INDENTS.filter((spec) => commands.has(spec.command)).map((spec) => ({
    id: spec.command,
    label: messages[spec.label],
    icon: spec.icon,
    hint: displayShortcut(spec.shortcut),
    role: 'menuitem',
    group: 1,
    disabled: () => !commands.can(spec.command),
    action: () => {
      commands.run(spec.command)
    },
  }))
}
