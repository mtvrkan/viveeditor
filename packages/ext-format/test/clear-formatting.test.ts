import { Editor, type Extension } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { afterEach, describe, expect, it } from 'vitest'
import { ClearFormatting, formatExtensions } from '../src/index.js'

let editors: Editor[] = []

async function mount(
  content: string,
  extensions: readonly Extension[] = [...basicExtensions, ...formatExtensions],
): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, { extensions, content })
  editors.push(editor)
  return editor
}

function pressClearShortcut(editor: Editor): boolean {
  const event = new KeyboardEvent('keydown', {
    key: '\\',
    ctrlKey: true,
    bubbles: true,
    cancelable: true,
  })
  editor.dom.dispatchEvent(event)
  return event.defaultPrevented
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('clearFormatting', () => {
  it('removes every mark in the selection but keeps links', async () => {
    const editor = await mount(
      '<p><strong>kalın</strong> <em>italik</em> <u>altı</u> <s>çizik</s> <code>kod</code> <span style="color: #ff0000">renk</span> <mark>vurgu</mark> <a href="https://example.com"><strong>bağ</strong></a></p>',
    )
    editor.commands.selectAll()

    const cleared = editor.commands.clearFormatting()

    expect(cleared).toBe(true)
    expect(editor.getHTML()).toBe(
      '<p>kalın italik altı çizik kod renk vurgu <a rel="noopener noreferrer nofollow" href="https://example.com">bağ</a></p>',
    )
  })

  it('resets alignment of every block in the selection and keeps the block type', async () => {
    const editor = await mount(
      '<h2 style="text-align: center"><strong>Başlık</strong></h2><p style="text-align: right">Metin</p>',
    )
    editor.commands.selectAll()

    editor.commands.clearFormatting()

    expect(editor.getHTML()).toBe('<h2>Başlık</h2><p>Metin</p>')
  })

  it('leaves text outside the selection untouched', async () => {
    const editor = await mount('<p><strong>abcdef</strong></p>')
    editor.commands.setTextSelection(2, 4)

    editor.commands.clearFormatting()

    expect(editor.getHTML()).toBe('<p><strong>a</strong>bc<strong>def</strong></p>')
  })

  it('makes the next typed text plain when the cursor sits in formatted text', async () => {
    const editor = await mount('<p><strong>kalın</strong></p>')
    editor.commands.setTextSelection(6)

    const cleared = editor.commands.clearFormatting()
    editor.commands.insertText('düz')

    expect(cleared).toBe(true)
    expect(editor.getHTML()).toBe('<p><strong>kalın</strong>düz</p>')
  })

  it('resets the alignment of the block around a collapsed cursor', async () => {
    const editor = await mount('<p style="text-align: center">orta</p>')
    editor.commands.setTextSelection(2)

    editor.commands.clearFormatting()

    expect(editor.getHTML()).toBe('<p>orta</p>')
  })

  it('reports nothing to clear for plain text and changes nothing', async () => {
    const editor = await mount('<p>düz <a href="https://example.com">bağ</a></p>')
    editor.commands.selectAll()
    const before = editor.getHTML()

    const possible = editor.can.clearFormatting()
    const cleared = editor.commands.clearFormatting()

    expect(possible).toBe(false)
    expect(cleared).toBe(false)
    expect(editor.getHTML()).toBe(before)
  })

  it('undoes the whole clean-up in one step', async () => {
    const source = '<p style="text-align: center"><strong>kalın</strong> <em>italik</em></p>'
    const editor = await mount(source)
    const original = editor.getHTML()
    editor.commands.selectAll()
    editor.commands.clearFormatting()

    editor.commands.undo()

    expect(editor.getHTML()).toBe(original)
  })

  it('keeps the marks named in keepMarks', async () => {
    const extensions = [
      ...basicExtensions,
      ...formatExtensions.filter((extension) => extension.name !== 'clearFormatting'),
      ClearFormatting.configure({ keepMarks: ['link', 'code'] }),
    ]
    const editor = await mount('<p><code>kod</code> <strong>kalın</strong></p>', extensions)
    editor.commands.selectAll()

    editor.commands.clearFormatting()

    expect(editor.getHTML()).toBe('<p><code>kod</code> kalın</p>')
  })

  it('runs from the Mod-\\ shortcut', async () => {
    const editor = await mount('<p><strong>kalın</strong></p>')
    editor.commands.selectAll()

    const handled = pressClearShortcut(editor)

    expect(handled).toBe(true)
    expect(editor.getHTML()).toBe('<p>kalın</p>')
  })
})
