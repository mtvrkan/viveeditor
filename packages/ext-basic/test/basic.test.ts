import { Editor, type EditorOptions } from '@viveeditor/core'
import { afterEach, describe, expect, it } from 'vitest'
import { basicExtensions, Heading, Link } from '../src/index.js'

let editors: Editor[] = []

async function mount(options: EditorOptions = {}): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, { extensions: basicExtensions, ...options })
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('schema round trip', () => {
  it('keeps every basic element intact through HTML', async () => {
    const html =
      '<h2>Başlık</h2><p><strong>k</strong><em>i</em><u>a</u><s>ü</s><code>c</code><a rel="noopener noreferrer nofollow" href="https://a.test">l</a>x<br>y</p><blockquote><p>alıntı</p></blockquote><hr><p></p>'

    const editor = await mount({ content: html })

    expect(editor.getHTML()).toBe(html)
  })

  it('normalises legacy and styled markup to semantic tags', async () => {
    const editor = await mount({
      content:
        '<p><b>a</b><i>b</i><del>c</del><strike>d</strike><span style="font-weight:700">e</span><span style="font-style:italic">f</span></p>',
    })

    const html = editor.getHTML()

    expect(html).toBe('<p><strong>a</strong><em>b</em><s>cd</s><strong>e</strong><em>f</em></p>')
  })

  it('ignores a <b> that explicitly resets the weight', async () => {
    const editor = await mount({ content: '<p><b style="font-weight:normal">düz</b></p>' })

    const html = editor.getHTML()

    expect(html).toBe('<p>düz</p>')
  })
})

describe('link safety', () => {
  it('drops dangerous hrefs while keeping the link text', async () => {
    const editor = await mount({
      content:
        '<p><a href="javascript:alert(1)">a</a><a href=" JaVaScRiPt:alert(1)">b</a><a href="data:text/html,x">c</a></p>',
    })

    const html = editor.getHTML()

    expect(html).toBe('<p>abc</p>')
  })

  it('never renders a dangerous href that arrives through JSON', async () => {
    const editor = await mount({
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'x',
                marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
              },
            ],
          },
        ],
      },
    })

    const html = editor.getHTML()

    expect(html).not.toContain('javascript')
    expect(html).toBe('<p><a rel="noopener noreferrer nofollow">x</a></p>')
  })

  it('refuses setLink with a dangerous URL', async () => {
    const editor = await mount({ content: '<p>metin</p>' })
    editor.commands.selectAll()

    const applied = editor.commands.setLink({ href: 'javascript:alert(1)' })

    expect(applied).toBe(false)
    expect(editor.getHTML()).toBe('<p>metin</p>')
  })

  it('sets, updates and removes a link on the selection', async () => {
    const editor = await mount({ content: '<p>metin</p>' })
    editor.commands.selectAll()

    editor.commands.setLink({ href: 'https://viveeditor.dev' })
    const linked = editor.getHTML()
    editor.commands.unsetLink()

    expect(linked).toBe(
      '<p><a rel="noopener noreferrer nofollow" href="https://viveeditor.dev">metin</a></p>',
    )
    expect(editor.getHTML()).toBe('<p>metin</p>')
  })

  it('opens links in a new tab only when configured', async () => {
    const editor = await mount({
      extensions: [Link.configure({ openInNewTab: true })],
      content: '<p><a href="https://a.test">x</a></p>',
    })

    const html = editor.getHTML()

    expect(html).toBe(
      '<p><a rel="noopener noreferrer nofollow" href="https://a.test" target="_blank">x</a></p>',
    )
  })
})

describe('block commands', () => {
  it('toggles a heading level on and back to a paragraph', async () => {
    const editor = await mount({ content: '<p>başlık</p>' })

    editor.commands.toggleHeading({ level: 2 })
    const asHeading = editor.getHTML()
    editor.commands.toggleHeading({ level: 2 })

    expect(asHeading).toBe('<h2>başlık</h2>')
    expect(editor.isActive('paragraph')).toBe(true)
    expect(editor.getHTML()).toBe('<p>başlık</p>')
  })

  it('maps disallowed heading levels to the closest allowed one', async () => {
    const editor = await mount({
      extensions: [Heading.configure({ levels: [2, 3] })],
      content: '<h1>a</h1><h6>b</h6>',
    })

    const html = editor.getHTML()

    expect(html).toBe('<h2>a</h2><h3>b</h3>')
    expect(editor.can.toggleHeading({ level: 1 })).toBe(false)
  })

  it('wraps a paragraph in a blockquote and lifts it out again', async () => {
    const editor = await mount({ content: '<p>söz</p>' })

    editor.commands.toggleBlockquote()
    const quoted = editor.getHTML()
    editor.commands.toggleBlockquote()

    expect(quoted).toBe('<blockquote><p>söz</p></blockquote>')
    expect(editor.getHTML()).toBe('<p>söz</p>')
  })

  it('inserts a horizontal rule followed by an empty paragraph', async () => {
    const editor = await mount({ content: '<p>önce</p>' })

    const inserted = editor.commands.setHorizontalRule()

    expect(inserted).toBe(true)
    expect(editor.getHTML()).toBe('<p>önce</p><hr><p></p>')
  })

  it('inserts a hard break inside a paragraph', async () => {
    const editor = await mount({ content: '<p>a</p>' })

    editor.commands.setHardBreak()

    expect(editor.getHTML()).toBe('<p><br>a</p>')
  })
})
