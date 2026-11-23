import { createColorField } from './color-field.js'
import type { CommandAccess } from './commands.js'
import { h, moveFocus, uniqueId } from './dom.js'
import { type IconName, icon } from './icons.js'
import { format, type MessageKey, type Messages } from './messages.js'
import type { Popover } from './popover.js'
import {
  canRunTableAction,
  runTableAction,
  TABLE_ACTIONS,
  TABLE_CELL_ACTIONS,
  type TableAction,
} from './table-actions.js'

export interface TablePanelOptions {
  commands: CommandAccess
  messages: Messages
  place: (element: HTMLElement, anchor: HTMLElement) => void
  returnToEditor: () => void
  onClose: () => void
}

interface CellStyle {
  background: string | null
  verticalAlign: string | null
  textAlign: string | null
}

interface TableStyle {
  width: string | null
  align: string | null
  border: string | null
  striped: boolean
  borderColor: string | null
}

interface Choice {
  value: string | null
  label: MessageKey
  icon?: IconName
}

interface PaletteColor {
  value: string
  name: MessageKey
  tone?: 'dark'
}

const CELL_COLORS: readonly PaletteColor[] = [
  { value: '#fff2a8', name: 'colorYellow' },
  { value: '#c8f2c2', name: 'colorGreen' },
  { value: '#cde8ff', name: 'colorBlue' },
  { value: '#ffd6e7', name: 'colorPink' },
  { value: '#ffe0b2', name: 'colorOrange' },
  { value: '#e6d9ff', name: 'colorPurple' },
  { value: '#eceff1', name: 'colorGray' },
]

const BORDER_COLORS: readonly PaletteColor[] = [
  { value: '#d0d5dd', name: 'colorLightGray' },
  { value: '#98a2b3', name: 'colorGray' },
  { value: '#475467', name: 'colorDarkGray', tone: 'dark' },
  { value: '#7ea6d8', name: 'colorBlue' },
]

const TEXT_ALIGN: readonly Choice[] = [
  { value: null, label: 'cellAlignLeft', icon: 'alignLeft' },
  { value: 'center', label: 'cellAlignCenter', icon: 'alignCenter' },
  { value: 'right', label: 'cellAlignRight', icon: 'alignRight' },
  { value: 'justify', label: 'cellAlignJustify', icon: 'alignJustify' },
]

const VERTICAL: readonly Choice[] = [
  { value: null, label: 'cellAlignTop' },
  { value: 'middle', label: 'cellAlignMiddle' },
  { value: 'bottom', label: 'cellAlignBottom' },
]

const WIDTH: readonly Choice[] = [
  { value: null, label: 'tableWidthAuto' },
  { value: 'full', label: 'tableWidthFull' },
]

const TABLE_ALIGN: readonly Choice[] = [
  { value: null, label: 'cellAlignLeft', icon: 'alignLeft' },
  { value: 'center', label: 'cellAlignCenter', icon: 'alignCenter' },
]

const BORDER: readonly Choice[] = [
  { value: null, label: 'tableBorderAll' },
  { value: 'rows', label: 'tableBorderRows' },
  { value: 'none', label: 'tableBorderNone' },
]

const isCellStyle = (value: unknown): value is CellStyle =>
  typeof value === 'object' && value !== null && 'background' in value

const isTableStyle = (value: unknown): value is TableStyle =>
  typeof value === 'object' && value !== null && 'striped' in value

const COLUMNS = 6
const ROWS = 6

export function createTablePanel(options: TablePanelOptions): Popover {
  const { commands, messages } = options
  const insert = (rows: number, cols: number): void => {
    commands.run('insertTable', { rows, cols, headerRow: true })
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
    cell.addEventListener('click', () => insert(rows, cols))
    cell.addEventListener('pointerenter', () => mark(index))
    cell.addEventListener('focus', () => mark(index))
    return cell
  })
  const picker = h('div', { class: 've-table-picker' }, [
    h('div', { class: 've-table-grid' }, cells),
    size,
  ])

  const cellStyle = (): CellStyle | null => {
    const style = commands.query('cellStyle')
    return isCellStyle(style) ? style : null
  }
  const tableStyle = (): TableStyle | null => {
    const style = commands.query('tableStyle')
    return isTableStyle(style) ? style : null
  }

  const syncs: (() => void)[] = []
  const sync = (): void => {
    for (const update of syncs) update()
  }

  const apply = (command: string, args: readonly unknown[]): void => {
    commands.run(command, ...args)
    if (commands.query('inTable') !== true) {
      close(false)
      options.returnToEditor()
      return
    }
    sync()
    if (!element.contains(document.activeElement)) tabs[activeTab]?.focus()
  }

  const eyebrow = (label: MessageKey): HTMLElement =>
    h('div', { class: 've-eyebrow', 'aria-hidden': 'true' }, [messages[label]])

  const section = (label: MessageKey, ...children: HTMLElement[]): HTMLElement =>
    h('div', { class: 've-table-section' }, [eyebrow(label), ...children])

  const segmented = (
    label: MessageKey,
    choices: readonly Choice[],
    command: string,
    current: () => string | null | undefined,
    extraClass = '',
  ): HTMLElement => {
    const buttons = choices.map((choice) => {
      const name = messages[choice.label]
      const button = h(
        'button',
        {
          type: 'button',
          class: 've-segment-option',
          'aria-pressed': 'false',
          ...(choice.icon ? { 'aria-label': name, title: name } : {}),
        },
        [choice.icon ? icon(choice.icon) : name],
      )
      button.addEventListener('click', () => apply(command, [choice.value]))
      return button
    })
    syncs.push(() => {
      const value = current()
      choices.forEach((choice, index) => {
        buttons[index]?.setAttribute('aria-pressed', String(value === choice.value))
      })
    })
    return section(
      label,
      h(
        'div',
        {
          class: `ve-segment${extraClass ? ` ${extraClass}` : ''}`,
          role: 'group',
          'aria-label': messages[label],
        },
        buttons,
      ),
    )
  }

  const palette = (
    label: MessageKey,
    noneLabel: MessageKey,
    colors: readonly PaletteColor[],
    command: string,
    recentKey: string,
    current: () => string | null | undefined,
  ): HTMLElement => {
    const swatch = (color: PaletteColor | null): HTMLButtonElement => {
      const name = messages[color ? color.name : noneLabel]
      const button = h(
        'button',
        {
          type: 'button',
          class: color ? 've-swatch' : 've-swatch ve-swatch-none',
          'aria-label': name,
          title: name,
          'aria-pressed': 'false',
          ...(color?.tone ? { 'data-tone': color.tone } : {}),
        },
        [icon(color ? 'check' : 'clear')],
      )
      if (color) button.style.setProperty('--ve-swatch', color.value)
      button.addEventListener('click', () => apply(command, [color ? color.value : null]))
      syncs.push(() => {
        const value = current()
        button.setAttribute(
          'aria-pressed',
          String(value !== undefined && value === (color ? color.value : null)),
        )
      })
      return button
    }
    const field = createColorField({
      messages,
      recentKey,
      current: () => current() ?? null,
      exclude: colors.map((color) => color.value),
      apply: (color) => apply(command, [color]),
    })
    syncs.push(() => field.sync())
    return section(
      label,
      h(
        'div',
        { class: 've-swatch-grid ve-table-swatches', role: 'group', 'aria-label': messages[label] },
        [swatch(null), ...colors.map((color) => swatch(color))],
      ),
      field.element,
    )
  }

  const actionList = (actions: readonly TableAction[]): HTMLElement => {
    const children: HTMLElement[] = []
    actions.forEach((action, index) => {
      if (index > 0 && actions[index - 1]?.group !== action.group) {
        children.push(h('div', { class: 've-sep', role: 'separator' }))
      }
      const button = h(
        'button',
        {
          type: 'button',
          class: action.destructive ? 've-item ve-table-danger' : 've-item',
          'data-action': action.id,
        },
        [h('span', { class: 've-item-label' }, [messages[action.label]])],
      )
      button.addEventListener('click', () => {
        if (button.getAttribute('aria-disabled') === 'true') return
        if (action.destructive) {
          runTableAction(commands, action)
          close(false)
          options.returnToEditor()
          return
        }
        apply(action.command, action.args ?? [])
      })
      syncs.push(() =>
        button.setAttribute('aria-disabled', String(!canRunTableAction(commands, action))),
      )
      children.push(button)
    })
    return h('div', { class: 've-table-actions' }, children)
  }

  const striped = h('input', { type: 'checkbox', role: 'switch' })
  striped.addEventListener('change', () => apply('setTableStriped', [striped.checked]))
  syncs.push(() => {
    striped.checked = tableStyle()?.striped === true
  })

  const cellPanel = h('div', { class: 've-table-tabpanel ve-cell-style', role: 'tabpanel' }, [
    segmented(
      'cellTextAlign',
      TEXT_ALIGN,
      'setCellTextAlign',
      () => cellStyle()?.textAlign,
      've-cell-text-align',
    ),
    segmented(
      'cellAlign',
      VERTICAL,
      'setCellVerticalAlign',
      () => cellStyle()?.verticalAlign,
      've-cell-align',
    ),
    palette(
      'cellColor',
      'cellColorNone',
      CELL_COLORS,
      'setCellBackground',
      'cellBackground',
      () => cellStyle()?.background,
    ),
    actionList(TABLE_CELL_ACTIONS),
  ])
  const tablePanel = h('div', { class: 've-table-tabpanel ve-table-style', role: 'tabpanel' }, [
    segmented('tableWidth', WIDTH, 'setTableWidth', () => tableStyle()?.width),
    segmented('tableAlign', TABLE_ALIGN, 'setTableAlign', () => tableStyle()?.align),
    segmented('tableBorders', BORDER, 'setTableBorder', () => tableStyle()?.border),
    h('label', { class: 've-checkbox ve-table-switch' }, [
      striped,
      h('span', {}, [messages.tableStriped]),
    ]),
    palette(
      'tableBorderColor',
      'tableBorderDefault',
      BORDER_COLORS,
      'setTableBorderColor',
      'tableBorder',
      () => tableStyle()?.borderColor,
    ),
    actionList(TABLE_ACTIONS),
  ])

  const tabId = uniqueId('ve-table-tab')
  const tabPanels = [cellPanel, tablePanel]
  const tabLabels: MessageKey[] = ['tableTabCell', 'tableTabTable']
  const tabs = tabPanels.map((panel, index) => {
    panel.id = `${tabId}-panel-${index}`
    panel.setAttribute('aria-labelledby', `${tabId}-${index}`)
    const tab = h(
      'button',
      {
        type: 'button',
        class: 've-tab',
        role: 'tab',
        id: `${tabId}-${index}`,
        'aria-controls': panel.id,
      },
      [messages[tabLabels[index] ?? 'tableTabCell']],
    )
    tab.addEventListener('click', () => selectTab(index))
    return tab
  })
  const tablist = h(
    'div',
    { class: 've-tabs', role: 'tablist', 'aria-label': messages.table },
    tabs,
  )
  let activeTab = 0

  function selectTab(index: number): void {
    activeTab = index
    tabs.forEach((tab, position) => {
      const selected = position === index
      tab.setAttribute('aria-selected', String(selected))
      tab.tabIndex = selected ? 0 : -1
      const panel = tabPanels[position]
      if (panel) panel.hidden = !selected
    })
  }

  tablist.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const index = moveFocus(tabs, activeTab, event.key)
    selectTab(index)
    tabs[index]?.focus()
  })

  const editing = h('div', { class: 've-table-edit' }, [tablist, cellPanel, tablePanel])
  const title = h('div', { class: 've-eyebrow', 'aria-hidden': 'true' })
  const element = h(
    'div',
    { class: 've-panel ve-table-panel ve-glass ve-solid', role: 'dialog', hidden: '' },
    [title, picker, editing],
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
    title.hidden = inTable
    element.setAttribute('aria-label', label)
    element.dataset.mode = inTable ? 'edit' : 'insert'
    picker.hidden = inTable
    editing.hidden = !inTable
    if (inTable) {
      selectTab(0)
      sync()
    }
    element.hidden = false
    target.setAttribute('aria-expanded', 'true')
    options.place(element, target)
    if (inTable) {
      tabs[activeTab]?.focus()
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
    if (cell < 0) return
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
  })

  return { element, open, close, isOpen }
}
