import type { Editor } from '@viveeditor/core'
import type { CommandAccess } from './commands.js'
import { h } from './dom.js'
import { icon } from './icons.js'
import type { Messages } from './messages.js'
import { ariaShortcut, displayShortcut, type ToolSpec } from './tools.js'

export const toolArgs = (tool: ToolSpec): unknown[] => [...(tool.args ?? [])]

export const toolEnabled = (tool: ToolSpec, commands: CommandAccess): boolean =>
  tool.id === 'link' ||
  commands.can(tool.command, ...toolArgs(tool)) ||
  (tool.enabledQuery !== undefined && Boolean(commands.query(tool.enabledQuery)))

export function toolLabel(tool: ToolSpec, messages: Messages): string {
  return tool.shortcut
    ? `${messages[tool.label]} (${displayShortcut(tool.shortcut)})`
    : messages[tool.label]
}

export function toolVisual(tool: ToolSpec, messages: Messages): Element {
  return tool.icon
    ? icon(tool.icon)
    : h(tool.glyphTag ?? 'b', { class: 've-glyph' }, [messages[tool.glyph ?? 'glyphBold']])
}

export function createToolButton(tool: ToolSpec, messages: Messages): HTMLButtonElement {
  const label = toolLabel(tool, messages)
  const button = h(
    'button',
    { type: 'button', class: 've-btn', 'aria-label': label, title: label, 'data-tool': tool.id },
    [toolVisual(tool, messages)],
  )
  if (tool.shortcut) button.setAttribute('aria-keyshortcuts', ariaShortcut(tool.shortcut))
  if (tool.popup) {
    button.setAttribute('aria-haspopup', tool.popup)
    button.setAttribute('aria-expanded', 'false')
  } else if (tool.active) button.setAttribute('aria-pressed', 'false')
  return button
}

export function syncToolButton(
  button: HTMLButtonElement,
  tool: ToolSpec,
  editor: Editor,
  commands: CommandAccess,
): void {
  const active = tool.active ? editor.isActive(tool.active) : false
  if (tool.popup) button.classList.toggle('is-active', active)
  else if (tool.active) button.setAttribute('aria-pressed', String(active))
  button.setAttribute('aria-disabled', String(!toolEnabled(tool, commands)))
}

export function syncToolButtons(
  buttons: readonly HTMLButtonElement[],
  toolById: ReadonlyMap<string, ToolSpec>,
  editor: Editor,
  commands: CommandAccess,
): void {
  for (const button of buttons) {
    const tool = toolById.get(button.dataset.tool ?? '')
    if (tool) syncToolButton(button, tool, editor, commands)
  }
}

export function markSourceState(buttons: readonly HTMLButtonElement[], sourceOpen: boolean): void {
  for (const button of buttons) {
    if (button.dataset.tool === 'source') button.setAttribute('aria-pressed', String(sourceOpen))
    else if (sourceOpen) button.setAttribute('aria-disabled', 'true')
  }
}
