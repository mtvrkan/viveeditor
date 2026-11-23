import { Editor, type EditorOptions } from '@viveeditor/core'
import { CodeBlock } from '@viveeditor/ext-code-block'
import { TextSelection } from 'prosemirror-state'
import { CellSelection, TableMap } from 'prosemirror-tables'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import { Table } from '../src/index.js'

let editors: Editor[] = []

async function mount(options: EditorOptions = {}): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, { extensions: [Table], ...options })
  editors.push(editor)
  return editor
}

const viewOf = (editor: Editor): EditorView => (editor as unknown as { view: EditorView }).view

function placeCursor(editor: Editor, position: number): void {
  const view = viewOf(editor)
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)))
}

function press(editor: Editor, key: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
  editor.dom.dispatchEvent(event)
  return event
}

function cellTexts(editor: Editor): string[] {
  const texts: string[] = []
  viewOf(editor).state.doc.descendants((node) => {
    if (node.type.spec.tableRole === 'cell' || node.type.spec.tableRole === 'header_cell') {
      texts.push(node.textContent)
      return false
    }
    return true
  })
  return texts
}

const grid =
  '<table><tbody><tr><td><p>a</p></td><td><p>b</p></td></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></tbody></table>'

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('insertTable', () => {
  it('replaces an empty paragraph with a table that has a header row and keeps a paragraph after it', async () => {
    const editor = await mount()

    editor.commands.insertTable({ rows: 2, cols: 2 })

    expect(editor.getHTML()).toBe(
      '<table><tbody><tr><th><p></p></th><th><p></p></th></tr><tr><td><p></p></td><td><p></p></td></tr></tbody></table><p></p>',
    )
    expect(editor.query.inTable()).toBe(true)
  })

  it('inserts after a paragraph that has text and clamps the size', async () => {
    const editor = await mount({ content: '<p>önce</p><p>sonra</p>' })
    placeCursor(editor, 3)

    editor.commands.insertTable({ rows: 1, cols: 99, headerRow: false })

    const blocks = editor.getJSON().content?.map((block) => block.type)
    expect(blocks).toEqual(['paragraph', 'table', 'paragraph'])
    expect(cellTexts(editor)).toHaveLength(20)
  })

  it('refuses to nest a table or break a code block', async () => {
    const editor = await mount({
      extensions: [Table, CodeBlock],
      content: `${grid}<pre><code>x</code></pre>`,
    })
    placeCursor(editor, 4)
    const inside = editor.can.insertTable()
    const end = viewOf(editor).state.doc.content.size - 1
    placeCursor(editor, end)

    expect(inside).toBe(false)
    expect(editor.can.insertTable()).toBe(false)
  })
})

describe('table HTML', () => {
  it('keeps merged cells from pasted markup', async () => {
    const editor = await mount({
      content: '<table><tr><td colspan="2">a</td></tr><tr><td>b</td><td>c</td></tr></table>',
    })

    expect(editor.getHTML()).toBe(
      '<table><tbody><tr><td colspan="2"><p>a</p></td></tr><tr><td><p>b</p></td><td><p>c</p></td></tr></tbody></table>',
    )
  })

  it('writes column widths so the table keeps its shape on any site', async () => {
    const editor = await mount({ content: grid })
    placeCursor(editor, 4)

    editor.commands.resizeColumn(40)
    const html = editor.getHTML()
    const reloaded = await mount({ content: html })

    expect(html).toMatch(
      /^<table style="min-width: 208px;?"><colgroup><col style="width: 160px;?"><col><\/colgroup>/,
    )
    expect(html).toContain('<td data-colwidth="160"><p>a</p></td>')
    expect(reloaded.getHTML()).toBe(html)
  })

  it('never narrows a column below the minimum width', async () => {
    const editor = await mount({ content: grid })
    placeCursor(editor, 4)

    editor.commands.resizeColumn(-500)

    expect(editor.getHTML()).toMatch(/<col style="width: 48px;?">/)
  })
})

describe('table editing', () => {
  it('merges a cell selection and splits it again', async () => {
    const editor = await mount({ content: grid })
    const view = viewOf(editor)
    view.dispatch(view.state.tr.setSelection(CellSelection.create(view.state.doc, 2, 7)))

    editor.commands.mergeCells()
    const merged = editor.getHTML()
    editor.commands.splitCell()

    expect(merged).toContain('<td colspan="2">')
    expect(cellTexts(editor)).toHaveLength(4)
  })

  it('adds and removes rows and columns through commands', async () => {
    const editor = await mount({ content: grid })
    placeCursor(editor, 4)

    editor.commands.addColumnAfter()
    editor.commands.addRowAfter()
    const grown = cellTexts(editor).length
    editor.commands.deleteTable()

    expect(grown).toBe(9)
    expect(editor.query.inTable()).toBe(false)
    expect(editor.getHTML()).toBe('<p></p>')
  })
})

describe('table keyboard', () => {
  it('moves to the next cell with Tab and adds a row after the last cell', async () => {
    const editor = await mount({ content: grid })
    placeCursor(editor, 4)

    press(editor, 'Tab')
    const second = viewOf(editor).state.selection.$from.parent.textContent
    placeCursor(editor, viewOf(editor).state.doc.content.size - 4)
    press(editor, 'Tab')

    expect(second).toBe('b')
    expect(cellTexts(editor)).toEqual(['a', 'b', 'c', 'd', '', ''])
    expect(editor.query.inTable()).toBe(true)
  })

  it('lets Escape then Tab leave the table so it is no keyboard trap', async () => {
    const editor = await mount({ content: grid })
    placeCursor(editor, 4)

    press(editor, 'Escape')
    const tab = press(editor, 'Tab')

    expect(tab.defaultPrevented).toBe(false)
    expect(viewOf(editor).state.selection.from).toBe(4)
  })

  it('leaves Tab to a code block inside a cell', async () => {
    const editor = await mount({
      extensions: [Table, CodeBlock],
      content: '<table><tr><td><pre><code>x</code></pre></td><td>y</td></tr></table>',
    })
    placeCursor(editor, 4)

    press(editor, 'Tab')

    expect(cellTexts(editor)).toEqual(['  x', 'y'])
  })
})

describe('cell style', () => {
  it('colours and aligns the cell at the cursor and writes it to HTML', async () => {
    const editor = await mount({ content: grid })
    placeCursor(editor, 4)
    expect(editor.commands.setCellBackground('rgb(255, 242, 168)')).toBe(true)
    expect(editor.commands.setCellVerticalAlign('middle')).toBe(true)
    expect(editor.query.cellStyle()).toEqual({
      background: '#fff2a8',
      verticalAlign: 'middle',
      textAlign: null,
    })
    expect(editor.getHTML()).toMatch(
      /<td style="background-color: (#fff2a8|rgb\(255, 242, 168\)); vertical-align: middle;?"><p>a<\/p><\/td>/,
    )
    const copy = await mount({ content: editor.getHTML() })
    expect(copy.getHTML()).toBe(editor.getHTML())
  })

  it('rejects unsafe values, clears them again and stays off outside tables', async () => {
    const editor = await mount({ content: `${grid}<p>dışarı</p>` })
    placeCursor(editor, 4)
    expect(editor.can.setCellBackground('url(x)')).toBe(false)
    expect(editor.can.setCellVerticalAlign('baseline' as 'middle')).toBe(false)
    editor.commands.setCellBackground('#cde8ff')
    editor.commands.setCellBackground(null)
    expect(editor.query.cellStyle()).toEqual({
      background: null,
      verticalAlign: null,
      textAlign: null,
    })
    placeCursor(editor, viewOf(editor).state.doc.content.size - 2)
    expect(editor.can.setCellBackground('#cde8ff')).toBe(false)
    expect(editor.query.cellStyle()).toBeNull()
  })

  it('reads Word cell shading and valign but drops plain white and top', async () => {
    const editor = await mount({
      content:
        '<table><tr><td style="background:yellow" valign="bottom">a</td><td style="background:white" valign="top">b</td></tr></table>',
    })
    const html = editor.getHTML()
    expect(html).toMatch(/<td style="background-color: yellow; vertical-align: bottom;?">/)
    expect(html).toContain('<td><p>b</p></td>')
  })
})

const hex = (part: string): string => Number(part).toString(16).padStart(2, '0')

const clean = (html: string): string =>
  html
    .replace(
      /rgb\((\d+), (\d+), (\d+)\)/g,
      (_match, red, green, blue) => `#${hex(red)}${hex(green)}${hex(blue)}`,
    )
    .replace(/;"/g, '"')

function selectCells(editor: Editor, anchor: number, head: number): void {
  const view = viewOf(editor)
  view.dispatch(view.state.tr.setSelection(CellSelection.create(view.state.doc, anchor, head)))
}

function selectedCells(editor: Editor): number[] {
  const { selection } = viewOf(editor).state
  if (!(selection instanceof CellSelection)) return []
  const cells: number[] = []
  selection.forEachCell((_node, position) => {
    cells.push(position)
  })
  return cells
}

describe('cell text alignment', () => {
  it('round trips text-align before the other cell styles', async () => {
    const html =
      '<table><tbody><tr><td style="text-align: center; background-color: #ffffff"><p>a</p></td><td style="text-align: right; background-color: #aabbcc; vertical-align: middle"><p>b</p></td><td style="text-align: justify"><p>c</p></td></tr></tbody></table>'
    const editor = await mount({ content: html })

    expect(clean(editor.getHTML())).toBe(
      '<table><tbody><tr><td style="text-align: center"><p>a</p></td><td style="text-align: right; background-color: #aabbcc; vertical-align: middle"><p>b</p></td><td style="text-align: justify"><p>c</p></td></tr></tbody></table>',
    )
  })

  it('reads the align attribute and never writes left or start', async () => {
    const editor = await mount({
      content:
        '<table><tr><td align="right">a</td><td style="text-align: left">b</td><td style="text-align: start">c</td></tr></table>',
    })

    expect(clean(editor.getHTML())).toBe(
      '<table><tbody><tr><td style="text-align: right"><p>a</p></td><td><p>b</p></td><td><p>c</p></td></tr></tbody></table>',
    )
  })

  it('aligns every cell of a cell selection and reports it in cellStyle', async () => {
    const editor = await mount({ content: grid })
    placeCursor(editor, 4)
    editor.commands.setCellTextAlign('center')
    selectCells(editor, 2, 19)

    expect(editor.commands.setCellTextAlign('center')).toBe(true)
    expect(clean(editor.getHTML()).match(/<td style="text-align: center">/g)).toHaveLength(4)
    expect(editor.query.cellStyle()).toEqual({
      background: null,
      verticalAlign: null,
      textAlign: 'center',
    })
  })

  it('colours every cell of a cell selection', async () => {
    const editor = await mount({ content: grid })
    selectCells(editor, 2, 7)

    editor.commands.setCellBackground('#CDE8FF')

    expect(clean(editor.getHTML()).match(/background-color: #cde8ff/g)).toHaveLength(2)
  })

  it('rejects left and unknown alignments', async () => {
    const editor = await mount({ content: grid })
    placeCursor(editor, 4)

    expect(editor.can.setCellTextAlign('left' as 'center')).toBe(false)
    expect(editor.can.setCellTextAlign('javascript:' as 'center')).toBe(false)
  })

  it('loads old cell styles unchanged', async () => {
    const html =
      '<table><tbody><tr><td style="background-color: #fff2a8; vertical-align: bottom"><p>a</p></td></tr></tbody></table>'
    const editor = await mount({ content: html })

    expect(clean(editor.getHTML())).toBe(html)
  })
})

describe('table style', () => {
  const styled =
    '<table data-width="full" data-align="center" data-border="rows" data-striped="true" style="min-width: 300px; --vive-table-border-color: #aabbcc"><colgroup><col style="width: 200px"><col style="width: 100px"></colgroup><tbody><tr><td data-colwidth="200"><p>a</p></td><td data-colwidth="100"><p>b</p></td></tr></tbody></table>'

  it('round trips every table attribute in the sanitizer order', async () => {
    const editor = await mount({ content: styled })

    expect(clean(editor.getHTML())).toBe(styled)
    placeCursor(editor, 4)
    expect(editor.query.tableStyle()).toEqual({
      width: 'full',
      align: 'center',
      border: 'rows',
      striped: true,
      borderColor: '#aabbcc',
    })
  })

  it('writes a fixed width only when the table is not full width', async () => {
    const editor = await mount({ content: styled })
    placeCursor(editor, 4)

    editor.commands.setTableWidth(null)

    expect(clean(editor.getHTML())).toContain(
      'data-striped="true" style="width: 300px; --vive-table-border-color: #aabbcc">',
    )
  })

  it('writes nothing for defaults and keeps old tables unchanged', async () => {
    const editor = await mount({
      content:
        '<table data-width="auto" data-align="left" data-border="all" data-striped="false"><tr><td>a</td></tr></table>',
    })
    const old =
      '<table style="width: 160px"><colgroup><col style="width: 160px"></colgroup><tbody><tr><td data-colwidth="160"><p>a</p></td></tr></tbody></table>'
    const reloaded = await mount({ content: old })

    expect(clean(editor.getHTML())).toBe('<table><tbody><tr><td><p>a</p></td></tr></tbody></table>')
    expect(clean(reloaded.getHTML())).toBe(old)
  })

  it('sets each attribute through commands and clears it again', async () => {
    const editor = await mount({ content: grid })
    placeCursor(editor, 4)

    editor.commands.setTableWidth('full')
    editor.commands.setTableAlign('center')
    editor.commands.setTableBorder('none')
    editor.commands.setTableStriped(true)
    editor.commands.setTableBorderColor('#ABC')
    const set = clean(editor.getHTML())
    editor.commands.setTableWidth(null)
    editor.commands.setTableAlign(null)
    editor.commands.setTableBorder(null)
    editor.commands.setTableStriped(false)
    editor.commands.setTableBorderColor(null)

    expect(set).toMatch(
      /^<table data-width="full" data-align="center" data-border="none" data-striped="true" style="--vive-table-border-color: #aabbcc"><tbody>/,
    )
    expect(clean(editor.getHTML())).toBe(grid)
  })

  it('rejects invalid values', async () => {
    const editor = await mount({
      content:
        '<table data-border="dashed" style="--vive-table-border-color: var(--x)"><tr><td>a</td></tr></table>',
    })
    placeCursor(editor, 4)

    expect(clean(editor.getHTML())).toBe('<table><tbody><tr><td><p>a</p></td></tr></tbody></table>')
    expect(editor.can.setTableBorderColor('javascript:alert(1)')).toBe(false)
    expect(editor.can.setTableBorderColor('var(--x)')).toBe(false)
    expect(editor.can.setTableBorder('dashed' as 'rows')).toBe(false)
    expect(editor.can.setTableAlign('left' as 'center')).toBe(false)
    expect(editor.can.setTableWidth('auto' as 'full')).toBe(false)
    expect(editor.can.setTableStriped('yes' as unknown as boolean)).toBe(false)
  })

  it('stays off outside a table', async () => {
    const editor = await mount({ content: `${grid}<p>dışarı</p>` })
    placeCursor(editor, viewOf(editor).state.doc.content.size - 2)

    expect(editor.can.setTableWidth('full')).toBe(false)
    expect(editor.can.setTableAlign('center')).toBe(false)
    expect(editor.can.setTableBorder('rows')).toBe(false)
    expect(editor.can.setTableStriped(true)).toBe(false)
    expect(editor.can.setTableBorderColor('#aabbcc')).toBe(false)
    expect(editor.can.selectTable()).toBe(false)
    expect(editor.can.distributeColumns()).toBe(false)
    expect(editor.query.tableStyle()).toBeNull()
  })

  it.each([true, false])(
    'reflects the attributes on the live table (resizable %s)',
    async (resizable) => {
      const editor = await mount({ extensions: [Table.configure({ resizable })], content: grid })
      placeCursor(editor, 4)

      editor.commands.setTableWidth('full')
      editor.commands.setTableBorder('rows')
      editor.commands.setTableStriped(true)
      editor.commands.setTableBorderColor('#aabbcc')
      const table = editor.dom.querySelector('table')
      const live = {
        width: table?.getAttribute('data-width'),
        border: table?.getAttribute('data-border'),
        striped: table?.getAttribute('data-striped'),
        color: table?.style.getPropertyValue('--vive-table-border-color'),
      }
      editor.commands.setTableBorder(null)

      expect(live).toEqual({ width: 'full', border: 'rows', striped: 'true', color: '#aabbcc' })
      expect(table?.hasAttribute('data-border')).toBe(false)
      expect(table?.getAttribute('data-width')).toBe('full')
    },
  )
})

describe('table selection', () => {
  it('selects the row, the column and the whole table', async () => {
    const editor = await mount({ content: grid })
    placeCursor(editor, 9)

    editor.commands.selectRow()
    const row = selectedCells(editor)
    placeCursor(editor, 9)
    editor.commands.selectColumn()
    const column = selectedCells(editor)
    editor.commands.selectTable()

    expect(row).toEqual([2, 7])
    expect(column).toEqual([7, 19])
    expect(selectedCells(editor)).toEqual([2, 7, 14, 19])
  })
})

describe('distributeColumns', () => {
  it('gives every column the same width and keeps the total', async () => {
    const editor = await mount({
      content:
        '<table><tr><td data-colwidth="200">a</td><td data-colwidth="101">b</td></tr><tr><td colspan="2">c</td></tr></table>',
    })
    placeCursor(editor, 4)

    expect(editor.commands.distributeColumns()).toBe(true)
    expect(clean(editor.getHTML())).toBe(
      '<table style="width: 301px"><colgroup><col style="width: 151px"><col style="width: 150px"></colgroup><tbody><tr><td data-colwidth="151"><p>a</p></td><td data-colwidth="150"><p>b</p></td></tr><tr><td colspan="2" data-colwidth="151,150"><p>c</p></td></tr></tbody></table>',
    )
  })

  it('does nothing when no column has a width', async () => {
    const editor = await mount({ content: grid })
    placeCursor(editor, 4)

    expect(editor.commands.distributeColumns()).toBe(false)
  })
})

const merged =
  '<table><tr><th data-colwidth="100"><p>h1</p></th><th data-colwidth="200"><p>h2</p></th><th data-colwidth="60"><p>h3</p></th></tr><tr><td colspan="2" data-colwidth="100,200"><p>m</p></td><td rowspan="2" data-colwidth="60"><p>r</p></td></tr><tr><td data-colwidth="100"><p>x</p></td><td data-colwidth="200"><p>y</p></td></tr></table>'

function cursorIn(editor: Editor, text: string): void {
  let found = -1
  viewOf(editor).state.doc.descendants((node, position) => {
    if (found < 0 && node.isText && node.text === text) found = position
    return found < 0
  })
  if (found < 0) throw new Error(`No cell with ${text}`)
  placeCursor(editor, found)
}

function selectedTexts(editor: Editor): string[] {
  const { selection } = viewOf(editor).state
  if (!(selection instanceof CellSelection)) return []
  const texts: string[] = []
  selection.forEachCell((node) => {
    texts.push(node.textContent)
  })
  return texts
}

function tableProblems(editor: Editor): unknown {
  let problems: unknown = null
  viewOf(editor).state.doc.descendants((node) => {
    if (node.type.spec.tableRole === 'table') {
      problems = TableMap.get(node).problems ?? null
      return false
    }
    return true
  })
  return problems
}

describe('tables with merged cells', () => {
  it('styles every cell of a column selection that runs from the header into the body', async () => {
    const editor = await mount({ content: merged })
    cursorIn(editor, 'h1')
    editor.commands.selectColumn()
    const selected = selectedTexts(editor)

    const done = [
      editor.commands.setCellBackground('#ffeeaa'),
      editor.commands.setCellTextAlign('center'),
      editor.commands.setCellVerticalAlign('bottom'),
    ]

    const html = clean(editor.getHTML())
    expect(done).toEqual([true, true, true])
    expect(selected).toEqual(['h1', 'm', 'x'])
    expect(
      html.match(/text-align: center; background-color: #ffeeaa; vertical-align: bottom/g),
    ).toHaveLength(3)
    expect(html).toContain('<th data-colwidth="200"><p>h2</p></th>')
    expect(html).toContain('<td rowspan="2" data-colwidth="60"><p>r</p></td>')
  })

  it('spreads widths evenly over merged cells and keeps the total', async () => {
    const editor = await mount({ content: merged })
    cursorIn(editor, 'm')

    const done = editor.commands.distributeColumns()

    const html = clean(editor.getHTML())
    expect(done).toBe(true)
    expect(html).toContain(
      '<colgroup><col style="width: 120px"><col style="width: 120px"><col style="width: 120px"></colgroup>',
    )
    expect(html).toContain('<td colspan="2" data-colwidth="120,120"><p>m</p></td>')
    expect(html).toContain('<td rowspan="2" data-colwidth="120"><p>r</p></td>')
    expect(html).toContain('style="width: 360px"')
  })

  it('adds a row inside a row span and removes a column through a column span without breaking the grid', async () => {
    const editor = await mount({ content: merged })
    cursorIn(editor, 'm')
    editor.commands.addRowAfter()
    cursorIn(editor, 'h2')

    editor.commands.deleteColumn()

    const html = clean(editor.getHTML())
    expect(tableProblems(editor)).toBeNull()
    expect(html).toContain('<td data-colwidth="100"><p>m</p></td>')
    expect(html).toContain('rowspan="3"')
    expect(html.match(/<tr>/g)).toHaveLength(4)
  })

  it('merges a selection that already holds a merged cell and splits it back', async () => {
    const editor = await mount({ content: merged })
    cursorIn(editor, 'm')
    editor.commands.selectTable()

    const mergedAll = editor.commands.mergeCells()
    const afterMerge = tableProblems(editor)
    const split = editor.commands.splitCell()

    expect(mergedAll).toBe(true)
    expect(afterMerge).toBeNull()
    expect(split).toBe(true)
    expect(tableProblems(editor)).toBeNull()
    expect(clean(editor.getHTML()).match(/<t[hd][ >]/g)).toHaveLength(9)
  })

  it('selects the last row and the last column from their edge cells', async () => {
    const editor = await mount({ content: merged })
    cursorIn(editor, 'y')
    editor.commands.selectRow()
    const row = selectedTexts(editor)
    cursorIn(editor, 'h3')
    editor.commands.selectColumn()
    const column = selectedTexts(editor)
    cursorIn(editor, 'x')
    editor.commands.selectTable()

    expect(row).toEqual(expect.arrayContaining(['x', 'y', 'r']))
    expect(column).toEqual(['h3', 'r'])
    expect(selectedTexts(editor)).toHaveLength(7)
  })
})

describe('row height', () => {
  const sized =
    '<table><tbody><tr style="height: 48px"><td><p>a</p></td><td><p>b</p></td></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></tbody></table>'

  it('round trips the row height as an inline px style', async () => {
    const editor = await mount({ content: sized })

    const html = editor.getHTML()

    expect(html).toMatch(/^<table><tbody><tr style="height: 48px;?"><td>/)
    expect(html).toContain('</tr><tr><td><p>c</p>')
  })

  it('clamps parsed heights and ignores units other than px', async () => {
    const editor = await mount({
      content:
        '<table><tbody><tr style="height: 5px"><td><p>a</p></td></tr><tr style="height: 9999px"><td><p>b</p></td></tr><tr style="height: 2em"><td><p>c</p></td></tr></tbody></table>',
    })

    const html = editor.getHTML()

    expect(html.match(/<tr[^>]*>/g)).toEqual([
      expect.stringMatching(/^<tr style="height: 24px;?">$/),
      expect.stringMatching(/^<tr style="height: 2000px;?">$/),
      '<tr>',
    ])
  })

  it('sets the height of every row in a cell selection and reports it', async () => {
    const editor = await mount({ content: grid })
    selectCells(editor, 2, 19)

    expect(editor.commands.setRowHeight(60.4)).toBe(true)

    expect(editor.getHTML().match(/<tr style="height: 60px;?">/g)).toHaveLength(2)
    expect(editor.query.rowHeight()).toBe(60)
  })

  it('reports null for mixed heights and outside a table', async () => {
    const editor = await mount({ content: `${sized}<p>x</p>` })
    selectCells(editor, 2, 19)

    const mixed = editor.query.rowHeight()
    placeCursor(editor, 4)
    const single = editor.query.rowHeight()
    placeCursor(editor, viewOf(editor).state.doc.content.size - 1)

    expect([mixed, single, editor.query.rowHeight()]).toEqual([null, 48, null])
  })

  it('rejects invalid heights and a reset that changes nothing', async () => {
    const editor = await mount({ content: grid })
    placeCursor(editor, 4)

    const results = [
      editor.commands.setRowHeight(Number.NaN),
      editor.commands.setRowHeight('tall' as unknown as number),
      editor.commands.setRowHeight(null),
      editor.commands.resizeRow(0),
    ]

    expect(results).toEqual([false, false, false, false])
    expect(editor.getHTML()).not.toContain('height')
  })

  it('resizes from the stored or fallback height, clamps and resets', async () => {
    const editor = await mount({ content: grid })
    placeCursor(editor, 4)

    editor.commands.resizeRow(16)
    const grown = editor.query.rowHeight()
    editor.commands.resizeRow(16)
    const again = editor.query.rowHeight()
    editor.commands.resizeRow(-5000)
    const floor = editor.query.rowHeight()
    editor.commands.setRowHeight(null)

    expect([grown, again, floor, editor.query.rowHeight()]).toEqual([48, 64, 24, null])
  })

  it('undoes a resize of several rows in one step', async () => {
    const editor = await mount({ content: grid })
    selectCells(editor, 2, 19)
    editor.commands.resizeRow(20)

    expect(editor.commands.undo()).toBe(true)

    expect(editor.getHTML()).toBe(grid)
  })

  it('keeps the commands but drops the drag handle without resizable', async () => {
    const editor = await mount({
      content: grid,
      extensions: [Table.configure({ resizable: false })],
    })
    placeCursor(editor, 4)

    expect(editor.commands.setRowHeight(40)).toBe(true)
    expect(editor.dom.querySelector('.row-resize-handle')).toBeNull()
  })
})

describe('touch grips', () => {
  const press = (target: Element, type: string, init: PointerEventInit = {}): void => {
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        pointerType: 'touch',
        ...init,
      }),
    )
  }
  const layerOf = (editor: Editor) => editor.dom.querySelector<HTMLElement>('.table-touch-grips')
  const gripOf = (editor: Editor, axis: 'column' | 'row'): HTMLElement => {
    const grip = editor.dom.querySelector<HTMLElement>(`.table-touch-grip[data-axis="${axis}"]`)
    if (!grip) throw new Error(`no ${axis} grip`)
    return grip
  }
  const drag = (grip: HTMLElement, axis: 'x' | 'y', delta: number, end = 'pointerup'): void => {
    press(grip, 'pointerdown', { clientX: 0, clientY: 0 })
    press(grip, 'pointermove', axis === 'x' ? { clientX: delta } : { clientY: delta })
    press(grip, end, axis === 'x' ? { clientX: delta } : { clientY: delta })
  }
  const stub = (element: Element, values: Record<string, unknown>): void => {
    for (const [name, value] of Object.entries(values)) {
      Object.defineProperty(element, name, { configurable: true, value })
    }
  }
  const rect = (left: number, top: number, right: number, bottom: number) => () =>
    ({ left, top, right, bottom, width: right - left, height: bottom - top }) as DOMRect

  async function touched(content = grid, position = 4): Promise<Editor> {
    const editor = await mount({ content })
    placeCursor(editor, position)
    press(editor.dom, 'pointerdown')
    return editor
  }

  it('shows grips hidden from assistive technology in the table wrapper after a touch', async () => {
    const editor = await touched()
    const layer = layerOf(editor)

    expect(layer?.hidden).toBe(false)
    expect(layer?.getAttribute('aria-hidden')).toBe('true')
    expect(layer?.contentEditable).toBe('false')
    expect(layer?.parentElement?.classList.contains('tableWrapper')).toBe(true)
    expect(layer?.querySelectorAll('.table-touch-grip')).toHaveLength(2)
    expect(editor.getHTML()).toBe(grid)
  })

  it('never shows grips for a mouse and hides them while typing until the next touch', async () => {
    const editor = await mount({ content: grid })
    placeCursor(editor, 4)
    press(editor.dom, 'pointerdown', { pointerType: 'mouse' })
    const mouse = layerOf(editor)?.hidden ?? true
    press(editor.dom, 'pointerdown')
    editor.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }))
    const typing = layerOf(editor)?.hidden
    press(editor.dom, 'pointerdown')

    expect([mouse, typing, layerOf(editor)?.hidden]).toEqual([true, true, false])
  })

  it('hides the grips in read-only mode, outside a table and without resizable', async () => {
    const editor = await touched(`${grid}<p>x</p>`)
    placeCursor(editor, viewOf(editor).state.doc.content.size - 1)
    const outside = layerOf(editor)?.hidden
    placeCursor(editor, 4)
    editor.setEditable(false)
    const readOnly = layerOf(editor)?.hidden
    const fixed = await mount({
      content: grid,
      extensions: [Table.configure({ resizable: false })],
    })
    placeCursor(fixed, 4)
    press(fixed.dom, 'pointerdown')

    expect([outside, readOnly, layerOf(fixed)]).toEqual([true, true, null])
  })

  it('places the grips on the cell borders and keeps them inside the table', async () => {
    const editor = await mount({ content: grid })
    const wrapper = editor.dom.querySelector('.tableWrapper') as HTMLElement
    const table = wrapper.querySelector('table') as HTMLElement
    const cells = wrapper.querySelectorAll('td')
    stub(wrapper, { getBoundingClientRect: rect(10, 20, 410, 100), clientWidth: 400 })
    stub(table, { offsetLeft: 0, offsetTop: 0, offsetWidth: 400, offsetHeight: 80 })
    stub(cells[0] as Element, { getBoundingClientRect: rect(10, 20, 210, 60) })
    stub(cells[3] as Element, { getBoundingClientRect: rect(210, 60, 410, 100) })
    placeCursor(editor, 4)
    press(editor.dom, 'pointerdown')
    const first = [gripOf(editor, 'column').style.cssText, gripOf(editor, 'row').style.cssText]
    placeCursor(editor, 21)
    const last = [gripOf(editor, 'column').style.cssText, gripOf(editor, 'row').style.cssText]

    expect(first).toEqual([
      'left: 178px; top: 0px; --vive-grip-x: 22px; --vive-grip-y: 20px;',
      'left: 78px; top: 18px; --vive-grip-x: 22px; --vive-grip-y: 22px;',
    ])
    expect(last).toEqual([
      'left: 356px; top: 36px; --vive-grip-x: 41px; --vive-grip-y: 24px;',
      'left: 278px; top: 36px; --vive-grip-x: 22px; --vive-grip-y: 41px;',
    ])
  })

  it('resizes the right edge column of a merged cell in one undoable step', async () => {
    const merged =
      '<table><tbody><tr><td colspan="2"><p>a</p></td></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></tbody></table>'
    const editor = await touched(merged)
    const before = editor.getHTML()

    drag(gripOf(editor, 'column'), 'x', 40)
    const html = editor.getHTML()
    editor.commands.undo()

    expect(html).toContain('<td colspan="2" data-colwidth="0,160">')
    expect(html).toContain('<td data-colwidth="160"><p>d</p>')
    expect(html).toContain('<td><p>c</p>')
    expect(editor.getHTML()).toBe(before)
  })

  it('previews and then sets the bottom row of a row-spanning cell on release', async () => {
    const spanned =
      '<table><tbody><tr><td rowspan="2"><p>a</p></td><td><p>b</p></td></tr><tr><td><p>d</p></td></tr></tbody></table>'
    const editor = await touched(spanned)
    const grip = gripOf(editor, 'row')
    press(grip, 'pointerdown', { clientY: 0 })
    press(grip, 'pointermove', { clientY: 60 })
    const live = editor.dom.querySelector<HTMLElement>('tr.row-resizing')
    const liveHeight = live?.style.getPropertyValue('--vive-row-height')
    const liveIndex = live
      ? [...editor.dom.querySelectorAll('tr')].indexOf(live as HTMLTableRowElement)
      : -1
    press(grip, 'pointerup', { clientY: 60 })
    const rows = editor.getHTML().match(/<tr[^>]*>/g)
    editor.commands.undo()

    expect([liveHeight, liveIndex]).toEqual(['92px', 1])
    expect(rows).toEqual(['<tr>', expect.stringMatching(/^<tr style="height: 92px;?">$/)])
    expect(editor.dom.querySelector('tr.row-resizing')).toBeNull()
    expect(editor.getHTML()).toBe(spanned)
  })

  it('clamps the row and column minimums and leaves the document alone on cancel', async () => {
    const editor = await touched()
    drag(gripOf(editor, 'row'), 'y', 60, 'pointercancel')
    const cancelled = editor.getHTML()
    drag(gripOf(editor, 'column'), 'x', -500)
    drag(gripOf(editor, 'row'), 'y', -500)

    expect(cancelled).toBe(grid)
    expect(editor.getHTML()).toMatch(
      /^<table style="min-width: 96px;?"><colgroup><col style="width: 48px;?"><col><\/colgroup><tbody><tr style="height: 24px;?"><td data-colwidth="48">/,
    )
  })
})
