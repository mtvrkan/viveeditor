import { Editor } from '@viveeditor/core'
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import { CharacterCount } from '../src/index.js'

let editors: Editor[] = []

async function mount(limit: number | null, content = '<p>Merhaba</p>'): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, {
    extensions: [CharacterCount.configure({ limit })],
    content,
  })
  editors.push(editor)
  return editor
}

const viewOf = (editor: Editor): EditorView => (editor as unknown as { view: EditorView }).view

function type(editor: Editor, text: string): void {
  const view = viewOf(editor)
  view.dispatch(view.state.tr.insertText(text))
}

function cursorAtEnd(editor: Editor): void {
  const view = viewOf(editor)
  const end = view.state.doc.content.size - 1
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, end)))
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('character count', () => {
  it('counts characters across blocks with emoji and Turkish letters as one each', async () => {
    const editor = await mount(null, '<p>Işık 👍</p><p>ğüş</p>')

    const count = editor.query.characterCount()

    expect(count).toBe(9)
    expect(editor.query.characterLimit()).toBeNull()
  })

  it('stops typing at the limit but still allows deleting', async () => {
    const editor = await mount(10)
    cursorAtEnd(editor)

    type(editor, 'abc')
    type(editor, 'de')

    expect(editor.getText()).toBe('Merhabaabc')
    const view = viewOf(editor)
    view.dispatch(view.state.tr.delete(1, 3))
    expect(editor.query.characterCount()).toBe(8)
  })

  it('lets the host load longer content and the author shorten it', async () => {
    const editor = await mount(5)

    editor.setContent('<p>Uzun bir metin</p>')
    cursorAtEnd(editor)
    type(editor, 'x')
    const view = viewOf(editor)
    view.dispatch(view.state.tr.delete(1, 6))

    expect(editor.getText()).toBe('bir metin')
  })

  it('trims pasted text to the space that is left', async () => {
    const editor = await mount(12)
    cursorAtEnd(editor)

    viewOf(editor).pasteText('dünya ve ötesi', new Event('paste') as ClipboardEvent)

    expect(editor.getText()).toBe('Merhabadünya')
    expect(editor.query.characterCount()).toBe(12)
  })

  it('ignores an invalid limit', async () => {
    const editor = await mount(-3)
    cursorAtEnd(editor)

    type(editor, ' dünya')

    expect(editor.getText()).toBe('Merhaba dünya')
    expect(editor.query.characterLimit()).toBeNull()
  })
})
