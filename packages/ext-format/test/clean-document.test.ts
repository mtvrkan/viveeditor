import { defineExtension, Editor, type Extension } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { afterEach, describe, expect, it } from 'vitest'
import { formatExtensions } from '../src/index.js'

const Code = defineExtension({
  name: 'test-code',
  defaultOptions: {},
  nodes: () => ({
    codeBlock: {
      group: 'block',
      content: 'text*',
      code: true,
      marks: '',
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
      toDOM: () => ['pre', 0],
    },
  }),
})

let editors: Editor[] = []

async function mount(content: string): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const extensions: Extension[] = [...basicExtensions, ...formatExtensions, Code]
  const editor = await Editor.create(element, { extensions, content })
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('cleanDocument', () => {
  it('collapses repeated spaces, trims paragraph edges and keeps non-breaking spaces', async () => {
    const editor = await mount(
      '<p>&nbsp; a &nbsp; <strong>b</strong> &nbsp;</p><p>c&nbsp;&nbsp;d</p>',
    )

    const report = editor.query.documentCleanup()
    editor.commands.cleanDocument()

    expect(report).toEqual({ extraSpaces: 6, trailingBreaks: 0, emptyParagraphs: 0 })
    expect(editor.getHTML()).toBe('<p>a <strong>b</strong></p><p>c&nbsp;&nbsp;d</p>')
  })

  it('removes spaces around line breaks and line breaks at the end of a paragraph', async () => {
    const editor = await mount('<p>a &nbsp;<br>&nbsp; b</p><p>son<br><br></p>')

    const report = editor.query.documentCleanup()
    editor.commands.cleanDocument()

    expect(report).toEqual({ extraSpaces: 4, trailingBreaks: 2, emptyParagraphs: 0 })
    expect(editor.getHTML()).toBe('<p>a<br>b</p><p>son</p>')
  })

  it('drops empty paragraphs at the edges and keeps one between blocks', async () => {
    const editor = await mount(
      '<p></p><p>a</p><p></p><p></p><p>&nbsp; </p><h2></h2><p>b</p><p></p><p></p>',
    )

    const report = editor.query.documentCleanup()
    editor.commands.cleanDocument()

    expect(report.emptyParagraphs).toBe(6)
    expect(editor.getHTML()).toBe('<p>a</p><p></p><p>b</p>')
  })

  it('keeps one empty paragraph after a closing rule so there is a place to type', async () => {
    const editor = await mount('<p>a</p><hr><p></p><p></p>')

    editor.commands.cleanDocument()

    expect(editor.getHTML()).toBe('<p>a</p><hr><p></p>')
  })

  it('keeps a single empty paragraph when the document is only empty lines', async () => {
    const editor = await mount('<p></p><p>&nbsp;&nbsp;</p><p></p>')

    editor.commands.cleanDocument()

    expect(editor.getHTML()).toBe('<p></p>')
  })

  it('leaves code blocks exactly as written', async () => {
    const editor = await mount('<pre>  girinti   kalır  </pre><p>x &nbsp;y</p>')

    editor.commands.cleanDocument()

    expect(editor.getHTML()).toBe('<pre>  girinti   kalır  </pre><p>x y</p>')
  })

  it('reports nothing for a tidy document and undoes a clean-up in one step', async () => {
    const tidy = await mount('<p>derli <em>toplu</em></p>')
    const messy = await mount('<p>&nbsp; dağınık &nbsp;</p><p></p>')
    const before = messy.getHTML()

    const possible = tidy.can.cleanDocument()
    messy.commands.cleanDocument()
    messy.commands.undo()

    expect(possible).toBe(false)
    expect(tidy.query.documentCleanup()).toEqual({
      extraSpaces: 0,
      trailingBreaks: 0,
      emptyParagraphs: 0,
    })
    expect(messy.getHTML()).toBe(before)
  })
})
