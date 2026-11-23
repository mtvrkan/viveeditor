import { defineExtension, Editor, type Extension } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { Plugin } from 'prosemirror-state'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { formatExtensions } from '../src/index.js'

let editors: Editor[] = []

async function mount(
  content = '<p>önce&nbsp;</p>',
  extra: readonly Extension[] = [],
): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, {
    extensions: [...basicExtensions, ...formatExtensions, ...extra],
    content,
  })
  editors.push(editor)
  return editor
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

const RICH = {
  'text/html':
    '<h2>Başlık</h2><p><strong>kalın</strong> <a href="https://example.com"><em>bağ</em></a></p>',
  'text/plain': 'Başlık\nkalın bağ',
}

const Swallow = defineExtension({
  name: 'test-swallow',
  defaultOptions: {},
  plugins: () => [
    new Plugin({
      props: {
        handlePaste: (_view, event) =>
          event.clipboardData?.getData('text/html').includes('yutulan') === true,
      },
    }),
  ],
})

const Caption = defineExtension({
  name: 'test-caption',
  defaultOptions: {},
  nodes: () => ({
    figure: {
      group: 'block',
      content: 'caption',
      parseDOM: [{ tag: 'figure' }],
      toDOM: () => ['figure', 0],
    },
    caption: {
      content: 'inline*',
      parseDOM: [{ tag: 'figcaption' }],
      toDOM: () => ['figcaption', 0],
    },
  }),
})

function trackPastedNodes(seen: Set<ProseMirrorNode>, kept: ProseMirrorNode[]): Extension {
  return defineExtension({
    name: 'test-track',
    defaultOptions: {},
    plugins: () => [
      new Plugin({
        props: {
          transformPasted: (slice) => {
            slice.content.descendants((node) => {
              if (node.type.name === 'hardBreak') seen.add(node)
            })
            return slice
          },
        },
        appendTransaction: (transactions, _old, state) => {
          if (!transactions.some((transaction) => transaction.getMeta('uiEvent') === 'paste')) {
            return null
          }
          kept.length = 0
          state.doc.descendants((node) => {
            if (seen.has(node)) kept.push(node)
          })
          return null
        },
      }),
    ],
  })
}

beforeAll(() => {
  if (!('ClipboardEvent' in globalThis)) vi.stubGlobal('ClipboardEvent', class extends Event {})
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList
})

afterEach(() => {
  Reflect.deleteProperty(navigator, 'clipboard')
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('paste options', () => {
  it('remembers a formatted paste and where it landed', async () => {
    const editor = await mount()
    editor.commands.setTextSelection(6)

    paste(editor, RICH)
    const last = editor.query.lastPaste()

    expect(last).toMatchObject({ mode: 'keep', hasText: true })
    expect(last && editor.query.textBetween(last.from, last.to)).toBe('Başlık\nkalın bağ')
  })

  it('pastes the same clipboard again as plain text and back with formatting', async () => {
    const editor = await mount()
    editor.commands.setTextSelection(6)
    paste(editor, RICH)
    const rich = editor.getHTML()

    editor.commands.pasteAs('plain')
    const plain = editor.getHTML()
    const mode = editor.query.lastPaste()?.mode
    editor.commands.pasteAs('keep')

    expect(plain).toBe('<p>önce Başlık</p><p>kalın bağ</p>')
    expect(mode).toBe('plain')
    expect(editor.getHTML()).toBe(rich)
    expect(editor.query.lastPaste()?.mode).toBe('keep')
  })

  it('keeps headings and links but drops character formatting in clean mode', async () => {
    const editor = await mount('<p></p>')
    paste(editor, RICH)

    editor.commands.pasteAs('clean')

    expect(editor.getHTML()).toBe(
      '<h2>Başlık</h2><p>kalın <a rel="noopener noreferrer nofollow" href="https://example.com">bağ</a></p>',
    )
    expect(editor.query.lastPaste()?.mode).toBe('clean')
  })

  it('forgets the paste once the document is edited or the options are dismissed', async () => {
    const editor = await mount('<p></p>')
    paste(editor, RICH)
    editor.commands.insertText('!')
    const afterTyping = editor.query.lastPaste()
    paste(editor, RICH)

    editor.commands.dismissPaste()

    expect(afterTyping).toBeNull()
    expect(editor.query.lastPaste()).toBeNull()
    expect(editor.can.pasteAs('plain')).toBe(false)
  })

  it('offers nothing for a plain text paste and no plain mode without plain text', async () => {
    const editor = await mount('<p></p>')
    paste(editor, { 'text/plain': 'yalnızca metin' })
    const plainPaste = editor.query.lastPaste()

    paste(editor, { 'text/html': '<p><em>yalnız html</em></p>' })

    expect(plainPaste).toBeNull()
    expect(editor.query.lastPaste()?.hasText).toBe(false)
    expect(editor.can.pasteAs('plain')).toBe(false)
    expect(editor.can.pasteAs('clean')).toBe(true)
  })

  it('keeps the remembered paste of each editor apart', async () => {
    const first = await mount('<p></p>')
    const second = await mount('<p></p>')
    paste(first, RICH)
    paste(second, { 'text/html': '<p><strong>ikinci</strong></p>', 'text/plain': 'ikinci' })

    first.commands.pasteAs('plain')
    second.commands.pasteAs('plain')

    expect(first.getHTML()).toBe('<p>Başlık</p><p>kalın bağ</p>')
    expect(second.getHTML()).toBe('<p>ikinci</p>')
  })

  it('undoes a later switch back to the earlier paste', async () => {
    const editor = await mount('<p></p>')
    vi.useFakeTimers({ toFake: ['Date'] })
    paste(editor, RICH)
    const rich = editor.getHTML()
    vi.setSystemTime(Date.now() + 2000)

    editor.commands.pasteAs('plain')
    editor.commands.undo()
    vi.useRealTimers()

    expect(editor.getHTML()).toBe(rich)
  })

  it('forgets a clipboard that another handler took over before the next paste', async () => {
    const editor = await mount('<p></p>', [Swallow])
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText: async () => 'düz yazı' },
      configurable: true,
    })
    editor.focus()

    paste(editor, { 'text/html': '<p><strong>yutulan</strong></p>', 'text/plain': 'yutulan' })
    await Promise.resolve()
    editor.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'V', ctrlKey: true, shiftKey: true, bubbles: true }),
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    await Promise.resolve()

    expect(editor.getHTML()).toBe('<p>düz yazı</p>')
    expect(editor.query.lastPaste()).toBeNull()
  })

  it('refuses to switch a paste once the editor is read-only', async () => {
    const editor = await mount()
    editor.commands.setTextSelection(6)
    paste(editor, RICH)
    const before = editor.getHTML()
    editor.setEditable(false)

    const switched = editor.commands.pasteAs('plain')

    expect(switched).toBe(false)
    expect(editor.getHTML()).toBe(before)
  })

  it('puts the lines on one line where no new paragraph fits', async () => {
    const editor = await mount('<figure><figcaption>alt</figcaption></figure>', [Caption])
    editor.commands.setTextSelection(5)
    paste(editor, { 'text/html': '<strong>bir</strong><br>iki', 'text/plain': 'bir\niki' })

    const switched = editor.commands.pasteAs('plain')

    expect(switched).toBe(true)
    expect(editor.getHTML()).toBe('<figure><figcaption>altbir iki</figcaption></figure>')
  })

  it('keeps untouched pasted nodes as they are when cleaning', async () => {
    const seen = new Set<ProseMirrorNode>()
    const kept: ProseMirrorNode[] = []
    const editor = await mount('<p></p>', [trackPastedNodes(seen, kept)])
    paste(editor, { 'text/html': '<p><strong>a</strong><br>b</p>', 'text/plain': 'a\nb' })

    editor.commands.pasteAs('clean')

    expect(editor.getHTML()).toBe('<p>a<br>b</p>')
    expect(kept).toHaveLength(1)
  })
})
