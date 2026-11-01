import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineExtension, Editor, ViveEditorError } from '../src/index.js'
import { TestMarks } from './fixtures.js'

let editors: Editor[] = []

async function mount(options: Parameters<typeof Editor.create>[1] = {}): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, { extensions: [TestMarks], ...options })
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('Editor.create', () => {
  it('starts with one empty paragraph when no content is given', async () => {
    const editor = await mount()
    expect(editor.isEmpty).toBe(true)
    expect(editor.getHTML()).toBe('<p></p>')
  })

  it('parses HTML content into the schema', async () => {
    const editor = await mount({ content: '<p>Merhaba <b>dünya</b> ve <i>ötesi</i></p>' })
    expect(editor.getHTML()).toBe('<p>Merhaba <strong>dünya</strong> ve <em>ötesi</em></p>')
  })

  it('accepts JSON content and round-trips it unchanged', async () => {
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'kalın', marks: [{ type: 'bold' }] }],
        },
      ],
    }
    const editor = await mount({ content: json })
    expect(editor.getJSON()).toEqual(json)
  })

  it('rejects JSON that does not match the schema', async () => {
    await expect(
      mount({ content: { type: 'doc', content: [{ type: 'unknown' }] } }),
    ).rejects.toThrow(ViveEditorError)
  })

  it('sets accessible attributes on the editable surface', async () => {
    const editor = await mount({ label: 'Makale içeriği' })
    const surface = document.querySelector('.vive-content')
    expect(surface?.getAttribute('role')).toBe('textbox')
    expect(surface?.getAttribute('aria-label')).toBe('Makale içeriği')
    expect(editor.isEditable).toBe(true)
  })
})

describe('sanitization by schema', () => {
  it('drops scripts, event handlers and unknown elements', async () => {
    const editor = await mount({
      content:
        '<p onclick="alert(1)">a<script>alert(2)</script><img src=x onerror="alert(3)">b<iframe src="https://evil.test"></iframe></p>',
    })
    const html = editor.getHTML()
    expect(html).toBe('<p>ab</p>')
    expect(html).not.toMatch(/script|onerror|onclick|iframe|img/)
  })

  it('does not execute handlers while parsing untrusted HTML', async () => {
    const spy = vi.fn()
    Object.assign(window, { viveProbe: spy })
    await mount({ content: '<img src="x" onerror="window.viveProbe()"><p>ok</p>' })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('commands and history', () => {
  it('toggles bold on the whole document and undoes it', async () => {
    const editor = await mount({ content: '<p>metin</p>' })
    editor.commands.selectAll()

    const applied = editor.commands.toggleBold()

    expect(applied).toBe(true)
    expect(editor.getHTML()).toBe('<p><strong>metin</strong></p>')
    expect(editor.commands.undo()).toBe(true)
    expect(editor.getHTML()).toBe('<p>metin</p>')
  })

  it('reports nothing to redo on a fresh editor', async () => {
    const editor = await mount({ content: '<p>metin</p>' })

    const redone = editor.commands.redo()

    expect(redone).toBe(false)
  })

  it('replaces the whole document as one undoable step and drops disallowed markup', async () => {
    const editor = await mount({ content: '<p>ilk</p>' })

    const replaced = editor.commands.replaceContent(
      '<p onclick="x()"><strong>kalın</strong></p><script>alert(1)</script><p>ikinci</p>',
    )

    expect(replaced).toBe(true)
    expect(editor.getHTML()).toBe('<p><strong>kalın</strong></p><p>ikinci</p>')
    expect(editor.commands.undo()).toBe(true)
    expect(editor.getHTML()).toBe('<p>ilk</p>')
  })

  it('keeps the replacement apart from the edit just before it in the undo history', async () => {
    const editor = await mount({ content: '<p>metin</p>' })
    editor.commands.selectAll()
    editor.commands.toggleBold()

    editor.commands.replaceContent('<p>yeni</p>')

    expect(editor.commands.undo()).toBe(true)
    expect(editor.getHTML()).toBe('<p><strong>metin</strong></p>')
  })

  it('adds no history step when the replacement equals the document', async () => {
    const editor = await mount({ content: '<p>aynı</p>' })

    const replaced = editor.commands.replaceContent('<p>aynı</p>')

    expect(replaced).toBe(true)
    expect(editor.commands.undo()).toBe(false)
  })

  it('refuses JSON that does not match the schema and keeps the document', async () => {
    const editor = await mount({ content: '<p>kalır</p>' })

    const replaced = editor.commands.replaceContent({ type: 'doc', content: [{ type: 'video' }] })

    expect(replaced).toBe(false)
    expect(editor.getHTML()).toBe('<p>kalır</p>')
  })
})

describe('insertContent command', () => {
  it('inserts parsed content at the cursor as one undoable step', async () => {
    const editor = await mount({ content: '<p>ilk</p>' })

    const inserted = editor.commands.insertContent('<p><strong>yeni</strong></p><p>ikinci</p>')

    expect(inserted).toBe(true)
    expect(editor.getHTML()).toBe('<p><strong>yeni</strong></p><p>ikinci</p><p>ilk</p>')
    expect(editor.commands.undo()).toBe(true)
    expect(editor.getHTML()).toBe('<p>ilk</p>')
  })

  it('refuses empty content and leaves the document alone', async () => {
    const editor = await mount({ content: '<p>kalır</p>' })

    expect(editor.can.insertContent({ type: 'doc', content: [] })).toBe(false)
    expect(editor.getHTML()).toBe('<p>kalır</p>')
  })

  it('refuses JSON that does not match the schema', async () => {
    const editor = await mount({ content: '<p>kalır</p>' })

    const inserted = editor.commands.insertContent({ type: 'doc', content: [{ type: 'video' }] })

    expect(inserted).toBe(false)
    expect(editor.getHTML()).toBe('<p>kalır</p>')
  })
})

describe('insertText command', () => {
  it('inserts plain text at the cursor as one undoable step', async () => {
    const editor = await mount({ content: '<p>ab</p>' })

    const inserted = editor.commands.insertText('<b>x</b> 😀')

    expect(inserted).toBe(true)
    expect(editor.getHTML()).toBe('<p>&lt;b&gt;x&lt;/b&gt; 😀ab</p>')
    expect(editor.commands.undo()).toBe(true)
    expect(editor.getHTML()).toBe('<p>ab</p>')
  })

  it('refuses empty text', async () => {
    const editor = await mount({ content: '<p>kalır</p>' })

    const inserted = editor.can.insertText('')

    expect(inserted).toBe(false)
    expect(editor.getHTML()).toBe('<p>kalır</p>')
  })

  it('refuses to insert in a read-only editor', async () => {
    const editor = await mount({ content: '<p>kalır</p>', editable: false })

    const inserted = editor.commands.insertText('x')

    expect(inserted).toBe(false)
    expect(editor.getHTML()).toBe('<p>kalır</p>')
  })
})

describe('setTextSelection command', () => {
  it('selects a text range and collapses when only one position is given', async () => {
    const editor = await mount({ content: '<p>merhaba</p>' })

    editor.commands.setTextSelection(1, 4)
    const range = editor.getSelection()
    editor.commands.setTextSelection(8)

    expect(range).toEqual({ from: 1, to: 4, empty: false })
    expect(editor.getSelection()).toEqual({ from: 8, to: 8, empty: true })
  })

  it('refuses positions outside the document', async () => {
    const editor = await mount({ content: '<p>a</p>' })

    expect(editor.commands.setTextSelection(-1)).toBe(false)
    expect(editor.commands.setTextSelection(1, 99)).toBe(false)
    expect(editor.commands.setTextSelection(1.5)).toBe(false)
  })
})

const InlineNote = defineExtension({
  name: 'test-note',
  defaultOptions: {},
  nodes: () => ({
    note: {
      inline: true,
      group: 'inline',
      content: 'text*',
      parseDOM: [{ tag: 'sup' }],
      toDOM: () => ['sup', 0],
    },
  }),
})

describe('textBetween query', () => {
  it('returns the text of a range and clamps positions to the document', async () => {
    const editor = await mount({ content: '<p>bir</p><p>iki</p>' })

    expect(editor.query.textBetween(0, 99)).toBe('bir\niki')
    expect(editor.query.textBetween(-5, 3)).toBe('bi')
    expect(editor.query.textBetween(4, 2)).toBe('')
  })

  it('leaves out inline nodes with their own text, like footnotes', async () => {
    const editor = await mount({
      extensions: [TestMarks, InlineNote],
      content: '<p>Cümle<sup>kaynak</sup> devam eder.</p>',
    })
    editor.commands.selectAll()

    const selected = editor.query.selectedText()
    const range = editor.query.textBetween(0, 99)

    expect(selected).toBe('Cümle devam eder.')
    expect(range).toBe('Cümle devam eder.')
  })

  it('keeps the text of an inline node when the range lies inside it', async () => {
    const editor = await mount({
      extensions: [TestMarks, InlineNote],
      content: '<p>Cümle<sup>kaynak</sup></p>',
    })

    const inside = editor.query.textBetween(7, 11)

    expect(inside).toBe('kayn')
  })
})

describe('events and lifecycle', () => {
  it('emits change when content is replaced, and unsubscribes cleanly', async () => {
    const editor = await mount()
    const listener = vi.fn()
    const unsubscribe = editor.on('change', listener)
    editor.setContent('<p>yeni</p>')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    editor.setContent('<p>tekrar</p>')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps setContent out of the undo history', async () => {
    const editor = await mount({ content: '<p>ilk</p>' })
    editor.setContent('<p>ikinci</p>')
    expect(editor.commands.undo()).toBe(false)
    expect(editor.getHTML()).toBe('<p>ikinci</p>')
  })

  it('isolates a throwing listener and reports it on the error event', async () => {
    const editor = await mount()
    const failure = new Error('listener failure')
    const healthy = vi.fn()
    const onError = vi.fn()
    editor.on('change', () => {
      throw failure
    })
    editor.on('change', healthy)
    editor.on('error', onError)

    editor.setContent('<p>x</p>')

    expect(healthy).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith({ editor, error: failure })
  })

  it('toggles editability', async () => {
    const editor = await mount({ editable: false })
    expect(editor.isEditable).toBe(false)
    editor.setEditable(true)
    expect(editor.isEditable).toBe(true)
  })

  it('still returns the last content after destroy but refuses mutations', async () => {
    const editor = await mount({ content: '<p>saklı</p>' })
    const onDestroy = vi.fn()
    editor.on('destroy', onDestroy)
    editor.destroy()
    editor.destroy()
    expect(onDestroy).toHaveBeenCalledTimes(1)
    expect(editor.isDestroyed).toBe(true)
    expect(editor.getHTML()).toBe('<p>saklı</p>')
    expect(() => editor.setContent('<p>x</p>')).toThrow(ViveEditorError)
    expect(document.querySelector('.vive-content')).toBeNull()
  })
})

describe('selection and text queries', () => {
  it('returns plain text with one line per block', async () => {
    const editor = await mount({ content: '<p>Bir <b>iki</b></p><p>üç</p>' })

    const text = editor.getText()

    expect(text).toBe('Bir iki\nüç')
  })

  it('reports a collapsed selection at the start and a range after selectAll', async () => {
    const editor = await mount({ content: '<p>abc</p>' })
    const initial = editor.getSelection()

    editor.commands.selectAll()

    expect(initial).toEqual({ from: 1, to: 1, empty: true })
    expect(editor.getSelection()).toEqual({ from: 0, to: 5, empty: false })
  })

  it('returns no text before the cursor when the selection is a range', async () => {
    const editor = await mount({ content: '<p>abc</p>' })

    editor.commands.selectAll()

    expect(editor.getTextBeforeCursor()).toBe('')
  })

  it('returns empty attributes for unknown names and after destroy', async () => {
    const editor = await mount({ content: '<p>abc</p>' })

    const unknown = editor.getAttributes('missing')
    editor.destroy()

    expect(unknown).toEqual({})
    expect(editor.getAttributes('paragraph')).toEqual({})
    expect(editor.getSelectionRect()).toBeNull()
  })
})

describe('deleteRange command', () => {
  it('deletes the given range', async () => {
    const editor = await mount({ content: '<p>/başlık</p>' })

    const result = editor.commands.deleteRange(1, 2)

    expect(result).toBe(true)
    expect(editor.getHTML()).toBe('<p>başlık</p>')
  })

  it('refuses a range outside the document', async () => {
    const editor = await mount({ content: '<p>a</p>' })

    expect(editor.can.deleteRange(2, 1)).toBe(false)
    expect(editor.can.deleteRange(0, 999)).toBe(false)
  })
})

const BlockNodes = defineExtension({
  name: 'test-blocks',
  defaultOptions: {},
  nodes: () => ({
    codeBlock: {
      content: 'text*',
      group: 'block',
      code: true,
      marks: '',
      parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
      toDOM: () => ['pre', ['code', 0]],
    },
    hardBreak: {
      inline: true,
      group: 'inline',
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br'],
    },
  }),
})

describe('Editor spaces in HTML', () => {
  it('writes leading, trailing and repeated spaces as no-break spaces and reads them back', async () => {
    const editor = await mount({ content: '<p>x</p>' })
    editor.setContent({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '  a  b  ' }] }],
    })

    const html = editor.getHTML()
    const reloaded = await mount({ content: html })

    expect(html).toBe('<p>&nbsp;&nbsp;a &nbsp;b&nbsp;&nbsp;</p>')
    expect(reloaded.getText()).toBe('  a  b  ')
    expect(reloaded.getHTML()).toBe(html)
  })

  it('keeps spaces next to marks and line breaks', async () => {
    const editor = await mount({ extensions: [TestMarks, BlockNodes], content: '<p>x</p>' })
    editor.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a ' },
            { type: 'text', text: ' b ', marks: [{ type: 'bold' }] },
            { type: 'hardBreak' },
            { type: 'text', text: ' c' },
          ],
        },
      ],
    })

    const html = editor.getHTML()
    const reloaded = await mount({ extensions: [TestMarks, BlockNodes], content: html })

    expect(html).toBe('<p>a <strong>&nbsp;b&nbsp;</strong><br>&nbsp;c</p>')
    expect(reloaded.getJSON()).toEqual(editor.getJSON())
  })

  it('leaves a no-break space between words and code blocks as they are', async () => {
    const editor = await mount({
      extensions: [TestMarks, BlockNodes],
      content: '<p>10&nbsp;km</p><pre><code>  kod  </code></pre>',
    })

    const html = editor.getHTML()

    expect(editor.getText()).toContain('10\u00a0km')
    expect(html).toBe('<p>10&nbsp;km</p><pre><code>  kod  </code></pre>')
  })
})
