import { Plugin } from 'prosemirror-state'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { defineExtension, Editor, type Extension } from '../src/index.js'
import { TestMarks } from './fixtures.js'

const Shout = defineExtension({
  name: 'shout',
  defaultOptions: {},
  plugins: () => [
    new Plugin({
      props: {
        handlePaste: (view, event) => {
          const text = event.clipboardData?.getData('text/plain') ?? ''
          view.dispatch(view.state.tr.insertText(text.toUpperCase()))
          return true
        },
      },
    }),
  ],
})

let editors: Editor[] = []

async function mount(
  content: string,
  extensions: readonly Extension[] = [TestMarks],
): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, { extensions, content })
  editors.push(editor)
  return editor
}

function key(editor: Editor, type: 'keydown' | 'keyup', init: KeyboardEventInit): void {
  editor.dom.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init }))
}

function paste(editor: Editor, data: Record<string, string>): void {
  const entries = new Map(Object.entries(data))
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
  Object.defineProperty(event, 'clipboardData', {
    value: {
      getData: (type: string) => entries.get(type) ?? '',
      files: [],
      types: [...entries.keys()],
    },
  })
  editor.dom.dispatchEvent(event)
}

function stubClipboard(readText: () => Promise<string>): void {
  if (!('ClipboardEvent' in globalThis)) vi.stubGlobal('ClipboardEvent', class extends Event {})
  Object.defineProperty(navigator, 'clipboard', { value: { readText }, configurable: true })
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await Promise.resolve()
}

const RICH = {
  'text/html': '<p><strong>kalın</strong> <em>italik</em></p>',
  'text/plain': 'kalın italik',
}

beforeAll(() => {
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList
})

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
  Reflect.deleteProperty(navigator, 'clipboard')
  vi.unstubAllGlobals()
})

describe('plain text paste', () => {
  it('keeps the pasted formatting on a normal paste', async () => {
    const editor = await mount('<p></p>')

    paste(editor, RICH)

    expect(editor.getHTML()).toBe('<p><strong>kalın</strong> <em>italik</em></p>')
  })

  it('pastes only the text while Shift is held', async () => {
    const editor = await mount('<p></p>')

    key(editor, 'keydown', { key: 'Shift', shiftKey: true })
    paste(editor, RICH)

    expect(editor.getHTML()).toBe('<p>kalın italik</p>')
  })

  it('skips paste handlers of other extensions for a plain paste', async () => {
    const editor = await mount('<p></p>', [TestMarks, Shout])

    key(editor, 'keydown', { key: 'Shift', shiftKey: true })
    paste(editor, { 'text/plain': 'sessiz' })

    expect(editor.getHTML()).toBe('<p>sessiz</p>')
  })

  it('splits plain lines into paragraphs and takes the style around the cursor', async () => {
    const editor = await mount('<p><strong>ab</strong></p>')
    editor.commands.setTextSelection(2)

    key(editor, 'keydown', { key: 'Shift', shiftKey: true })
    paste(editor, { 'text/html': '<h1>x</h1>', 'text/plain': 'bir\niki' })

    expect(editor.getHTML()).toBe('<p><strong>abir</strong></p><p><strong>ikib</strong></p>')
  })

  it('goes back to a normal paste once Shift is released or on Shift+Insert', async () => {
    const editor = await mount('<p></p>', [TestMarks, Shout])

    key(editor, 'keydown', { key: 'Shift', shiftKey: true })
    key(editor, 'keyup', { key: 'Shift' })
    paste(editor, { 'text/plain': 'a' })
    key(editor, 'keydown', { key: 'Insert', shiftKey: true })
    paste(editor, { 'text/plain': 'b' })

    expect(editor.getHTML()).toBe('<p>AB</p>')
  })

  it('reads the clipboard for Ctrl+Shift+V when the browser pastes nothing itself', async () => {
    const readText = vi.fn(async () => 'panodan\nikinci')
    stubClipboard(readText)
    const editor = await mount('<p><strong>x</strong></p>', [TestMarks, Shout])
    editor.commands.setTextSelection(2)
    editor.focus()

    key(editor, 'keydown', { key: 'V', ctrlKey: true, shiftKey: true })
    key(editor, 'keyup', { key: 'Shift' })
    await settle()

    expect(readText).toHaveBeenCalledOnce()
    expect(editor.getHTML()).toBe('<p><strong>xpanodan</strong></p><p><strong>ikinci</strong></p>')
    editor.commands.undo()
    expect(editor.getHTML()).toBe('<p><strong>x</strong></p>')
  })

  it('leaves the clipboard alone when the browser pastes for the shortcut', async () => {
    const readText = vi.fn(async () => 'ikinci kez')
    stubClipboard(readText)
    const editor = await mount('<p></p>')

    key(editor, 'keydown', { key: 'V', metaKey: true, shiftKey: true })
    paste(editor, RICH)
    await settle()

    expect(readText).not.toHaveBeenCalled()
    expect(editor.getHTML()).toBe('<p>kalın italik</p>')
  })

  it('inserts nothing in a read-only editor or when the clipboard read is refused', async () => {
    const refused = vi.fn(async () => Promise.reject(new Error('denied')))
    stubClipboard(refused)
    const editor = await mount('<p>sabit</p>')

    key(editor, 'keydown', { key: 'v', ctrlKey: true, shiftKey: true })
    await settle()
    stubClipboard(async () => 'yazılmaz')
    editor.setEditable(false)
    key(editor, 'keydown', { key: 'v', ctrlKey: true, shiftKey: true })
    await settle()

    expect(refused).toHaveBeenCalledOnce()
    expect(editor.getHTML()).toBe('<p>sabit</p>')
  })

  it('ignores a late browser paste after the clipboard was already read', async () => {
    stubClipboard(async () => 'bir kez')
    const editor = await mount('<p></p>')
    editor.focus()

    key(editor, 'keydown', { key: 'v', ctrlKey: true, shiftKey: true })
    await settle()
    paste(editor, { 'text/plain': 'bir kez' })

    expect(editor.getHTML()).toBe('<p>bir kez</p>')
  })

  it('does not insert when the editor lost focus while the clipboard was read', async () => {
    stubClipboard(async () => 'gitmez')
    const editor = await mount('<p>yerinde</p>')
    const other = document.createElement('input')
    document.body.append(other)
    editor.focus()

    key(editor, 'keydown', { key: 'v', ctrlKey: true, shiftKey: true })
    other.focus()
    await settle()

    expect(editor.getHTML()).toBe('<p>yerinde</p>')
  })
})
