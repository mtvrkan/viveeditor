import type { CommandAccess } from './commands.js'
import { h, moveFocus } from './dom.js'
import { format, type MessageKey, type Messages } from './messages.js'
import type { Popover } from './popover.js'

export interface TablePanelOptions {
  commands: CommandAccess
  messages: Messages
  place: (element: HTMLElement, anchor: HTMLElement) => void
  returnToEditor: () => void
  onClose: () => void
}

interface TableAction {
  label: MessageKey
  command: string
  args?: readonly unknown[]
}

const COLUMNS = 6
const ROWS = 6
const RESIZE_STEP = 40

const ACTIONS: readonly (readonly TableAction[])[] = [
  [
    { label: 'rowAbove', command: 'addRowBefore' },
    { label: 'rowBelow', command: 'addRowAfter' },
    { label: 'columnLeft', command: 'addColumnBefore' },
    { label: 'columnRight', command: 'addColumnAfter' },
  ],
  [
    { label: 'mergeCells', command: 'mergeCells' },
    { label: 'splitCell', command: 'splitCell' },
    { label: 'headerRow', command: 'toggleHeaderRow' },
    { label: 'widenColumn', command: 'resizeColumn', args: [RESIZE_STEP] },
    { label: 'narrowColumn', command: 'resizeColumn', args: [-RESIZE_STEP] },
  ],
  [
    { label: 'deleteRow', command: 'deleteRow' },
    { label: 'deleteColumn', command: 'deleteColumn' },
    { label: 'deleteTable', command: 'deleteTable' },
  ],
]

export function createTablePanel(options: TablePanelOptions): Popover {
  const { commands, messages } = options
  const run = (command: string, args: readonly unknown[]): void => {
    commands.run(command, ...args)
    close(false)
    options.returnToEditor()
  }

  const size = h('div', { class: 've-table-size', 'aria-hidden': 'true' })
  const cells = Array.from({ length: ROWS * COLUMNS }, (_cell, index) => {
    const rows = Math.floor(index / COLUMNS) + 1
    const cols = (index % COLUMNS) + 1
    const cell = h('button', {
      type: 'button',
      class: 've-cell',
      tabindex: '-1',
      'aria-label': format(messages.tableSize, { rows, cols }),
    })
    cell.addEventListener('click', () => run('insertTable', [{ rows, cols, headerRow: true }]))
    cell.addEventListener('pointerenter', () => mark(index))
    cell.addEventListener('focus', () => mark(index))
    return cell
  })
  const picker = h('div', { class: 've-table-picker' }, [
    h('div', { class: 've-table-grid' }, cells),
    size,
  ])

  const actions = ACTIONS.flat().map((action) => {
    const button = h('button', { type: 'button', class: 've-item', tabindex: '-1' }, [
      h('span', { class: 've-item-label' }, [messages[action.label]]),
    ])
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') !== 'true') run(action.command, action.args ?? [])
    })
    return { action, button }
  })
  const list = h(
    'div',
    { class: 've-table-actions' },
    ACTIONS.flatMap((group, index) => [
      index > 0 ? h('div', { class: 've-sep', role: 'separator' }) : null,
      ...actions.filter((entry) => group.includes(entry.action)).map((entry) => entry.button),
    ]),
  )

  const title = h('div', { class: 've-eyebrow', 'aria-hidden': 'true' })
  const element = h(
    'div',
    { class: 've-panel ve-table-panel ve-glass ve-solid', role: 'dialog', hidden: '' },
    [title, picker, list],
  )
  let anchor: HTMLElement | null = null

  function mark(index: number): void {
    const rows = Math.floor(index / COLUMNS)
    const cols = index % COLUMNS
    cells.forEach((cell, position) => {
      const on = Math.floor(position / COLUMNS) <= rows && position % COLUMNS <= cols
      cell.classList.toggle('is-on', on)
      cell.tabIndex = position === index ? 0 : -1
    })
    size.textContent = `${rows + 1} × ${cols + 1}`
  }

  const isOpen = (): boolean => !element.hidden

  function close(returnFocus: boolean): void {
    if (!isOpen()) return
    element.hidden = true
    anchor?.setAttribute('aria-expanded', 'false')
    options.onClose()
    if (returnFocus) anchor?.focus()
  }

  const open = (target: HTMLElement): void => {
    anchor = target
    const inTable = commands.query('inTable') === true
    const label = inTable ? messages.table : messages.tableInsert
    title.textContent = label
    element.setAttribute('aria-label', label)
    picker.hidden = inTable
    list.hidden = !inTable
    for (const { action, button } of actions) {
      button.setAttribute(
        'aria-disabled',
        String(!commands.can(action.command, ...(action.args ?? []))),
      )
    }
    element.hidden = false
    target.setAttribute('aria-expanded', 'true')
    options.place(element, target)
    if (inTable) {
      actions.find(({ button }) => button.getAttribute('aria-disabled') === 'false')?.button.focus()
    } else {
      mark(0)
      cells[0]?.focus()
    }
  }

  element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
      return
    }
    const cell = cells.indexOf(document.activeElement as HTMLButtonElement)
    if (cell >= 0) {
      const steps: Record<string, number> = {
        ArrowRight: 1,
        ArrowLeft: -1,
        ArrowDown: COLUMNS,
        ArrowUp: -COLUMNS,
      }
      const step = steps[event.key]
      if (step === undefined) return
      event.preventDefault()
      const target = cell + step
      const wraps =
        Math.abs(step) === 1 && Math.floor(target / COLUMNS) !== Math.floor(cell / COLUMNS)
      if (!wraps && target >= 0 && target < cells.length) cells[target]?.focus()
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const buttons = actions.map((entry) => entry.button)
    buttons[
      moveFocus(buttons, buttons.indexOf(document.activeElement as HTMLButtonElement), event.key)
    ]?.focus()
  })

  return { element, open, close, isOpen }
}
