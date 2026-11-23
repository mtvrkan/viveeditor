import type { FoundItem } from '@viveeditor/core'
import type { CommandAccess } from './commands.js'
import type { DocumentMessages } from './doc-messages.js'
import { h } from './dom.js'
import { format, type MessageKey, type Messages } from './messages.js'
import type { Popover } from './popover.js'
import { displayShortcut } from './shortcut.js'

export interface DocumentPanelOptions {
  commands: CommandAccess
  messages: Messages
  text: DocumentMessages
  place: (element: HTMLElement, anchor: HTMLElement) => void
  returnToEditor: () => void
  onClose: () => void
}

type TextKey = keyof DocumentMessages

export interface Issue {
  kind: TextKey
  values: Record<string, string | number>
  item: FoundItem
  select: boolean
}

const VAGUE_LINKS = new Set([
  'buraya tıklayın',
  'buraya tıkla',
  'tıklayın',
  'tıkla',
  'burada',
  'buraya',
  'bağlantı',
  'link',
  'devamı',
  'devamını oku',
  'daha fazla',
  'detaylar',
  'click here',
  'click',
  'here',
  'more',
  'read more',
  'learn more',
  'details',
  'this link',
])

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

function channel(hex: string): number {
  const value = Number.parseInt(hex, 16) / 255
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function contrastOnWhite(color: unknown): number | null {
  const match = typeof color === 'string' ? HEX.exec(color) : null
  if (!match) return null
  const [red, green, blue] = [match[1], match[2], match[3]].map((part) => channel(part ?? '0'))
  const luminance = 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0)
  return 1.05 / (luminance + 0.05)
}

const found = (commands: CommandAccess, query: string, names: readonly string[]): FoundItem[] => {
  const value = commands.query(query, names)
  return Array.isArray(value) ? (value as FoundItem[]) : []
}

const plain = (text: string): string =>
  text
    .toLocaleLowerCase('tr')
    .replace(/[\s.,:;!?…»«"'()-]+/g, ' ')
    .trim()

export function findIssues(commands: CommandAccess): Issue[] {
  const issues: Issue[] = []
  const add = (
    kind: TextKey,
    item: FoundItem,
    select: boolean,
    values: Record<string, string | number> = {},
  ): void => {
    issues.push({ kind, values, item, select })
  }
  const nodes = found(commands, 'findNodes', ['heading', 'image', 'embed', 'table', 'tableHeader'])
  const headers = nodes.filter((node) => node.name === 'tableHeader')
  let previous = 0
  for (const node of nodes) {
    if (node.name === 'heading') {
      const level = Number(node.attrs.level) || 1
      if (node.text.trim() === '') add('checkHeadingEmpty', node, false)
      else if (previous > 0 && level > previous + 1) {
        add('checkHeadingSkip', node, false, { from: previous, to: level })
      }
      previous = level
    } else if (node.name === 'image' && node.attrs.alt === null) {
      add('checkImageAlt', node, true)
    } else if (node.name === 'embed' && !node.attrs.title) {
      add('checkEmbedTitle', node, true)
    } else if (
      node.name === 'table' &&
      !headers.some((header) => header.from > node.from && header.to < node.to)
    ) {
      add('checkTableHeader', node, false)
    }
  }
  for (const mark of found(commands, 'findMarks', ['link', 'textColor'])) {
    if (mark.name === 'link') {
      const text = plain(mark.text)
      if (text === '' || VAGUE_LINKS.has(text)) add('checkLinkText', mark, true)
      continue
    }
    const ratio = contrastOnWhite(mark.attrs.color)
    if (ratio !== null && ratio < 4.5 && mark.text.trim() !== '') {
      add('checkContrast', mark, true, { ratio: (Math.floor(ratio * 10) / 10).toFixed(1) })
    }
  }
  return issues.sort((a, b) => a.item.from - b.item.from)
}

interface Shell extends Popover {
  readonly body: HTMLElement
}

function createShell(
  options: DocumentPanelOptions,
  name: string,
  label: string,
  render: () => void,
): Shell {
  const body = h('div', { class: 've-doc-body' })
  const element = h(
    'div',
    {
      class: `ve-panel ve-doc ve-${name} ve-glass ve-solid`,
      role: 'dialog',
      'aria-label': label,
      tabindex: '-1',
      hidden: '',
    },
    [h('p', { class: 've-eyebrow' }, [label]), body],
  )
  const isOpen = (): boolean => !element.hidden
  const close = (returnFocus: boolean): void => {
    if (!isOpen()) return
    element.hidden = true
    options.onClose()
    if (returnFocus) options.returnToEditor()
  }
  const open = (anchor: HTMLElement): void => {
    render()
    element.hidden = false
    options.place(element, anchor)
    const first = body.querySelector<HTMLElement>('button, [tabindex="0"]')
    ;(first ?? element).focus()
  }
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
      return
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const buttons = [...body.querySelectorAll<HTMLButtonElement>('button')]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0) return
    event.preventDefault()
    const step = event.key === 'ArrowDown' ? 1 : -1
    buttons[(index + step + buttons.length) % buttons.length]?.focus()
  })
  return { element, body, open, close, isOpen }
}

const goTo = (options: DocumentPanelOptions, item: FoundItem, select: boolean): void => {
  options.returnToEditor()
  if (select) options.commands.run('setTextSelection', item.from, item.to)
  else options.commands.run('setTextSelection', item.from + 1)
}

export function createOutlinePanel(options: DocumentPanelOptions): Popover {
  const { commands, text } = options
  const shell = createShell(options, 'outline', options.messages.outline, () => {
    const headings = found(commands, 'findNodes', ['heading'])
    if (headings.length === 0) {
      shell.body.replaceChildren(h('p', { class: 've-doc-empty' }, [text.outlineEmpty]))
      return
    }
    shell.body.replaceChildren(
      h(
        'ol',
        { class: 've-doc-list' },
        headings.map((heading) => {
          const button = h(
            'button',
            {
              type: 'button',
              class: 've-item ve-outline-item',
              'data-level': String(Number(heading.attrs.level) || 1),
            },
            [heading.text.trim() || text.outlineUntitled],
          )
          button.addEventListener('click', () => {
            shell.close(false)
            goTo(options, heading, false)
          })
          return h('li', {}, [button])
        }),
      ),
    )
  })
  return shell
}

export function createCheckPanel(options: DocumentPanelOptions): Popover {
  const { text } = options
  const summary = h('p', { class: 've-doc-summary', role: 'status' })
  const again = h('button', { type: 'button', class: 've-quiet ve-doc-again' }, [text.checkAgain])
  const render = (): void => {
    const issues = findIssues(options.commands)
    summary.textContent =
      issues.length === 0 ? text.checkNone : format(text.checkCount, { count: issues.length })
    const list = h(
      'ol',
      { class: 've-doc-list' },
      issues.map((issue) => {
        const show = h('button', { type: 'button', class: 've-quiet' }, [text.checkShow])
        show.addEventListener('click', () => {
          shell.close(false)
          goTo(options, issue.item, issue.select)
        })
        const excerpt = issue.item.text.trim().slice(0, 60)
        return h('li', { class: 've-check-item' }, [
          h('span', { class: 've-check-text' }, [
            format(text[issue.kind], issue.values),
            ...(excerpt ? [h('span', { class: 've-check-excerpt' }, [excerpt])] : []),
          ]),
          show,
        ])
      }),
    )
    shell.body.replaceChildren(summary, ...(issues.length ? [list] : []), again)
  }
  const shell = createShell(options, 'check', options.messages.accessibilityCheck, render)
  again.addEventListener('click', () => {
    render()
    again.focus()
  })
  return shell
}

interface ShortcutRow {
  keys: string
  label: MessageKey | TextKey
  command?: string
  values?: Record<string, string>
}

const SHORTCUT_GROUPS: readonly (readonly [TextKey, readonly ShortcutRow[]])[] = [
  [
    'shortcutsText',
    [
      { keys: 'Mod-B', label: 'bold', command: 'toggleBold' },
      { keys: 'Mod-I', label: 'italic', command: 'toggleItalic' },
      { keys: 'Mod-U', label: 'underline', command: 'toggleUnderline' },
      { keys: 'Mod-Shift-S', label: 'strike', command: 'toggleStrike' },
      { keys: 'Mod-E', label: 'code', command: 'toggleCode' },
      { keys: 'Mod-.', label: 'superscript', command: 'toggleSuperscript' },
      { keys: 'Mod-,', label: 'subscript', command: 'toggleSubscript' },
      { keys: 'Mod-Shift-.', label: 'shortcutBigger', command: 'stepFontSize' },
      { keys: 'Mod-Shift-,', label: 'shortcutSmaller', command: 'stepFontSize' },
      { keys: 'Shift-F3', label: 'shortcutCase', command: 'cycleCase' },
      { keys: 'Mod-Shift-H', label: 'highlight', command: 'setHighlight' },
      { keys: 'Mod-K', label: 'link', command: 'setLink' },
      { keys: 'Mod-\\', label: 'clearFormatting', command: 'clearFormatting' },
    ],
  ],
  [
    'shortcutsParagraph',
    [
      { keys: 'Mod-Alt-1', label: 'heading', command: 'toggleHeading', values: { level: '1–6' } },
      { keys: 'Mod-Shift-8', label: 'bulletList', command: 'toggleBulletList' },
      { keys: 'Mod-Shift-7', label: 'orderedList', command: 'toggleOrderedList' },
      { keys: 'Mod-Shift-9', label: 'taskList', command: 'toggleTaskList' },
      { keys: 'Mod-Shift-B', label: 'blockquote', command: 'toggleBlockquote' },
      { keys: 'Mod-Alt-C', label: 'codeBlock', command: 'toggleCodeBlock' },
      { keys: 'Mod-Shift-L', label: 'alignLeft', command: 'setTextAlign' },
      { keys: 'Mod-Shift-E', label: 'alignCenter', command: 'setTextAlign' },
      { keys: 'Mod-Shift-R', label: 'alignRight', command: 'setTextAlign' },
      { keys: 'Mod-Shift-J', label: 'alignJustify', command: 'setTextAlign' },
      { keys: 'Mod-]', label: 'indent', command: 'indent' },
      { keys: 'Mod-[', label: 'outdent', command: 'outdent' },
      { keys: 'Shift-Enter', label: 'shortcutBreak', command: 'setHardBreak' },
    ],
  ],
  [
    'shortcutsEditing',
    [
      { keys: 'Mod-Z', label: 'undo', command: 'undo' },
      { keys: 'Mod-Shift-Z', label: 'redo', command: 'redo' },
      { keys: 'Mod-F', label: 'search', command: 'setSearch' },
      { keys: 'Mod-Shift-V', label: 'pastePlain' },
      { keys: '/', label: 'shortcutSlash' },
    ],
  ],
  [
    'shortcutsMove',
    [
      { keys: 'Alt-F10', label: 'shortcutToolbar' },
      { keys: 'Esc, Tab', label: 'shortcutLeave' },
      { keys: 'Alt-0', label: 'shortcutHelp' },
    ],
  ],
]

const keysOf = (row: ShortcutRow): string => {
  if (row.keys === '/' || row.keys === 'Esc, Tab') return row.keys
  const shown = displayShortcut(row.keys)
  return row.values ? `${shown}–6` : shown
}

export function createShortcutsPanel(options: DocumentPanelOptions): Popover {
  const { commands, messages, text } = options
  const labelOf = (row: ShortcutRow): string => {
    const template =
      row.label in text ? text[row.label as TextKey] : messages[row.label as MessageKey]
    return row.values ? format(template, row.values) : template
  }
  const shell = createShell(options, 'shortcuts', messages.shortcuts, () => {
    const sections = SHORTCUT_GROUPS.flatMap(([title, rows]) => {
      const visible = rows.filter((row) => !row.command || commands.has(row.command))
      if (visible.length === 0) return []
      return [
        h('h3', { class: 've-doc-heading' }, [text[title]]),
        h(
          'dl',
          { class: 've-keys' },
          visible.flatMap((row) => [
            h('dt', {}, [labelOf(row)]),
            h('dd', {}, [h('kbd', {}, [keysOf(row)])]),
          ]),
        ),
      ]
    })
    shell.body.replaceChildren(h('div', { class: 've-keys-scroll', tabindex: '0' }, sections))
  })
  return shell
}
