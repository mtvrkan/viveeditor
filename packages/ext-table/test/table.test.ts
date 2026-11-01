import { Editor, type EditorOptions } from '@viveeditor/core'
import { CodeBlock } from '@viveeditor/ext-code-block'
import { TextSelection } from 'prosemirror-state'
import { CellSelection } from 'prosemirror-tables'
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
