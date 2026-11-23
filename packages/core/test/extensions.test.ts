import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineExtension, Editor, ViveEditorError } from '../src/index.js'
import { TestMarks } from './fixtures.js'

let editors: Editor[] = []

async function mount(options: Parameters<typeof Editor.create>[1] = {}): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, options)
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

async function expectCode(promise: Promise<unknown>, code: string): Promise<void> {
  await expect(promise).rejects.toSatisfy(
    (error: unknown) => error instanceof ViveEditorError && error.code === code,
  )
}

describe('extension registry', () => {
  it('builds the schema from the base plus registered extensions', async () => {
    const editor = await mount({ extensions: [TestMarks] })

    const names = Object.keys(editor.schema.marks)

    expect(names).toEqual(['bold', 'italic'])
    expect(Object.keys(editor.schema.nodes)).toEqual(['doc', 'paragraph', 'text'])
  })

  it('treats markup from unregistered extensions as plain text', async () => {
    const editor = await mount({ content: '<p><strong>kalın</strong></p>' })

    const html = editor.getHTML()

    expect(html).toBe('<p>kalın</p>')
  })

  it('rejects the same extension registered twice', async () => {
    const promise = mount({ extensions: [TestMarks, TestMarks] })

    await expectCode(promise, 'DUPLICATE_EXTENSION')
  })

  it('rejects an extension that redefines an existing schema item', async () => {
    const Clash = defineExtension({
      name: 'clash',
      defaultOptions: {},
      nodes: () => ({ paragraph: { group: 'block', content: 'inline*' } }),
    })

    const promise = mount({ extensions: [Clash] })

    await expectCode(promise, 'SCHEMA_CONFLICT')
  })

  it('rejects two extensions that register the same command', async () => {
    const Undo = defineExtension({
      name: 'second-undo',
      defaultOptions: {},
      commands: () => ({ undo: () => () => false }),
    })

    const promise = mount({ extensions: [Undo] })

    await expectCode(promise, 'DUPLICATE_COMMAND')
  })

  it('applies configured options without mutating the original extension', async () => {
    const Configured = TestMarks.configure({ boldTag: 'b' })
    const editor = await mount({ extensions: [Configured], content: '<p><b>x</b></p>' })

    const html = editor.getHTML()

    expect(html).toBe('<p><b>x</b></p>')
    expect(TestMarks.options.boldTag).toBe('strong')
  })
})

describe('commands, can and isActive', () => {
  it('throws a clear error for a command no extension provides', async () => {
    const editor = await mount()

    const call = () => editor.commands.toggleBold()

    expect(call).toThrow(/toggleBold/)
  })

  it('answers can() without changing the document', async () => {
    const editor = await mount({ extensions: [TestMarks], content: '<p>metin</p>' })
    editor.commands.selectAll()
    const onChange = vi.fn()
    editor.on('change', onChange)

    const possible = editor.can.toggleBold()

    expect(possible).toBe(true)
    expect(onChange).not.toHaveBeenCalled()
    expect(editor.getHTML()).toBe('<p>metin</p>')
  })

  it('reports active marks and nodes for the selection', async () => {
    const editor = await mount({ extensions: [TestMarks], content: '<p>metin</p>' })
    editor.commands.selectAll()

    editor.commands.toggleBold()

    expect(editor.isActive('bold')).toBe(true)
    expect(editor.isActive('italic')).toBe(false)
    expect(editor.isActive('paragraph')).toBe(true)
    expect(editor.isActive('missing')).toBe(false)
  })

  it('emits update for selection-only changes', async () => {
    const editor = await mount({ content: '<p>metin</p>' })
    const onUpdate = vi.fn()
    const onChange = vi.fn()
    editor.on('update', onUpdate)
    editor.on('change', onChange)

    editor.commands.selectAll()

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onChange).not.toHaveBeenCalled()
  })
})

const Align = defineExtension({
  name: 'test-align',
  defaultOptions: {},
  attributes: () => [
    {
      types: ['paragraph', 'missing'],
      attributes: {
        align: {
          default: null,
          parse: (element) => element.style.textAlign || null,
          render: (value) => (value ? { style: `text-align: ${String(value)}` } : null),
        },
      },
    },
  ],
})

describe('global attributes', () => {
  it('parses and renders an attribute added to another extension node', async () => {
    const editor = await mount({
      extensions: [Align],
      content: '<p style="text-align: center">orta</p><p>sol</p>',
    })

    const html = editor.getHTML()

    expect(html).toMatch(/^<p style="text-align: center;?">orta<\/p><p>sol<\/p>$/)
    expect(editor.getJSON().content?.[0]?.attrs).toEqual({ align: 'center' })
  })

  it('merges a rendered style with the style the node already writes', async () => {
    const Styled = defineExtension({
      name: 'styled-block',
      defaultOptions: {},
      nodes: () => ({
        note: {
          group: 'block',
          content: 'inline*',
          parseDOM: [{ tag: 'aside' }],
          toDOM: () => ['aside', { style: 'color: red;' }, 0],
        },
      }),
    })
    const NoteAlign = defineExtension({
      name: 'note-align',
      defaultOptions: {},
      attributes: () => [
        { types: ['note'], attributes: Align.config.attributes?.({})[0]?.attributes ?? {} },
      ],
    })
    const editor = await mount({
      extensions: [Styled, NoteAlign],
      content: '<aside style="text-align: right">not</aside>',
    })

    const html = editor.getHTML()

    expect(html).toMatch(/^<aside style="color: red; text-align: right;?">not<\/aside>$/)
  })

  it('rejects an attribute that the node already defines', async () => {
    const Twice = defineExtension({
      name: 'test-align-again',
      defaultOptions: {},
      attributes: (options) => Align.config.attributes?.(options) ?? [],
    })

    const promise = mount({ extensions: [Align, Twice] })

    await expectCode(promise, 'SCHEMA_CONFLICT')
  })
})

describe('queries', () => {
  it('answers a registered query from the current state', async () => {
    const editor = await mount({ content: '<p>Merhaba dünya</p>' })
    editor.commands.selectAll()

    const text = editor.query.selectedText()

    expect(text).toBe('Merhaba dünya')
    expect('selectedText' in editor.query).toBe(true)
  })

  it('throws a clear error for a query no extension provides', async () => {
    const editor = await mount()
    const query = editor.query as unknown as Record<string, () => unknown>

    const call = () => query.missingQuery?.()

    expect(call).toThrow(/missingQuery/)
    expect('missingQuery' in editor.query).toBe(false)
  })

  it('rejects two extensions that register the same query', async () => {
    const Duplicate = defineExtension({
      name: 'second-selected-text',
      defaultOptions: {},
      queries: () => ({ selectedText: () => '' }),
    })

    const promise = mount({ extensions: [Duplicate] })

    await expectCode(promise, 'DUPLICATE_QUERY')
  })
})

describe('extension keymaps', () => {
  function press(editor: Editor, init: KeyboardEventInit): boolean {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
    editor.dom.dispatchEvent(event)
    return event.defaultPrevented
  }

  function bindings(name: string, keys: Record<string, () => boolean>) {
    return defineExtension({
      name,
      defaultOptions: {},
      keymap: () =>
        Object.fromEntries(Object.entries(keys).map(([key, run]) => [key, () => run()])),
    })
  }

  it('runs a later extension’s shifted shortcut before an earlier one’s unshifted fallback', async () => {
    const plain = vi.fn(() => true)
    const shifted = vi.fn(() => true)
    const editor = await mount({
      extensions: [
        bindings('plain', { 'Mod-e': plain }),
        bindings('shifted', { 'Mod-Shift-e': shifted }),
      ],
    })

    const handled = press(editor, {
      key: 'e',
      code: 'KeyE',
      keyCode: 69,
      ctrlKey: true,
      shiftKey: true,
    })

    expect(handled).toBe(true)
    expect(shifted).toHaveBeenCalledTimes(1)
    expect(plain).not.toHaveBeenCalled()
  })

  it('tries the next extension when the first binding for the same key declines', async () => {
    const declines = vi.fn(() => false)
    const accepts = vi.fn(() => true)
    const editor = await mount({
      extensions: [
        bindings('first', { 'Mod-e': declines }),
        bindings('second', { 'Ctrl-e': accepts }),
      ],
    })

    const handled = press(editor, { key: 'e', code: 'KeyE', keyCode: 69, ctrlKey: true })

    expect(handled).toBe(true)
    expect(declines).toHaveBeenCalledTimes(1)
    expect(accepts).toHaveBeenCalledTimes(1)
  })

  it('leaves Shift with an uppercase letter alone when only the unshifted key is bound', async () => {
    const plain = vi.fn(() => true)
    const editor = await mount({ extensions: [bindings('plain', { 'Mod-e': plain })] })

    const handled = press(editor, {
      key: 'E',
      code: 'KeyE',
      keyCode: 69,
      ctrlKey: true,
      shiftKey: true,
    })

    expect(handled).toBe(false)
    expect(plain).not.toHaveBeenCalled()
  })
})

const Verbatim = defineExtension({
  name: 'verbatim-style',
  defaultOptions: {},
  marks: () => ({
    family: {
      attrs: { value: {} },
      verbatimStyle: true,
      parseDOM: [
        { tag: 'span[data-family]', getAttrs: (element) => ({ value: element.dataset.family }) },
      ],
      toDOM: (mark) => [
        'span',
        {
          'data-family': String(mark.attrs.value),
          style: `font-family: ${String(mark.attrs.value)}`,
        },
        0,
      ],
    },
  }),
  nodes: () => ({
    frame: {
      group: 'block',
      content: 'inline*',
      verbatimStyle: true,
      parseDOM: [{ tag: 'section' }],
      toDOM: () => ['section', ['div', { style: 'color: #ABCDEF' }, 0]],
    },
    plain: {
      group: 'block',
      content: 'inline*',
      parseDOM: [{ tag: 'aside' }],
      toDOM: () => ['aside', { style: 'color: #abcdef' }, 0],
    },
  }),
})

describe('verbatim styles', () => {
  it('writes a verbatim style attribute exactly as the spec returns it, before later attributes', async () => {
    const editor = await mount({
      extensions: [Verbatim],
      content: `<p><span data-family="'Open Sans', &quot;Noto&quot; &amp; sans">metin</span></p>`,
    })

    const html = editor.getHTML()

    expect(html).toBe(
      `<p><span data-family="'Open Sans', &quot;Noto&quot; &amp; sans" style="font-family: 'Open Sans', &quot;Noto&quot; &amp; sans">metin</span></p>`,
    )
  })

  it('keeps a verbatim style on a nested element of the spec', async () => {
    const editor = await mount({ extensions: [Verbatim], content: '<section>iç</section>' })

    expect(editor.getHTML()).toBe('<section><div style="color: #ABCDEF">iç</div></section>')
  })

  it('leaves the style of other specs to the browser and never rewrites matching text', async () => {
    const editor = await mount({
      extensions: [Verbatim],
      content: '<aside>a</aside><p> data-vive-style="x-0"</p>',
    })

    const html = editor.getHTML()

    expect(html).toMatch(/^<aside style="color: rgb\(171, 205, 239\);?">a<\/aside>/)
    expect(html).toContain('data-vive-style="x-0"</p>')
  })
})
