import { Editor, type EditorOptions } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import katex from 'katex'
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { isSupportedKatex, MathExtension, type MathOptions } from '../src/index.js'
import { renderMath } from '../src/render.js'

let editors: Editor[] = []

beforeAll(() => {
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList
})

async function mount(
  options: Partial<MathOptions> = {},
  editorOptions: EditorOptions = {},
): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, {
    extensions: [...basicExtensions, MathExtension.configure(options)],
    ...editorOptions,
  })
  editors.push(editor)
  return editor
}

const viewOf = (editor: Editor): EditorView => (editor as unknown as { view: EditorView }).view

const load = async () => katex

function typeText(editor: Editor, text: string): void {
  const view = viewOf(editor)
  for (const character of text) {
    const { from, to } = view.state.selection
    const handled = view.someProp('handleTextInput', (handler) =>
      handler(view, from, to, character, () => view.state.tr.insertText(character, from, to)),
    )
    if (!handled) view.dispatch(view.state.tr.insertText(character, from, to))
  }
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('isSupportedKatex', () => {
  it('accepts 0.18.2 and newer and rejects older or malformed versions', () => {
    expect(isSupportedKatex('0.18.2')).toBe(true)
    expect(isSupportedKatex('0.19.1')).toBe(true)
    expect(isSupportedKatex('1.0.0')).toBe(true)
    expect(isSupportedKatex('0.18.1')).toBe(false)
    expect(isSupportedKatex('0.16.47')).toBe(false)
    expect(isSupportedKatex('x.y')).toBe(false)
    expect(isSupportedKatex(undefined)).toBe(false)
  })
})

describe('MathExtension schema', () => {
  it('stores LaTeX source and round-trips inline and block formulas', async () => {
    const html =
      '<p>Alan <span data-math="inline">\\pi r^2</span></p><div data-math="block">e^{i\\pi}+1=0</div>'
    const editor = await mount({}, { content: html })

    expect(editor.getHTML()).toBe(html)
  })

  it('keeps oversized or deeply nested formulas as plain text', async () => {
    const deep = `${'{'.repeat(65)}x${'}'.repeat(65)}`
    const editor = await mount(
      {},
      {
        content: `<p><span data-math="inline">${'x'.repeat(2001)}</span><span data-math="inline">${deep}</span></p>`,
      },
    )

    expect(editor.getHTML()).toBe(`<p>${'x'.repeat(2001)}${deep}</p>`)
  })

  it('never stores rendered output and escapes markup in the source', async () => {
    const editor = await mount(
      {},
      { content: '<p><span data-math="inline">a&lt;b<img src=x></span></p>' },
    )

    expect(editor.getHTML()).toBe('<p><span data-math="inline">a&lt;b</span></p>')
  })
})

describe('MathExtension editing', () => {
  it('turns $x^2$ into an inline formula but leaves prices alone', async () => {
    const editor = await mount({}, { content: '<p></p>' })

    typeText(editor, 'Fiyat $5 ve $10, alan $x^2$')

    expect(editor.getHTML()).toBe(
      '<p>Fiyat $5 ve $10, alan <span data-math="inline">x^2</span></p>',
    )
  })

  it('opens the source field for a new formula and saves on Enter', async () => {
    const editor = await mount({}, { content: '<p>a</p>' })

    editor.commands.insertMath()
    const field = editor.dom.querySelector<HTMLInputElement>('.vive-math-field')
    if (!field) throw new Error('field missing')
    field.value = '\\sqrt{2}'
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    expect(editor.getHTML()).toBe('<p><span data-math="inline">\\sqrt{2}</span>a</p>')
  })

  it('removes a new empty formula when editing is cancelled', async () => {
    const editor = await mount({}, { content: '<p>a</p>' })

    editor.commands.insertMath({ display: true })
    const field = editor.dom.querySelector<HTMLTextAreaElement>('textarea.vive-math-field')
    field?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(editor.getHTML()).toBe('<p>a</p>')
  })

  it('turns $$ and Enter on an empty line into a block formula', async () => {
    const editor = await mount({}, { content: '<p>$$</p>' })
    const view = viewOf(editor)
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3)))

    view.someProp('handleKeyDown', (handler) =>
      handler(view, new KeyboardEvent('keydown', { key: 'Enter' })),
    )

    expect(editor.dom.querySelector('div.vive-math textarea')).not.toBeNull()
  })

  it('does not insert or open formulas in a read-only editor', async () => {
    const editor = await mount(
      {},
      { content: '<p><span data-math="inline">x</span></p>', editable: false },
    )

    expect(editor.commands.insertMath()).toBe(false)
    editor.dom.querySelector<HTMLElement>('.vive-math')?.click()

    expect(editor.dom.querySelector('.vive-math-field')).toBeNull()
  })
})

describe('KaTeX rendering', () => {
  it('renders with KaTeX inside the node view without trusting commands', async () => {
    const editor = await mount(
      { load },
      { content: '<p><span data-math="inline">\\href{javascript:alert(1)}{x}</span></p>' },
    )

    await vi.waitFor(() => expect(editor.dom.querySelector('.katex')).not.toBeNull())
    expect(editor.dom.querySelector('a')).toBeNull()
    expect(editor.getHTML()).toBe(
      '<p><span data-math="inline">\\href{javascript:alert(1)}{x}</span></p>',
    )
  })

  it('refuses an outdated KaTeX and reports it', async () => {
    const onError = vi.fn()
    const old = { version: '0.16.9', render: vi.fn() }
    const editor = await mount(
      { load: async () => old, onError },
      { content: '<p><span data-math="inline">x</span></p>' },
    )

    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith({ code: 'KATEX_OUTDATED', version: '0.16.9' }),
    )
    expect(old.render).not.toHaveBeenCalled()
    expect(editor.dom.querySelector('.vive-math-source')?.textContent).toBe('$x$')
  })

  it('renderMath renders stored formulas once and skips invalid ones', async () => {
    const root = document.createElement('article')
    root.innerHTML =
      '<p><span data-math="inline">a^2</span></p><div data-math="block">\\frac{1}{2}</div><p><span data-math="inline"></span></p>'

    const first = await renderMath(root, { load })
    const second = await renderMath(root, { load })

    expect(first).toBe(2)
    expect(second).toBe(0)
    expect(root.querySelectorAll('.katex')).toHaveLength(2)
    expect(root.querySelector('div[data-math] .katex-display')).not.toBeNull()
  })
})
