import { defineExtension, type Extension, normalizeColor } from '@viveeditor/core'
import type { DOMOutputSpec, NodeSpec, Node as ProseMirrorNode, Schema } from 'prosemirror-model'
import { type Command, type EditorState, Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import {
  addColumnAfter,
  addColumnBefore,
  addRow,
  addRowAfter,
  addRowBefore,
  CellSelection,
  columnResizing,
  columnResizingPluginKey,
  deleteColumn,
  deleteRow,
  deleteTable,
  goToNextCell,
  isInTable,
  mergeCells,
  selectedRect,
  selectionCell,
  splitCell,
  TableMap,
  TableView,
  tableEditing,
  tableNodes,
  tableNodeTypes,
  toggleHeaderColumn,
  toggleHeaderRow,
} from 'prosemirror-tables'
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view'

export interface TableOptions {
  resizable: boolean
  cellMinWidth: number
  maxSize: number
}

export type CellVerticalAlign = 'middle' | 'bottom'

export type CellTextAlign = 'center' | 'right' | 'justify'

export interface CellStyle {
  background: string | null
  verticalAlign: CellVerticalAlign | null
  textAlign: CellTextAlign | null
}

export type TableWidth = 'full'

export type TableAlign = 'center'

export type TableBorder = 'rows' | 'none'

export interface TableStyle {
  width: TableWidth | null
  align: TableAlign | null
  border: TableBorder | null
  striped: boolean
  borderColor: string | null
}

export interface InsertTableOptions {
  rows?: number
  cols?: number
  headerRow?: boolean
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    insertTable: (options?: InsertTableOptions) => Command
    deleteTable: () => Command
    addRowBefore: () => Command
    addRowAfter: () => Command
    deleteRow: () => Command
    addColumnBefore: () => Command
    addColumnAfter: () => Command
    deleteColumn: () => Command
    mergeCells: () => Command
    splitCell: () => Command
    toggleHeaderRow: () => Command
    toggleHeaderColumn: () => Command
    resizeColumn: (delta: number) => Command
    setRowHeight: (height: number | null) => Command
    resizeRow: (delta: number) => Command
    setCellBackground: (color: string | null) => Command
    setCellVerticalAlign: (align: CellVerticalAlign | null) => Command
    setCellTextAlign: (align: CellTextAlign | null) => Command
    setTableWidth: (width: TableWidth | null) => Command
    setTableAlign: (align: TableAlign | null) => Command
    setTableBorder: (border: TableBorder | null) => Command
    setTableStriped: (striped: boolean) => Command
    setTableBorderColor: (color: string | null) => Command
    selectRow: () => Command
    selectColumn: () => Command
    selectTable: () => Command
    distributeColumns: () => Command
  }
  interface QueryRegistry {
    inTable: () => boolean
    cellStyle: () => CellStyle | null
    tableStyle: () => TableStyle | null
    rowHeight: () => number | null
  }
}

const FALLBACK_WIDTH = 120
const FALLBACK_HEIGHT = 32
const MIN_ROW_HEIGHT = 24
const MAX_ROW_HEIGHT = 2000
const ROW_HANDLE = 4
const COLUMN_HANDLE = 5
const PIXELS = /^(\d+(?:\.\d+)?)px$/
const VERTICAL: readonly unknown[] = ['middle', 'bottom']
const TEXT_ALIGN: readonly unknown[] = ['center', 'right', 'justify']
const BORDERS: readonly unknown[] = ['rows', 'none']
const PLAIN = new Set(['#ffffff', 'white'])
const BORDER_COLOR = '--vive-table-border-color'
const BORDER_COLOR_DECLARATION = /--vive-table-border-color\s*:\s*([^;]*)/i

function cellBackground(value: unknown): string | null {
  const color = normalizeColor(value)
  return color && !PLAIN.has(color) ? color : null
}

function cellVertical(value: unknown): CellVerticalAlign | null {
  return VERTICAL.includes(value) ? (value as CellVerticalAlign) : null
}

function cellTextAlign(value: unknown): CellTextAlign | null {
  const align = typeof value === 'string' ? value.trim().toLowerCase() : value
  return TEXT_ALIGN.includes(align) ? (align as CellTextAlign) : null
}

function rowHeightOf(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, Math.round(value)))
}

function parseRowHeight(dom: HTMLElement): number | null {
  const pixels = PIXELS.exec(dom.style.height.trim())
  return pixels ? rowHeightOf(Number(pixels[1])) : null
}

function renderRow(node: ProseMirrorNode): DOMOutputSpec {
  const height = rowHeightOf(node.attrs.height)
  return height ? ['tr', { style: `height: ${height}px` }, 0] : ['tr', 0]
}

function tableBorder(value: unknown): TableBorder | null {
  return BORDERS.includes(value) ? (value as TableBorder) : null
}

function tableStyleOf(node: ProseMirrorNode): TableStyle {
  return {
    width: node.attrs.width === 'full' ? 'full' : null,
    align: node.attrs.align === 'center' ? 'center' : null,
    border: tableBorder(node.attrs.border),
    striped: node.attrs.striped === true,
    borderColor: normalizeColor(node.attrs.borderColor),
  }
}

function addStyle(attrs: Record<string, unknown>, declaration: string): void {
  attrs.style = typeof attrs.style === 'string' ? `${attrs.style}; ${declaration}` : declaration
}

const CELL_ATTRIBUTES = {
  textAlign: {
    default: null,
    getFromDOM: (dom: HTMLElement) =>
      cellTextAlign(dom.style.textAlign || dom.getAttribute('align')),
    setDOMAttr: (value: unknown, attrs: Record<string, unknown>) => {
      const align = cellTextAlign(value)
      if (align) addStyle(attrs, `text-align: ${align}`)
    },
  },
  background: {
    default: null,
    getFromDOM: (dom: HTMLElement) => cellBackground(dom.style.backgroundColor),
    setDOMAttr: (value: unknown, attrs: Record<string, unknown>) => {
      const color = cellBackground(value)
      if (color) addStyle(attrs, `background-color: ${color}`)
    },
  },
  verticalAlign: {
    default: null,
    getFromDOM: (dom: HTMLElement) =>
      cellVertical(dom.style.verticalAlign || dom.getAttribute('valign')),
    setDOMAttr: (value: unknown, attrs: Record<string, unknown>) => {
      const align = cellVertical(value)
      if (align) addStyle(attrs, `vertical-align: ${align}`)
    },
  },
}

function setCellStyle(name: keyof CellStyle, value: string | null): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) return false
    const cells: Array<{ node: ProseMirrorNode; position: number }> = []
    const { selection } = state
    if (selection instanceof CellSelection) {
      selection.forEachCell((node, position) => {
        cells.push({ node, position })
      })
    } else {
      const $cell = selectionCell(state)
      if ($cell.nodeAfter) cells.push({ node: $cell.nodeAfter, position: $cell.pos })
    }
    const changed = cells.filter(({ node }) => node.attrs[name] !== value)
    if (changed.length === 0) return false
    if (dispatch) {
      const transaction = state.tr
      for (const { node, position } of changed) {
        transaction.setNodeMarkup(position, undefined, { ...node.attrs, [name]: value })
      }
      dispatch(transaction)
    }
    return true
  }
}

function count(value: unknown, fallback: number, max: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
    ? Math.min(value, max)
    : fallback
}

function columnWidths(table: ProseMirrorNode): Array<number | null> {
  const widths: Array<number | null> = []
  table.firstChild?.forEach((cell) => {
    const colwidth: unknown = cell.attrs.colwidth
    for (let index = 0; index < Number(cell.attrs.colspan); index++) {
      const width = Array.isArray(colwidth) ? colwidth[index] : null
      widths.push(typeof width === 'number' && width > 0 ? Math.round(width) : null)
    }
  })
  return widths
}

function tableAttributes(style: TableStyle): Record<string, string> {
  const attrs: Record<string, string> = {}
  if (style.width) attrs['data-width'] = style.width
  if (style.align) attrs['data-align'] = style.align
  if (style.border) attrs['data-border'] = style.border
  if (style.striped) attrs['data-striped'] = 'true'
  return attrs
}

function parseTable(dom: HTMLElement): Record<string, unknown> {
  const declaration = BORDER_COLOR_DECLARATION.exec(dom.getAttribute('style') ?? '')
  return {
    width: dom.getAttribute('data-width') === 'full' ? 'full' : null,
    align: dom.getAttribute('data-align') === 'center' ? 'center' : null,
    border: tableBorder(dom.getAttribute('data-border')),
    striped: dom.getAttribute('data-striped') === 'true',
    borderColor: normalizeColor(declaration?.[1]),
  }
}

function renderTable(node: ProseMirrorNode, cellMinWidth: number): DOMOutputSpec {
  const style = tableStyleOf(node)
  const attrs: Record<string, string> = tableAttributes(style)
  const widths = columnWidths(node)
  const sized = !widths.every((width) => width === null)
  const declarations: string[] = []
  if (sized) {
    const total = widths.reduce<number>((sum, width) => sum + (width ?? cellMinWidth), 0)
    const property = widths.includes(null) || style.width === 'full' ? 'min-width' : 'width'
    declarations.push(`${property}: ${total}px`)
  }
  if (style.borderColor) declarations.push(`${BORDER_COLOR}: ${style.borderColor}`)
  if (declarations.length > 0) attrs.style = declarations.join('; ')
  if (!sized) return ['table', attrs, ['tbody', 0]]
  return [
    'table',
    attrs,
    ['colgroup', ...widths.map((width) => ['col', width ? { style: `width: ${width}px` } : {}])],
    ['tbody', 0],
  ]
}

function syncTable(table: HTMLTableElement, node: ProseMirrorNode): void {
  const style = tableStyleOf(node)
  const attrs = tableAttributes(style)
  for (const name of ['data-width', 'data-align', 'data-border', 'data-striped']) {
    const value = attrs[name]
    if (value === undefined) table.removeAttribute(name)
    else if (table.getAttribute(name) !== value) table.setAttribute(name, value)
  }
  if (style.borderColor) table.style.setProperty(BORDER_COLOR, style.borderColor)
  else table.style.removeProperty(BORDER_COLOR)
  if (style.width === 'full' && table.style.width) {
    table.style.minWidth = table.style.width
    table.style.width = ''
  }
}

class StyledTableView extends TableView {
  constructor(node: ProseMirrorNode, cellMinWidth: number) {
    super(node, cellMinWidth)
    syncTable(this.table, node)
  }

  override update(node: ProseMirrorNode): boolean {
    if (!super.update(node)) return false
    syncTable(this.table, this.node)
    return true
  }
}

function tablePosition(state: EditorState): number | null {
  if (!isInTable(state)) return null
  return selectedRect(state).tableStart - 1
}

function setTableAttr(name: keyof TableStyle, value: unknown): Command {
  return (state, dispatch) => {
    const position = tablePosition(state)
    const table = position === null ? null : state.doc.nodeAt(position)
    if (position === null || !table) return false
    if (dispatch) {
      dispatch(state.tr.setNodeMarkup(position, undefined, { ...table.attrs, [name]: value }))
    }
    return true
  }
}

function selectCells(kind: 'row' | 'column' | 'table'): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) return false
    if (dispatch) {
      const { selection } = state
      const $anchor =
        selection instanceof CellSelection ? selection.$anchorCell : selectionCell(state)
      const $head = selection instanceof CellSelection ? selection.$headCell : $anchor
      let next: CellSelection
      if (kind === 'row') next = CellSelection.rowSelection($anchor, $head)
      else if (kind === 'column') next = CellSelection.colSelection($anchor, $head)
      else {
        const { map, tableStart } = selectedRect(state)
        const first = map.map[0] ?? 0
        const last = map.map[map.map.length - 1] ?? first
        next = CellSelection.create(state.doc, tableStart + first, tableStart + last)
      }
      dispatch(state.tr.setSelection(next))
    }
    return true
  }
}

function distributeColumns(cellMinWidth: number): Command {
  return (state, dispatch) => {
    if (!isInTable(state)) return false
    const { map, table, tableStart } = selectedRect(state)
    const widths = columnWidths(table)
    if (widths.every((width) => width === null)) return false
    if (dispatch) {
      const total = widths.reduce<number>((sum, width) => sum + (width ?? cellMinWidth), 0)
      const base = Math.floor(total / map.width)
      const extra = total - base * map.width
      const equal = Array.from({ length: map.width }, (_column, index) =>
        index < extra ? base + 1 : base,
      )
      const transaction = state.tr
      for (const position of new Set(map.map)) {
        const cell = table.nodeAt(position)
        if (!cell) continue
        const { left, right } = map.findCell(position)
        transaction.setNodeMarkup(tableStart + position, undefined, {
          ...cell.attrs,
          colwidth: equal.slice(left, right),
        })
      }
      dispatch(transaction)
    }
    return true
  }
}

function createTable(schema: Schema, rows: number, cols: number, headerRow: boolean) {
  const types = tableNodeTypes(schema)
  const cell = (header: boolean): ProseMirrorNode => {
    const node = (header ? types.header_cell : types.cell).createAndFill()
    if (!node) throw new Error('Table cells must accept an empty paragraph.')
    return node
  }
  const rowNodes = Array.from({ length: rows }, (_row, index) =>
    types.row.create(
      null,
      Array.from({ length: cols }, () => cell(headerRow && index === 0)),
    ),
  )
  return types.table.create(null, rowNodes)
}

function insertTable(schema: Schema, options: InsertTableOptions, max: number): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    if (isInTable(state) || $from.depth === 0) return false
    if (!$from.parent.isTextblock || $from.parent.type.spec.code) return false
    const container = $from.node(-1)
    const index = $from.index(-1)
    const tableType = tableNodeTypes(schema).table
    const replace =
      $from.parent.content.size === 0 && container.canReplaceWith(index, index + 1, tableType)
    if (!replace && !container.canReplaceWith(index + 1, index + 1, tableType)) return false
    if (dispatch) {
      const table = createTable(
        schema,
        count(options.rows, 3, max),
        count(options.cols, 3, max),
        options.headerRow ?? true,
      )
      const nodes = [table]
      const paragraph = schema.nodes.paragraph
      if (index + 1 === container.childCount && paragraph) nodes.push(paragraph.create())
      const from = replace ? $from.before() : $from.after()
      const transaction = state.tr.replaceWith(from, replace ? $from.after() : from, nodes)
      transaction.setSelection(TextSelection.create(transaction.doc, from + 4))
      dispatch(transaction.scrollIntoView())
    }
    return true
  }
}

const appendRow: Command = (state, dispatch) => {
  if (!isInTable(state)) return false
  if (dispatch) {
    const rect = selectedRect(state)
    const transaction = addRow(state.tr, rect, rect.map.height)
    const table = transaction.doc.nodeAt(rect.tableStart - 1)
    if (!table) return false
    const map = TableMap.get(table)
    const first = map.map[(map.height - 1) * map.width] ?? 0
    transaction.setSelection(
      TextSelection.near(transaction.doc.resolve(rect.tableStart + first + 1)),
    )
    dispatch(transaction.scrollIntoView())
  }
  return true
}

function resizeColumn(delta: number, cellMinWidth: number): Command {
  return (state, dispatch, view) => {
    if (!isInTable(state) || !Number.isFinite(delta) || delta === 0) return false
    if (!dispatch) return true
    const { map, table, tableStart, left } = selectedRect(state)
    const cells = new Set<number>()
    for (let row = 0; row < map.height; row++) {
      const position = map.map[row * map.width + left]
      if (position !== undefined) cells.add(position)
    }
    const known = [...cells]
      .map((position) => {
        const cell = table.nodeAt(position)
        const colwidth: unknown = cell?.attrs.colwidth
        return Array.isArray(colwidth) ? colwidth[left - map.colCount(position)] : null
      })
      .find((width): width is number => typeof width === 'number' && width > 0)
    const first = [...cells][0]
    const dom = first === undefined ? null : view?.nodeDOM(tableStart + first)
    const measured = dom instanceof HTMLElement ? dom.offsetWidth : 0
    const width = Math.max(
      cellMinWidth,
      Math.round((known ?? (measured || FALLBACK_WIDTH)) + delta),
    )
    const transaction = state.tr
    for (const position of cells) {
      const cell = table.nodeAt(position)
      if (!cell) continue
      const colspan = Number(cell.attrs.colspan)
      const colwidth: unknown = cell.attrs.colwidth
      const widths: number[] = Array.isArray(colwidth)
        ? colwidth.map((value) => (typeof value === 'number' ? value : 0))
        : Array.from({ length: colspan }, () => 0)
      widths[left - map.colCount(position)] = width
      transaction.setNodeMarkup(tableStart + position, undefined, {
        ...cell.attrs,
        colwidth: widths,
      })
    }
    dispatch(transaction)
    return true
  }
}

interface SelectedRow {
  node: ProseMirrorNode
  position: number
}

function selectedRows(state: EditorState): SelectedRow[] {
  if (!isInTable(state)) return []
  const { table, tableStart, top, bottom } = selectedRect(state)
  const rows: SelectedRow[] = []
  table.forEach((node, offset, index) => {
    if (index >= top && index < bottom) rows.push({ node, position: tableStart + offset })
  })
  return rows
}

function setRowHeight(height: number | null): Command {
  return (state, dispatch) => {
    const changed = selectedRows(state).filter(({ node }) => node.attrs.height !== height)
    if (changed.length === 0) return false
    if (dispatch) {
      const transaction = state.tr
      for (const { node, position } of changed) {
        transaction.setNodeMarkup(position, undefined, { ...node.attrs, height })
      }
      dispatch(transaction)
    }
    return true
  }
}

function resizeRow(delta: number): Command {
  return (state, dispatch, view) => {
    const rows = selectedRows(state)
    const first = rows[0]
    if (!first || !Number.isFinite(delta) || delta === 0) return false
    if (!dispatch) return true
    const known = rows
      .map(({ node }) => rowHeightOf(node.attrs.height))
      .find((height): height is number => height !== null)
    const dom = view?.nodeDOM(first.position)
    const measured = dom instanceof HTMLElement ? dom.offsetHeight : 0
    const base = Math.max(known ?? 0, measured || FALLBACK_HEIGHT)
    const height = rowHeightOf(Math.max(MIN_ROW_HEIGHT, base + delta))
    return setRowHeight(height)(state, dispatch)
  }
}

function rowHeight(state: EditorState): number | null {
  const heights = selectedRows(state).map(({ node }) => rowHeightOf(node.attrs.height))
  const first = heights[0] ?? null
  return heights.every((height) => height === first) ? first : null
}

interface RowDrag {
  startY: number
  startHeight: number
  height: number
  moved: boolean
}

interface RowResizeState {
  row: number
  drag: RowDrag | null
}

const rowResizingKey = new PluginKey<RowResizeState>('tableRowResizing')
const IDLE: RowResizeState = { row: -1, drag: null }

function rowAt(state: EditorState, position: number): ProseMirrorNode | null {
  if (position < 0) return null
  const node = state.doc.nodeAt(position)
  return node?.type.spec.tableRole === 'row' ? node : null
}

function rowAtPointer(view: EditorView, event: MouseEvent): number {
  const target = event.target instanceof Element ? event.target.closest('td, th') : null
  if (!(target instanceof HTMLElement) || !view.dom.contains(target)) return -1
  const box = target.getBoundingClientRect()
  if (event.clientX - box.left <= COLUMN_HANDLE || box.right - event.clientX <= COLUMN_HANDLE) {
    return -1
  }
  const below = box.bottom - event.clientY <= ROW_HANDLE
  if (!below && event.clientY - box.top > ROW_HANDLE) return -1
  const $inside = view.state.doc.resolve(view.posAtDOM(target, 0))
  let depth = $inside.depth
  while (depth > 0 && !String($inside.node(depth).type.spec.tableRole).endsWith('cell')) depth--
  if (depth < 2) return -1
  const table = $inside.node(depth - 2)
  const tableStart = $inside.start(depth - 2)
  const rect = TableMap.get(table).findCell($inside.before(depth) - tableStart)
  const index = below ? rect.bottom - 1 : rect.top - 1
  if (index < 0) return -1
  let position = tableStart
  for (let row = 0; row < index; row++) position += table.child(row).nodeSize
  return position
}

function rowDecorations(state: EditorState): DecorationSet {
  const resize = rowResizingKey.getState(state) ?? IDLE
  const row = rowAt(state, resize.row)
  if (!row) return DecorationSet.empty
  const $row = state.doc.resolve(resize.row)
  const table = $row.parent
  const tableStart = $row.start()
  const index = $row.index()
  const map = TableMap.get(table)
  const edge = index === map.height - 1 ? ' row-resize-edge' : ''
  const decorations: Decoration[] = []
  for (const position of new Set(map.map.slice(index * map.width, (index + 1) * map.width))) {
    const cell = table.nodeAt(position)
    if (!cell || map.findCell(position).bottom !== index + 1) continue
    const from = tableStart + position
    decorations.push(
      Decoration.node(from, from + cell.nodeSize, { class: `row-resize-handle${edge}` }),
    )
  }
  if (resize.drag?.moved) {
    decorations.push(
      Decoration.node(resize.row, resize.row + row.nodeSize, {
        class: 'row-resizing',
        style: `--vive-row-height: ${resize.drag.height}px`,
      }),
    )
  }
  return DecorationSet.create(state.doc, decorations)
}

function rowResizing(): Plugin<RowResizeState> {
  let stop: (() => void) | null = null
  const current = (view: EditorView): RowResizeState => rowResizingKey.getState(view.state) ?? IDLE
  const update = (view: EditorView, next: Partial<RowResizeState>): void => {
    view.dispatch(view.state.tr.setMeta(rowResizingKey, { ...current(view), ...next }))
  }
  const startDrag = (view: EditorView, event: MouseEvent, row: number): boolean => {
    const dom = view.nodeDOM(row)
    if (!(dom instanceof HTMLElement)) return false
    const startHeight = dom.getBoundingClientRect().height
    update(view, {
      drag: { startY: event.clientY, startHeight, height: Math.round(startHeight), moved: false },
    })
    const owner = dom.ownerDocument.defaultView ?? window
    const finish = (): void => {
      stop?.()
      const { row: position, drag } = current(view)
      const transaction = view.state.tr.setMeta(rowResizingKey, { row: position, drag: null })
      const node = rowAt(view.state, position)
      if (drag?.moved && node) {
        transaction.setNodeMarkup(position, undefined, {
          ...node.attrs,
          height: rowHeightOf(drag.height),
        })
      }
      view.dispatch(transaction)
    }
    const move = (moveEvent: MouseEvent): void => {
      if (moveEvent.buttons === 0) {
        finish()
        return
      }
      const drag = current(view).drag
      if (!drag) return
      const height = rowHeightOf(drag.startHeight + moveEvent.clientY - drag.startY)
      if (height === null || (height === drag.height && drag.moved)) return
      update(view, { drag: { ...drag, height, moved: true } })
    }
    owner.addEventListener('mousemove', move)
    owner.addEventListener('mouseup', finish)
    stop = () => {
      owner.removeEventListener('mousemove', move)
      owner.removeEventListener('mouseup', finish)
      stop = null
    }
    event.preventDefault()
    return true
  }
  return new Plugin<RowResizeState>({
    key: rowResizingKey,
    state: {
      init: () => IDLE,
      apply: (transaction, previous) => {
        const meta: RowResizeState | undefined = transaction.getMeta(rowResizingKey)
        if (meta) return meta
        if (previous.row < 0 || !transaction.docChanged) return previous
        const mapped = transaction.mapping.mapResult(previous.row, 1)
        return mapped.deleted ? IDLE : { ...previous, row: mapped.pos }
      },
    },
    view: () => ({ destroy: () => stop?.() }),
    props: {
      attributes: (state): Record<string, string> =>
        (rowResizingKey.getState(state)?.row ?? -1) >= 0 ? { class: 'row-resize-cursor' } : {},
      decorations: rowDecorations,
      handleDOMEvents: {
        mousemove: (view, event) => {
          const resize = current(view)
          if (resize.drag) return false
          const column = columnResizingPluginKey.getState(view.state)
          const blocked =
            !view.editable || (column && (column.activeHandle > -1 || column.dragging))
          const row = blocked ? -1 : rowAtPointer(view, event)
          if (row !== resize.row) update(view, { row })
          return false
        },
        mouseleave: (view) => {
          const resize = current(view)
          if (resize.row >= 0 && !resize.drag) update(view, { row: -1 })
          return false
        },
        mousedown: (view, event) => {
          const { row, drag } = current(view)
          if (row < 0 || drag || !view.editable || event.button !== 0) return false
          return startDrag(view, event, row)
        },
        dblclick: (view, event) => {
          const { row } = current(view)
          const node = rowAt(view.state, row)
          if (!node || !view.editable) return false
          event.preventDefault()
          if (node.attrs.height !== null) {
            view.dispatch(
              view.state.tr.setNodeMarkup(row, undefined, { ...node.attrs, height: null }),
            )
          }
          return true
        },
      },
    },
  })
}

function tableSpecs(cellMinWidth: number): Record<string, NodeSpec> {
  const specs = tableNodes({
    tableGroup: 'block',
    cellContent: 'block+',
    cellAttributes: CELL_ATTRIBUTES,
  })
  return {
    table: {
      ...specs.table,
      content: 'tableRow+',
      attrs: {
        width: { default: null },
        align: { default: null },
        border: { default: null },
        striped: { default: false },
        borderColor: { default: null },
      },
      parseDOM: [{ tag: 'table', getAttrs: (dom) => parseTable(dom) }],
      toDOM: (node) => renderTable(node, cellMinWidth),
    },
    tableRow: {
      ...specs.table_row,
      content: '(tableCell | tableHeader)*',
      attrs: { height: { default: null } },
      parseDOM: [{ tag: 'tr', getAttrs: (dom) => ({ height: parseRowHeight(dom) }) }],
      toDOM: renderRow,
    },
    tableCell: specs.table_cell,
    tableHeader: specs.table_header,
  }
}

export const Table: Extension<TableOptions> = defineExtension({
  name: 'table',
  priority: 90,
  defaultOptions: { resizable: true, cellMinWidth: 48, maxSize: 20 },
  nodes: (options) => tableSpecs(options.cellMinWidth),
  commands: ({ schema, options }) => ({
    insertTable: (insert?: InsertTableOptions) =>
      insertTable(schema, insert ?? {}, options.maxSize),
    deleteTable: () => deleteTable,
    addRowBefore: () => addRowBefore,
    addRowAfter: () => addRowAfter,
    deleteRow: () => deleteRow,
    addColumnBefore: () => addColumnBefore,
    addColumnAfter: () => addColumnAfter,
    deleteColumn: () => deleteColumn,
    mergeCells: () => mergeCells,
    splitCell: () => splitCell,
    toggleHeaderRow: () => toggleHeaderRow,
    toggleHeaderColumn: () => toggleHeaderColumn,
    resizeColumn: (delta: number) => resizeColumn(delta, options.cellMinWidth),
    setRowHeight: (height: number | null) =>
      height === null || rowHeightOf(height) !== null
        ? setRowHeight(rowHeightOf(height))
        : () => false,
    resizeRow: (delta: number) => resizeRow(delta),
    setCellBackground: (color: string | null) => {
      const value = cellBackground(color)
      return color !== null && value === null ? () => false : setCellStyle('background', value)
    },
    setCellVerticalAlign: (align: CellVerticalAlign | null) => {
      const value = cellVertical(align)
      return align !== null && value === null ? () => false : setCellStyle('verticalAlign', value)
    },
    setCellTextAlign: (align: CellTextAlign | null) => {
      const value = cellTextAlign(align)
      return align !== null && value === null ? () => false : setCellStyle('textAlign', value)
    },
    setTableWidth: (width: TableWidth | null) =>
      width === null || width === 'full' ? setTableAttr('width', width) : () => false,
    setTableAlign: (align: TableAlign | null) =>
      align === null || align === 'center' ? setTableAttr('align', align) : () => false,
    setTableBorder: (border: TableBorder | null) =>
      border === null || tableBorder(border) ? setTableAttr('border', border) : () => false,
    setTableStriped: (striped: boolean) =>
      typeof striped === 'boolean' ? setTableAttr('striped', striped) : () => false,
    setTableBorderColor: (color: string | null) => {
      const value = normalizeColor(color)
      return color !== null && value === null ? () => false : setTableAttr('borderColor', value)
    },
    selectRow: () => selectCells('row'),
    selectColumn: () => selectCells('column'),
    selectTable: () => selectCells('table'),
    distributeColumns: () => distributeColumns(options.cellMinWidth),
  }),
  queries: () => ({
    inTable: (state) => isInTable(state),
    cellStyle: (state) => {
      if (!isInTable(state)) return null
      const attrs = selectionCell(state).nodeAfter?.attrs
      return {
        background: cellBackground(attrs?.background),
        verticalAlign: cellVertical(attrs?.verticalAlign),
        textAlign: cellTextAlign(attrs?.textAlign),
      }
    },
    tableStyle: (state) => {
      const position = tablePosition(state)
      const table = position === null ? null : state.doc.nodeAt(position)
      return table ? tableStyleOf(table) : null
    },
    rowHeight: (state) => rowHeight(state),
  }),
  keymap: () => ({
    Tab: (state, dispatch) => goToNextCell(1)(state, dispatch) || appendRow(state, dispatch),
    'Shift-Tab': goToNextCell(-1),
  }),
  plugins: ({ options }) => {
    let escaped = false
    const view = (node: ProseMirrorNode) => new StyledTableView(node, options.cellMinWidth)
    return [
      options.resizable
        ? columnResizing({ cellMinWidth: options.cellMinWidth, View: StyledTableView })
        : new Plugin({ props: { nodeViews: { table: view } } }),
      ...(options.resizable ? [rowResizing()] : []),
      tableEditing(),
      new Plugin({
        props: {
          handleDOMEvents: {
            keydown: (editorView, event) => {
              if (event.key === 'Escape') {
                escaped = isInTable(editorView.state)
                return false
              }
              if (event.key === 'Tab' && escaped) {
                escaped = false
                return isInTable(editorView.state)
              }
              if (event.key !== 'Shift') escaped = false
              return false
            },
          },
        },
      }),
    ]
  },
})
