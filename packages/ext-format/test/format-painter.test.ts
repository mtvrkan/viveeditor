import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { formatExtensions } from '../src/index.js'

let editors: Editor[] = []

async function mount(content: string): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, {
    extensions: [...basicExtensions, ...formatExtensions],
    content,
  })
  editors.push(editor)
  return editor
}

function fire(editor: Editor, type: string, init: KeyboardEventInit = {}): void {
  const event = type.startsWith('key')
    ? new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init })
    : new MouseEvent(type, { bubbles: true, cancelable: true })
  editor.dom.dispatchEvent(event)
}

async function dragSelect(editor: Editor, from: number, to: number): Promise<void> {
  fire(editor, 'mousedown')
  editor.commands.setTextSelection(from, to)
  fire(editor, 'mouseup')
  await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeAll(() => {
  document.elementFromPoint ??= () => null
})

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('format painter', () => {
  it('copies the formatting of the selection and paints it on the next mouse selection', async () => {
    const editor = await mount(
      '<p><strong><em>kaynak</em></strong> <span style="color: #ff0000">hedef</span></p>',
    )
    editor.commands.setTextSelection(1, 7)

    editor.commands.copyFormat()
    expect(editor.query.isPaintingFormat()).toBe(true)
    expect(editor.dom.classList.contains('vive-format-painter')).toBe(true)
    await dragSelect(editor, 8, 13)

    expect(editor.getHTML()).toBe(
      '<p><strong><em>kaynak</em></strong> <strong><em>hedef</em></strong></p>',
    )
    expect(editor.query.isPaintingFormat()).toBe(false)
    expect(editor.dom.classList.contains('vive-format-painter')).toBe(false)
  })

  it('waits until the mouse is released before painting', async () => {
    const editor = await mount('<p><strong>a</strong> bcdef</p>')
    editor.commands.setTextSelection(1, 2)
    editor.commands.copyFormat()

    fire(editor, 'mousedown')
    editor.commands.setTextSelection(3, 4)
    editor.commands.setTextSelection(3, 6)

    expect(editor.getHTML()).toBe('<p><strong>a</strong> bcdef</p>')
    fire(editor, 'mouseup')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(editor.getHTML()).toBe('<p><strong>a</strong> <strong>bcd</strong>ef</p>')
  })

  it('paints plain text as plain and keeps links in the target', async () => {
    const editor = await mount('<p>düz <a href="https://example.com"><em>bağ</em></a></p>')
    editor.commands.setTextSelection(1, 4)
    editor.commands.copyFormat()

    await dragSelect(editor, 5, 8)

    expect(editor.getHTML()).toBe(
      '<p>düz <a rel="noopener noreferrer nofollow" href="https://example.com">bağ</a></p>',
    )
  })

  it('paints a keyboard selection when Shift is released', async () => {
    const editor = await mount('<p><u>alt</u> metin</p>')
    editor.commands.setTextSelection(2)
    editor.commands.copyFormat()

    fire(editor, 'keydown', { key: 'Shift', shiftKey: true })
    editor.commands.setTextSelection(5, 10)
    fire(editor, 'keyup', { key: 'Shift' })

    expect(editor.getHTML()).toBe('<p><u>alt</u> <u>metin</u></p>')
  })

  it('does not paint the source selection it was copied from', async () => {
    const editor = await mount('<p><strong>a</strong>b</p>')
    editor.commands.setTextSelection(1, 3)

    editor.commands.copyFormat()
    fire(editor, 'mouseup')
    await new Promise((resolve) => setTimeout(resolve, 0))

    fire(editor, 'keydown', { key: 'Shift', shiftKey: true })
    fire(editor, 'keyup', { key: 'Shift' })

    expect(editor.getHTML()).toBe('<p><strong>a</strong>b</p>')
    expect(editor.query.isPaintingFormat()).toBe(true)
  })

  it('stops with Escape, a second copy or cancelFormat', async () => {
    const editor = await mount('<p><strong>a</strong>b</p>')
    editor.commands.setTextSelection(1, 2)

    editor.commands.copyFormat()
    fire(editor, 'keydown', { key: 'Escape' })
    const afterEscape = editor.query.isPaintingFormat()
    editor.commands.copyFormat()
    editor.commands.copyFormat()
    const afterToggle = editor.query.isPaintingFormat()
    editor.commands.copyFormat()
    const cancelled = editor.commands.cancelFormat()

    expect([afterEscape, afterToggle, cancelled]).toEqual([false, false, true])
    expect(editor.query.isPaintingFormat()).toBe(false)
    expect(editor.can.cancelFormat()).toBe(false)
  })

  it('applies with one undo step and refuses an empty selection', async () => {
    const editor = await mount('<p><strong>a</strong>bc</p>')
    editor.commands.setTextSelection(1, 2)
    editor.commands.copyFormat()
    editor.commands.setTextSelection(3)

    expect(editor.can.applyFormat()).toBe(false)
    editor.commands.setTextSelection(2, 4)
    expect(editor.commands.applyFormat()).toBe(true)
    expect(editor.getHTML()).toBe('<p><strong>abc</strong></p>')
    editor.commands.undo()
    expect(editor.getHTML()).toBe('<p><strong>a</strong>bc</p>')
  })
})
