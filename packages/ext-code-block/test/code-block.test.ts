import { Editor, type EditorOptions } from '@viveeditor/core'
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import { CodeHighlight, type Highlighter, shikiHighlighter } from '../src/highlight.js'
import { CodeBlock } from '../src/index.js'

let editors: Editor[] = []

async function mount(options: EditorOptions = {}): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, { extensions: [CodeBlock], ...options })
  editors.push(editor)
  return editor
}

const viewOf = (editor: Editor): EditorView => (editor as unknown as { view: EditorView }).view

function placeCursor(editor: Editor, position: number): void {
  const view = viewOf(editor)
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, position)))
}

function press(editor: Editor, key: string, shiftKey = false): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
  editor.dom.dispatchEvent(event)
  return event
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('code block schema', () => {
  it('round-trips a block with a language and keeps whitespace', async () => {
    const html =
      '<pre data-language="python"><code class="language-python">def f():\n    return 1</code></pre>'

    const editor = await mount({ content: html })

    expect(editor.getHTML()).toBe(html)
  })

  it('reads lang- and language- classes from pasted markup', async () => {
    const editor = await mount({
      content: '<pre><code class="lang-Ruby">puts 1</code></pre><pre><code>düz</code></pre>',
    })

    const languages = editor.getJSON().content?.map((block) => block.attrs?.language)

    expect(languages).toEqual(['ruby', null])
  })

  it('drops a language that could break out of the attribute', async () => {
    const editor = await mount({
      content: {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: '"><img src=x onerror=alert(1)>' },
            content: [{ type: 'text', text: 'x' }],
          },
        ],
      },
    })

    const html = editor.getHTML()

    expect(html).toBe('<pre><code>x</code></pre>')
  })
})

describe('code block commands', () => {
  it('joins selected paragraphs into one block and splits it back into lines', async () => {
    const editor = await mount({ content: '<p>const a = 1</p><p></p><p>a++</p>' })
    editor.commands.selectAll()

    editor.commands.toggleCodeBlock('javascript')
    const joined = editor.getJSON().content
    editor.commands.toggleCodeBlock()

    expect(joined).toHaveLength(1)
    expect(joined?.[0]?.content?.[0]?.text).toBe('const a = 1\n\na++')
    expect(editor.getHTML()).toBe('<p>const a = 1</p><p></p><p>a++</p>')
  })

  it('changes the language and reports it through a query', async () => {
    const editor = await mount({ content: '<pre><code>x</code></pre>' })
    placeCursor(editor, 1)

    const changed = editor.commands.setCodeBlockLanguage('go')
    const refused = editor.commands.setCodeBlockLanguage('not a language')

    expect(changed).toBe(true)
    expect(refused).toBe(false)
    expect(editor.query.codeBlockLanguage()).toBe('go')
  })
})

describe('code block keyboard', () => {
  it('leaves the block after Enter on two trailing empty lines', async () => {
    const editor = await mount({ content: '<pre><code>x\n\n</code></pre>' })
    placeCursor(editor, 4)

    press(editor, 'Enter')

    expect(editor.getHTML()).toBe('<pre><code>x</code></pre><p></p>')
    expect(editor.query.codeBlockLanguage()).toBeNull()
  })

  it('indents with Tab and outdents with Shift-Tab', async () => {
    const editor = await mount({ content: '<pre><code>x</code></pre>' })
    placeCursor(editor, 1)

    const tab = press(editor, 'Tab')
    const indented = editor.getText()
    press(editor, 'Tab', true)

    expect(tab.defaultPrevented).toBe(true)
    expect(indented).toBe('  x')
    expect(editor.getText()).toBe('x')
  })

  it('lets Tab move focus out after Escape so the block is no keyboard trap', async () => {
    const editor = await mount({ content: '<pre><code>x</code></pre>' })
    placeCursor(editor, 1)

    press(editor, 'Escape')
    const tab = press(editor, 'Tab')

    expect(tab.defaultPrevented).toBe(false)
    expect(editor.getText()).toBe('x')
  })
})

describe('code block view', () => {
  it('changes the language from the labelled select', async () => {
    const editor = await mount({ content: '<pre><code>x</code></pre>' })
    const select = editor.dom.querySelector('select')
    if (!select) throw new Error('Missing language select')

    select.value = 'rust'
    select.dispatchEvent(new Event('change'))

    expect(select.getAttribute('aria-label')).toBe('Language')
    expect(editor.getJSON().content?.[0]?.attrs?.language).toBe('rust')
  })
})

describe('CodeHighlight', () => {
  it('colours tokens on screen but never writes them into the saved HTML', async () => {
    const highlighter: Highlighter = async (code) => [
      { from: 0, to: code.indexOf(' '), style: 'color:#d73a49' },
    ]
    const editor = await mount({
      extensions: [CodeBlock, CodeHighlight.configure({ highlighter, delay: 0 })],
      content: '<pre data-language="js"><code>const a</code></pre>',
    })

    await wait(20)

    expect(editor.dom.querySelector('code span[style]')?.textContent).toBe('const')
    expect(editor.getHTML()).toBe(
      '<pre data-language="js"><code class="language-js">const a</code></pre>',
    )
  })

  it('maps Shiki tokens to CSS variables and loads Shiki only once', async () => {
    let loads = 0
    const highlight = shikiHighlighter(async () => {
      loads += 1
      return {
        codeToTokens: (code: string) => ({
          tokens: [
            [
              {
                content: code,
                offset: 0,
                htmlStyle: { '--shiki-light': '#d73a49', '--shiki-dark': '#f97583' },
              },
            ],
          ],
        }),
      }
    })

    const first = await highlight('let', 'js')
    await highlight('var', 'js')

    expect(first).toEqual([{ from: 0, to: 3, style: '--shiki-light:#d73a49;--shiki-dark:#f97583' }])
    expect(loads).toBe(1)
  })

  it('ignores a token style that could inject other CSS', async () => {
    const highlight = shikiHighlighter(async () => ({
      codeToTokens: () => ({
        tokens: [[{ content: 'x', offset: 0, htmlStyle: 'color:red;background:url("//evil")' }]],
      }),
    }))

    const tokens = await highlight('x', 'js')

    expect(tokens).toEqual([])
  })
})
