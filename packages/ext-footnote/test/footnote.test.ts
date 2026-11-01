import { Editor, type EditorOptions } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Footnote } from '../src/index.js'
import { renderFootnotes } from '../src/render.js'
import { footnoteEditorOf } from '../src/view.js'

let editors: Editor[] = []

beforeAll(() => {
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList
})

async function mount(options: EditorOptions = {}): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, {
    extensions: [...basicExtensions, Footnote],
    ...options,
  })
  editors.push(editor)
  return editor
}

const viewOf = (editor: Editor): EditorView => (editor as unknown as { view: EditorView }).view

function placeCursor(editor: Editor, pos: number): void {
  const view = viewOf(editor)
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos)))
}

const innerView = (editor: Editor): EditorView | undefined =>
  footnoteEditorOf(editor.dom.querySelector('.vive-footnote-field'))

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('Footnote schema', () => {
  it('round-trips a footnote with bold, italic and link text', async () => {
    const html =
      '<p>Metin<sup data-footnote=""><strong>Kaynak</strong>: <em>bkz.</em> <a rel="noopener noreferrer nofollow" href="https://example.com">site</a></sup>.</p>'
    const editor = await mount({ content: html })

    expect(editor.getHTML()).toBe(html)
  })

  it('flattens nested footnotes, mentions and unsupported marks to text', async () => {
    const editor = await mount({
      content:
        '<p>a<sup data-footnote=""><u>alt</u> <sup data-footnote="">iç</sup> <img src=x onerror=alert(1)></sup></p>',
    })

    expect(editor.getHTML()).toBe('<p>a<sup data-footnote="">alt iç</sup></p>')
  })

  it('caps the stored note at 5000 characters', async () => {
    const editor = await mount({
      content: `<p><sup data-footnote="">${'x'.repeat(6000)}</sup></p>`,
    })

    expect(editor.getHTML()).toBe(`<p><sup data-footnote="">${'x'.repeat(5000)}</sup></p>`)
  })
})

describe('Footnote editing', () => {
  it('inserts a footnote and writes typed text back as one outer change', async () => {
    const editor = await mount({ content: '<p>Metin</p>' })
    placeCursor(editor, 6)

    expect(editor.commands.insertFootnote()).toBe(true)
    const inner = innerView(editor)
    if (!inner) throw new Error('inner editor missing')
    inner.dispatch(inner.state.tr.insertText('Not', 0))

    expect(editor.getHTML()).toBe('<p>Metin<sup data-footnote="">Not</sup></p>')
    expect(editor.dom.querySelector('.vive-footnote')?.getAttribute('aria-label')).toBe(
      'Footnote: Not',
    )
  })

  it('refuses to insert inside a link or in a read-only editor', async () => {
    const linked = await mount({ content: '<p><a href="https://example.com">bağlantı</a></p>' })
    placeCursor(linked, 4)
    const readOnly = await mount({ content: '<p>a</p>', editable: false })

    expect(linked.commands.insertFootnote()).toBe(false)
    expect(readOnly.commands.insertFootnote()).toBe(false)
  })

  it('removes a link mark that lands on a footnote', async () => {
    const editor = await mount({ content: '<p>a<sup data-footnote="">not</sup>b</p>' })

    editor.commands.selectAll()
    editor.commands.setLink({ href: 'https://example.com' })

    expect(editor.getHTML()).toContain('</a><sup data-footnote="">not</sup><a')
  })
})

describe('renderFootnotes', () => {
  it('numbers notes, moves their content into a list and stays idempotent', () => {
    const root = document.createElement('article')
    root.innerHTML =
      '<p>A<sup data-footnote="">Bir <a href="https://example.com">kaynak</a></sup> B<sup data-footnote="">İki</sup></p>'

    const first = renderFootnotes(root)
    const second = renderFootnotes(root)

    expect(first).toBe(2)
    expect(second).toBe(0)
    const items = root.querySelectorAll('ol.vive-footnotes > li')
    expect(items).toHaveLength(2)
    expect(items[0]?.textContent).toBe('Bir kaynak ↩')
    const reference = root.querySelector<HTMLAnchorElement>('sup a')
    expect(reference?.getAttribute('href')).toBe(`#${items[0]?.id}`)
    expect(items[0]?.id).toMatch(/^vive-fn-\d+-1$/)
  })

  it('uses unique ids per call and plain numbers inside links', () => {
    const one = document.createElement('div')
    one.innerHTML = '<p><a href="https://example.com">x<sup data-footnote="">n</sup></a></p>'
    const two = document.createElement('div')
    two.innerHTML = '<p>y<sup data-footnote="">m</sup></p>'

    renderFootnotes(one)
    renderFootnotes(two)

    expect(one.querySelector('a a')).toBeNull()
    expect(one.querySelector('sup')?.textContent).toBe('1')
    expect(one.querySelector('li')?.id).not.toBe(two.querySelector('li')?.id)
  })
})
