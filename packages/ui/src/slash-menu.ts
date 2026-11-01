import type { Editor } from '@viveeditor/core'
import type { CommandAccess } from './commands.js'
import { h, placeAtRect, uniqueId } from './dom.js'
import { icon } from './icons.js'
import { format, type Messages } from './messages.js'
import type { SlashEntry } from './plugins.js'
import { BLOCKS, foldText } from './tools.js'

export interface SlashMenu {
  readonly element: HTMLElement
  update(focused: boolean): void
  handleKey(event: KeyboardEvent): boolean
  close(): void
  isOpen(): boolean
  destroy(): void
}

const TRIGGER = /^\/([\p{L}\p{N}]{0,24})$/u

export function createSlashMenu(
  editor: Editor,
  commands: CommandAccess,
  messages: Messages,
  root: HTMLElement,
  openPanel: (id: string) => void,
  extra: readonly SlashEntry[] = [],
): SlashMenu {
  const listId = uniqueId('ve-slash')
  const entries: SlashEntry[] = [
    ...BLOCKS.filter((block) => block.slash && commands.has(block.command)).map((block) => ({
      id: block.id,
      label: format(messages[block.label], block.labelValues ?? {}),
      keywords: block.keywords,
      icon: block.icon,
      hint: block.hint,
      run: () => {
        if (block.panel) openPanel(block.id)
        else {
          commands.run(block.command, ...(block.args ? [block.args] : []))
          editor.focus()
        }
      },
    })),
    ...extra,
  ]
  const list = h('div', {
    class: 've-slash-list',
    id: listId,
    role: 'listbox',
    'aria-label': messages.slashTitle,
  })
  const element = h('div', { class: 've-slash ve-glass ve-solid', hidden: '' }, [
    h('div', { class: 've-eyebrow', 'aria-hidden': 'true' }, [messages.slashTitle]),
    list,
  ])
  let visible: SlashEntry[] = []
  let active = 0
  let typed = ''
  let dismissed: string | null = null

  const optionId = (index: number): string => `${listId}-${index}`

  const render = (): void => {
    list.replaceChildren(
      ...(visible.length === 0
        ? [h('div', { class: 've-empty' }, [messages.slashEmpty])]
        : visible.map((entry, index) => {
            const option = h(
              'div',
              {
                class: 've-item',
                id: optionId(index),
                role: 'option',
                'aria-selected': String(index === active),
              },
              [
                h('span', { class: 've-item-icon' }, [
                  typeof entry.icon === 'string'
                    ? icon(entry.icon)
                    : (entry.icon?.cloneNode(true) ?? ''),
                ]),
                h('span', { class: 've-item-label' }, [entry.label]),
                h('span', { class: 've-item-hint' }, [entry.hint ?? '']),
              ],
            )
            option.addEventListener('mousedown', (event) => event.preventDefault())
            option.addEventListener('click', () => select(index))
            return option
          })),
    )
    if (visible.length > 0) {
      editor.dom.setAttribute('aria-activedescendant', optionId(active))
      list.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
    } else {
      editor.dom.removeAttribute('aria-activedescendant')
    }
  }

  const isOpen = (): boolean => !element.hidden

  const close = (): void => {
    if (!isOpen()) return
    element.hidden = true
    editor.dom.removeAttribute('aria-activedescendant')
    editor.dom.removeAttribute('aria-controls')
  }

  function select(index: number): void {
    const entry = visible[index]
    if (!entry) return
    const { from } = editor.getSelection()
    close()
    commands.run('deleteRange', from - typed.length, from)
    entry.run()
  }

  const update = (focused: boolean): void => {
    const text = focused && editor.isEditable ? editor.getTextBeforeCursor() : ''
    const match = TRIGGER.exec(text)
    if (!match || entries.length === 0) {
      dismissed = null
      close()
      return
    }
    if (dismissed === text) return
    const query = foldText(match[1] ?? '')
    const previous = typed
    typed = text
    visible = entries.filter((entry) =>
      foldText(`${entry.label} ${entry.keywords}`)
        .split(/\s+/)
        .some((word) => word.startsWith(query)),
    )
    if (previous !== text) active = 0
    active = Math.min(active, Math.max(0, visible.length - 1))
    element.hidden = false
    editor.dom.setAttribute('aria-controls', listId)
    render()
    const rect = editor.getSelectionRect()
    if (rect) placeAtRect(element, rect, root, 'caret')
  }

  const handleKey = (event: KeyboardEvent): boolean => {
    if (!isOpen()) return false
    update(true)
    if (!isOpen()) return false
    if (event.key === 'Escape') {
      dismissed = typed
      close()
      return true
    }
    if (visible.length === 0) return false
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const step = event.key === 'ArrowDown' ? 1 : -1
      active = (active + step + visible.length) % visible.length
      render()
      return true
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      select(active)
      return true
    }
    return false
  }

  return {
    element,
    update,
    handleKey,
    close,
    isOpen,
    destroy: () => {
      close()
      element.remove()
    },
  }
}
