import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { Footnote } from '@viveeditor/ext-footnote'
import { MathExtension } from '@viveeditor/ext-math'
import { Mention } from '@viveeditor/ext-mention'
import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from '../src/index.js'

const SOURCE = [
  '<p><span data-mention="user_42">@Ayşe Yılmaz</span> yazdı<sup data-footnote="">Kaynak: <strong>rapor</strong> <em>2026</em> <a href="https://example.com">bağlantı</a></sup>.</p>',
  '<p>Alan <span data-math="inline">\\pi r^2 &lt; 4</span> olur.</p>',
  '<div data-math="block">\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}</div>',
].join('')

async function editorHtml(content: string): Promise<string> {
  const host = document.createElement('div')
  document.body.append(host)
  const editor = await Editor.create(host, {
    extensions: [...basicExtensions, Mention, MathExtension, Footnote],
    content,
  })
  const html = editor.getHTML()
  editor.destroy()
  host.remove()
  return html
}

describe('editor output with mentions, formulas and footnotes', () => {
  it('passes through the sanitizer unchanged', async () => {
    const html = await editorHtml(SOURCE)

    const clean = sanitizeHtml(html)

    expect(html).toContain('class="vive-mention"')
    expect(html).toContain('data-math="block"')
    expect(html).toContain('<sup data-footnote="">')
    expect(clean).toBe(html)
  })

  it('loads back into the editor as the same document', async () => {
    const html = await editorHtml(SOURCE)

    const reloaded = await editorHtml(sanitizeHtml(html))

    expect(reloaded).toBe(html)
  })

  it('turns a mention with a forged id into plain text the editor keeps as text', async () => {
    const clean = sanitizeHtml(
      '<p><span class="vive-mention" data-mention="javascript:alert(1)">@x</span></p>',
    )

    const html = await editorHtml(clean)

    expect(clean).toBe('<p>@x</p>')
    expect(html).toBe('<p>@x</p>')
  })
})
