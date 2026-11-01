import { defineExtension, type Extension } from '@viveeditor/core'
import type { DOMOutputSpec, NodeSpec, Node as ProseMirrorNode, Schema } from 'prosemirror-model'
import { type Command, Plugin, TextSelection } from 'prosemirror-state'
import {
  addColumnAfter,
  addColumnBefore,
  addRow,
  addRowAfter,
  addRowBefore,
  columnResizing,
  deleteColumn,
  deleteRow,
  deleteTable,
  goToNextCell,
  isInTable,
  mergeCells,
  selectedRect,
  splitCell,
  TableMap,
  TableView,
  tableEditing,
  tableNodes,
  tableNodeTypes,
  toggleHeaderColumn,
  toggleHeaderRow,
} from 'prosemirror-tables'

export interface TableOptions {
  resizable: boolean
  cellMinWidth: number
  maxSize: number
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
  }
  interface QueryRegistry {
    inTable: () => boolean
  }
}

const FALLBACK_WIDTH = 120

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

function renderTable(node: ProseMirrorNode, cellMinWidth: number): DOMOutputSpec {
  const widths = columnWidths(node)
  if (widths.every((width) => width === null)) return ['table', ['tbody', 0]]
  const total = widths.reduce<number>((sum, width) => sum + (width ?? cellMinWidth), 0)
  const property = widths.includes(null) ? 'min-width' : 'width'
  return [
    'table',
    { style: `${property}: ${total}px` },
    ['colgroup', ...widths.map((width) => ['col', width ? { style: `width: ${width}px` } : {}])],
    ['tbody', 0],
  ]
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

function tableSpecs(cellMinWidth: number): Record<string, NodeSpec> {
  const specs = tableNodes({ tableGroup: 'block', cellContent: 'block+', cellAttributes: {} })
  return {
    table: {
      ...specs.table,
      content: 'tableRow+',
      toDOM: (node) => renderTable(node, cellMinWidth),
    },
    tableRow: { ...specs.table_row, content: '(tableCell | tableHeader)*' },
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
  }),
  queries: () => ({
    inTable: (state) => isInTable(state),
  }),
  keymap: () => ({
    Tab: (state, dispatch) => goToNextCell(1)(state, dispatch) || appendRow(state, dispatch),
    'Shift-Tab': goToNextCell(-1),
  }),
  plugins: ({ options }) => {
    let escaped = false
    const view = (node: ProseMirrorNode) => new TableView(node, options.cellMinWidth)
    return [
      options.resizable
        ? columnResizing({ cellMinWidth: options.cellMinWidth, View: TableView })
        : new Plugin({ props: { nodeViews: { table: view } } }),
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
