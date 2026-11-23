import type { Editor, FoundItem } from '@viveeditor/core'
import type { CommandAccess } from './commands.js'
import { clamp, h } from './dom.js'
import { createMenu, type Menu, type MenuItem } from './menu.js'
import type { MessageKey, Messages } from './messages.js'
import {
  canRunTableAction,
  runTableAction,
  TABLE_ACTIONS,
  TABLE_CELL_ACTIONS,
} from './table-actions.js'

export type ContextKind = 'table' | 'image' | 'link' | 'code' | 'embed' | 'math' | 'text'

export interface ContextPoint {
  x: number
  y: number
}

export interface ContextMenuOptions {
  editor: Editor
  commands: CommandAccess
  messages: Messages
  container: HTMLElement
  announce: (text: string) => void
  openPanel: (id: string) => void
  openLink: () => void
  onOpen: () => void
  returnToEditor: () => void
}

export interface ContextMenu {
  open(kind: ContextKind, target: Element | null, point: ContextPoint): void
  close(returnFocus: boolean): void
  isOpen(): boolean
}

const EDGE = 8
const OPENABLE = ['http:', 'https:', 'mailto:', 'tel:']
const TABLE_BY_ID = new Map([...TABLE_CELL_ACTIONS, ...TABLE_ACTIONS].map((a) => [a.id, a]))
const TEXT_ALIGNS: readonly [string | null, MessageKey][] = [
  [null, 'cellAlignLeft'],
  ['center', 'cellAlignCenter'],
  ['right', 'cellAlignRight'],
  ['justify', 'cellAlignJustify'],
]
const VERTICAL_ALIGNS: readonly [string | null, MessageKey][] = [
  [null, 'cellAlignTop'],
  ['middle', 'cellAlignMiddle'],
  ['bottom', 'cellAlignBottom'],
]
const IMAGE_ALIGNS: readonly [string, MessageKey][] = [
  ['left', 'alignLeft'],
  ['center', 'alignCenter'],
  ['right', 'alignRight'],
]

const text = (value: unknown): string => (typeof value === 'string' ? value : '')

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

export const isOpenableHref = (href: string): boolean => {
  if (!href) return false
  try {
    return OPENABLE.includes(new URL(href, window.location.href).protocol)
  } catch {
    return false
  }
}

function placeAt(element: HTMLElement, point: ContextPoint): void {
  const base = (element.offsetParent ?? document.documentElement).getBoundingClientRect()
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight
  element.style.maxHeight = ''
  const room = viewportHeight - EDGE * 2
  if (room > 0 && element.offsetHeight > room) element.style.maxHeight = `${Math.floor(room)}px`
  const width = element.offsetWidth
  const height = element.offsetHeight
  const left = clamp(point.x, EDGE, viewportWidth - width - EDGE)
  const top = point.y + height + EDGE > viewportHeight ? Math.max(EDGE, point.y - height) : point.y
  element.style.left = `${left - base.left}px`
  element.style.top = `${top - base.top}px`
}

export function createContextMenu(options: ContextMenuOptions): ContextMenu {
  const { editor, commands, messages, container } = options
  let current: Menu | null = null

  const readOnly = (): boolean => !editor.isEditable
  const mutating = (command: string) => (): boolean => readOnly() || !commands.has(command)

  const entry = (
    id: string,
    label: MessageKey,
    action: () => unknown,
    group: number,
    extra: Partial<MenuItem> = {},
  ): MenuItem => ({ id, label: messages[label], role: 'menuitem', group, action, ...extra })

  const fallbackCopy = (value: string): void => {
    const field = h('textarea', { class: 've-sr', readonly: '', 'aria-hidden': 'true' })
    field.value = value
    container.append(field)
    field.select()
    document.execCommand('copy')
    field.remove()
    options.returnToEditor()
  }

  const copy = async (value: string): Promise<void> => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      fallbackCopy(value)
    }
    options.announce(messages.copied)
  }

  const removeSelection = (): void => {
    const { from, to } = editor.getSelection()
    commands.run('deleteRange', from, to)
  }

  const openPanel = (id: string) => (): true => {
    options.openPanel(id)
    return true
  }

  const tableAction = (id: string, group: number): MenuItem[] => {
    const action = TABLE_BY_ID.get(id)
    if (!action) return []
    return [
      {
        id: `table-${id}`,
        label: messages[action.label],
        role: 'menuitem',
        group,
        danger: action.destructive === true,
        hidden: mutating(action.command),
        disabled: () => !canRunTableAction(commands, action),
        action: () => {
          runTableAction(commands, action)
        },
      },
    ]
  }

  const cellChoices = (
    choices: readonly [string | null, MessageKey][],
    command: string,
    key: string,
    group: number,
  ): MenuItem[] =>
    choices.map(([value, label]) => ({
      id: `cell-${key}-${value ?? 'default'}`,
      label: messages[label],
      role: 'menuitemradio',
      group,
      hidden: mutating(command),
      checked: () => (record(commands.query('cellStyle'))?.[key] ?? null) === value,
      action: () => {
        commands.run(command, value)
      },
    }))

  const tableItems = (): MenuItem[] => [
    {
      id: 'cell',
      label: messages.menuCell,
      role: 'menuitem',
      group: 0,
      items: [
        ...cellChoices(TEXT_ALIGNS, 'setCellTextAlign', 'textAlign', 0),
        ...cellChoices(VERTICAL_ALIGNS, 'setCellVerticalAlign', 'verticalAlign', 1),
        ...tableAction('mergeCells', 2),
        ...tableAction('splitCell', 2),
      ],
    },
    {
      id: 'row',
      label: messages.menuRow,
      role: 'menuitem',
      group: 0,
      items: [
        ...tableAction('rowAbove', 0),
        ...tableAction('rowBelow', 0),
        ...tableAction('deleteRow', 1),
        ...tableAction('selectRow', 2),
        ...tableAction('headerRow', 2),
      ],
    },
    {
      id: 'column',
      label: messages.menuColumn,
      role: 'menuitem',
      group: 0,
      items: [
        ...tableAction('columnLeft', 0),
        ...tableAction('columnRight', 0),
        ...tableAction('deleteColumn', 1),
        ...tableAction('selectColumn', 2),
        ...tableAction('headerColumn', 2),
        ...tableAction('distributeColumns', 2),
      ],
    },
    entry('tableProperties', 'tableProperties', openPanel('table'), 1, {
      hidden: mutating('insertTable'),
    }),
    ...tableAction('deleteTable', 2),
  ]

  const imageItems = (): MenuItem[] => {
    const image = (): Record<string, unknown> | null => record(commands.query('selectedImage'))
    return [
      entry('image-edit', 'imageEdit', openPanel('image'), 0, { hidden: mutating('insertImage') }),
      ...IMAGE_ALIGNS.map(
        ([value, label]): MenuItem => ({
          id: `image-align-${value}`,
          label: messages[label],
          role: 'menuitemradio',
          group: 1,
          hidden: mutating('setImageAttributes'),
          checked: () => image()?.align === value,
          action: () => {
            commands.run('setImageAttributes', { align: image()?.align === value ? null : value })
          },
        }),
      ),
      entry('image-copy', 'copyImageAddress', () => copy(text(image()?.src)), 2, {
        hidden: () => !text(image()?.src),
      }),
      entry('image-delete', 'deleteImage', removeSelection, 3, {
        danger: true,
        hidden: readOnly,
      }),
    ]
  }

  const linkItems = (): MenuItem[] => {
    const href = (): string => text(record(commands.query('link'))?.href)
    return [
      entry(
        'link-open',
        'openLink',
        () => {
          if (isOpenableHref(href())) window.open(href(), '_blank', 'noopener,noreferrer')
        },
        0,
        { hidden: () => !isOpenableHref(href()) },
      ),
      entry(
        'link-edit',
        'editLink',
        () => {
          options.openLink()
          return true
        },
        0,
        { hidden: mutating('setLink') },
      ),
      entry('link-copy', 'copyLinkAddress', () => copy(href()), 1, { hidden: () => !href() }),
      entry('link-remove', 'linkRemove', () => commands.run('unsetLink'), 2, {
        hidden: mutating('unsetLink'),
      }),
    ]
  }

  const codeItems = (): MenuItem[] => {
    const { from } = editor.getSelection()
    const found = commands.query('findNodes', ['codeBlock'])
    const blocks = Array.isArray(found) ? (found as FoundItem[]) : []
    const index = blocks.findIndex((block) => block.from < from && from < block.to)
    const block = blocks[index]
    if (!block) return []
    const select = editor.dom.querySelectorAll('.vive-code')[index]?.querySelector('select')
    const languages = select ? [...select.options] : []
    const language = (): string => text(commands.query('codeBlockLanguage'))
    const items: MenuItem[] = []
    if (languages.length > 0) {
      items.push({
        id: 'code-language',
        label: messages.codeLanguage,
        role: 'menuitem',
        group: 0,
        items: languages.map((option) => ({
          id: `code-language-${option.value || 'plain'}`,
          label: option.textContent ?? option.value,
          role: 'menuitemradio',
          hidden: mutating('setCodeBlockLanguage'),
          checked: () => language() === option.value,
          action: () => {
            commands.run('setCodeBlockLanguage', option.value || null)
          },
        })),
      })
    }
    items.push(
      entry('code-copy', 'copyCode', () => copy(block.text), 1),
      entry(
        'code-delete',
        'deleteCodeBlock',
        () => commands.run('deleteRange', block.from, block.to),
        2,
        {
          danger: true,
          hidden: readOnly,
        },
      ),
    )
    return items
  }

  const embedItems = (): MenuItem[] => {
    const url = (): string => text(commands.query('selectedEmbedUrl'))
    return [
      entry('embed-edit', 'editEmbed', openPanel('embed'), 0, {
        hidden: mutating('setEmbedTitle'),
      }),
      entry('embed-copy', 'copyEmbedLink', () => copy(url()), 1, { hidden: () => !url() }),
      entry('embed-delete', 'deleteObject', removeSelection, 2, { danger: true, hidden: readOnly }),
    ]
  }

  const mathItems = (target: Element | null): MenuItem[] => [
    entry(
      'math-edit',
      'editMath',
      () => {
        const node = target ?? editor.dom.querySelector('.ProseMirror-selectednode')
        if (!(node instanceof HTMLElement)) return false
        node.click()
        return true
      },
      0,
      { hidden: readOnly },
    ),
    entry('math-delete', 'deleteObject', removeSelection, 1, { danger: true, hidden: readOnly }),
  ]

  const clipboardCommand = (name: 'cut' | 'copy') => (): void => {
    editor.focus()
    document.execCommand(name)
  }

  const textItems = (): MenuItem[] => {
    const empty = (): boolean => editor.getSelection().empty
    const mark = (id: 'bold' | 'italic', command: string): MenuItem => ({
      id: `text-${id}`,
      label: messages[id],
      role: 'menuitemcheckbox',
      group: 1,
      hidden: mutating(command),
      checked: () => editor.isActive(id),
      action: () => commands.run(command),
    })
    return [
      entry('text-cut', 'cut', clipboardCommand('cut'), 0, { hidden: readOnly, disabled: empty }),
      entry('text-copy', 'copy', clipboardCommand('copy'), 0, { disabled: empty }),
      mark('bold', 'toggleBold'),
      mark('italic', 'toggleItalic'),
      entry(
        'text-link',
        'link',
        () => {
          options.openLink()
          return true
        },
        1,
        { hidden: mutating('setLink') },
      ),
      entry('text-clear', 'clearFormatting', () => commands.run('clearFormatting'), 2, {
        hidden: mutating('clearFormatting'),
      }),
    ]
  }

  const itemsFor = (kind: ContextKind, target: Element | null): MenuItem[] => {
    if (kind === 'table') return tableItems()
    if (kind === 'image') return imageItems()
    if (kind === 'link') return linkItems()
    if (kind === 'code') return codeItems()
    if (kind === 'embed') return embedItems()
    if (kind === 'math') return mathItems(target)
    return textItems()
  }

  const close = (returnFocus: boolean): void => {
    current?.close(returnFocus)
  }

  const open = (kind: ContextKind, target: Element | null, point: ContextPoint): void => {
    current?.close(false)
    container.replaceChildren()
    const menu = createMenu({
      label: messages.contextMenu,
      items: itemsFor(kind, target),
      place: (element) => placeAt(element, point),
      onOpen: options.onOpen,
      onDone: options.returnToEditor,
      onClose: (returnFocus) => {
        if (returnFocus) options.returnToEditor()
      },
    })
    menu.element.classList.add('ve-context-menu')
    menu.element.dataset.kind = kind
    container.append(menu.element)
    current = menu
    menu.open()
    if (!menu.element.querySelector('.ve-item:not([hidden])')) menu.close(false)
  }

  return { open, close, isOpen: () => current?.isOpen() ?? false }
}
