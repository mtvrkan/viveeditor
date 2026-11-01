import { Editor, type Extension } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { CodeBlock } from '@viveeditor/ext-code-block'
import { Embed } from '@viveeditor/ext-embed'
import { Footnote } from '@viveeditor/ext-footnote'
import { formatExtensions } from '@viveeditor/ext-format'
import { Image } from '@viveeditor/ext-image'
import { listExtensions } from '@viveeditor/ext-list'
import { MathExtension } from '@viveeditor/ext-math'
import { Mention } from '@viveeditor/ext-mention'
import { Table } from '@viveeditor/ext-table'
import { taskListExtensions } from '@viveeditor/ext-task-list'
import { afterEach, describe, expect, it } from 'vitest'
import { MAX_MARKDOWN_LENGTH, markdownToHtml, toMarkdown } from '../src/index.js'
import { looksLikeMarkdown } from '../src/paste.js'

const rich: readonly Extension[] = [
  ...basicExtensions,
  ...listExtensions,
  ...formatExtensions,
  ...taskListExtensions,
  CodeBlock,
  Table,
  Image,
  Embed,
]
let editors: Editor[] = []

async function editorWith(content: string, extensions = rich): Promise<Editor> {
  const root = document.createElement('div')
  document.body.append(root)
  const editor = await Editor.create(root, { extensions, content })
  editors.push(editor)
  return editor
}

async function load(markdown: string, extensions = rich): Promise<Editor> {
  return editorWith(markdownToHtml(markdown), extensions)
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('markdownToHtml', () => {
  it('turns headings, marks, links and nested lists into editor content', async () => {
    const editor = await load(
      '# Başlık\n\n**kalın** _italik_ ~~eski~~ `kod` [bağlantı](https://example.com)\n\n- bir\n  - iki\n\n3. üç\n4. dört\n',
    )

    expect(editor.getHTML()).toBe(
      '<h1>Başlık</h1><p><strong>kalın</strong> <em>italik</em> <s>eski</s> <code>kod</code> <a rel="noopener noreferrer nofollow" href="https://example.com">bağlantı</a></p><ul><li><p>bir</p><ul><li><p>iki</p></li></ul></li></ul><ol start="3"><li><p>üç</p></li><li><p>dört</p></li></ol>',
    )
  })

  it('reads task lists, fenced code with a language and GFM tables', async () => {
    const editor = await load(
      '- [x] bitti\n- [ ] kaldı\n\n```js\nconst a = 1\n```\n\n| Ad | Yaş |\n| --- | --- |\n| Ali | 30 |\n',
    )
    const html = editor.getHTML()

    expect(html).toContain('<ul data-type="taskList"><li data-type="taskItem" data-checked="true">')
    expect(html).toContain('<div><p>bitti</p></div>')
    expect(html).toContain('data-checked="false"')
    expect(html).toContain(
      '<pre data-language="js"><code class="language-js">const a = 1</code></pre>',
    )
    expect(html).toContain('<th')
    expect(html).toContain('<p>Ali</p>')
  })

  it('keeps raw HTML and unsafe links out of the document', async () => {
    const editor = await load(
      '<script>alert(1)</script>\n\n[tıkla](javascript:alert(1)) <img src=x onerror=alert(1)>\n\n![](data:image/svg+xml;base64,PHN2Zz4=)',
    )
    const html = editor.getHTML()

    expect(html).not.toContain('<script')
    expect(html).not.toContain('href="javascript:')
    expect(html).not.toContain('onerror="')
    expect(html).not.toContain('<img')
  })

  it('leaves a list with mixed task and plain items as a plain list', async () => {
    const editor = await load('- [ ] görev\n- düz madde\n')

    expect(editor.getHTML()).toBe('<ul><li><p>[ ] görev</p></li><li><p>düz madde</p></li></ul>')
  })

  it('refuses input longer than the limit', () => {
    expect(() => markdownToHtml('a'.repeat(MAX_MARKDOWN_LENGTH + 1))).toThrow(RangeError)
  })
})

describe('toMarkdown', () => {
  it('writes a long document in linear time', async () => {
    const fastest = async (count: number): Promise<number> => {
      const paragraphs = Array.from(
        { length: count },
        (_, index) =>
          `<p>Satır ${index} için biraz daha uzun bir metin, <strong>kalın bir parça</strong>, <em>eğik bir parça</em> ve <code>kod</code> içerir.</p>`,
      )
      const editor = await editorWith(paragraphs.join(''), basicExtensions)
      let best = Number.POSITIVE_INFINITY
      for (let round = 0; round < 3; round++) {
        const started = performance.now()
        const markdown = toMarkdown(editor)
        best = Math.min(best, performance.now() - started)
        expect(markdown.split('\n\n')).toHaveLength(count)
      }
      return best
    }
    await fastest(500)

    const small = await fastest(4_000)
    const large = await fastest(16_000)

    expect(large).toBeLessThan(small * 10)
  }, 60_000)

  it('writes the document as Markdown that reads back into the same document', async () => {
    const source = [
      '<h2>Başlık</h2>',
      '<p><strong>kalın</strong> <em>italik</em> <s>eski</s> <a href="https://example.com">link</a></p>',
      '<ul><li><p>bir</p><ul><li><p>iki</p></li></ul></li></ul>',
      '<ol start="2"><li><p>iki</p></li><li><p>üç</p></li></ol>',
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><div><p>bitti</p></div></li></ul>',
      '<pre><code class="language-ts">let x = 1\n```\nson</code></pre>',
      '<blockquote><p>alıntı</p></blockquote>',
    ].join('')
    const editor = await editorWith(source)

    const markdown = toMarkdown(editor)
    const reloaded = await load(markdown)

    expect(markdown).toContain('- [x] bitti')
    expect(markdown).toContain('````ts')
    expect(reloaded.getHTML()).toBe(editor.getHTML())
  })

  it('keeps adjacent lists, a block image and entity-like text apart after a round trip', async () => {
    const editor = await editorWith(
      [
        '<ol><li><p>bir</p></li></ol><ol start="5"><li><p>beş</p></li></ol>',
        '<ul><li><p>madde</p></li></ul><ul data-type="taskList"><li data-type="taskItem" data-checked="false"><div><p>iş</p></div></li></ul>',
        '<img src="https://example.com/a.png" alt="g"><p>Ali &amp;amp; Veli</p>',
      ].join(''),
    )

    const markdown = toMarkdown(editor)
    const reloaded = await load(markdown)

    expect(markdown).toContain('5) beş')
    expect(markdown).toContain('* [ ] iş')
    expect(markdown).toContain('Ali \\&amp; Veli')
    expect(reloaded.getHTML()).toBe(editor.getHTML())
  })

  it('writes empty task items and list items that start with a block', async () => {
    const editor = await editorWith(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><div><p></p></div></li></ul><ol><li><p></p><img src="https://example.com/a.png" alt="g"></li></ol>',
    )

    const markdown = toMarkdown(editor)
    const reloaded = await load(markdown)

    expect(markdown).toContain('- [x]')
    expect(reloaded.getHTML()).toBe(editor.getHTML())
  })

  it('writes tables with merged cells as a padded GFM table', async () => {
    const editor = await editorWith(
      '<table><tbody><tr><th><p>A</p></th><th><p>B | C</p></th></tr><tr><td colspan="2"><p>geniş</p></td></tr></tbody></table>',
    )

    expect(toMarkdown(editor)).toBe('| A | B \\| C |\n| --- | --- |\n| geniş |  |')
  })

  it('drops formatting Markdown cannot express and turns players into links', async () => {
    const editor = await editorWith(
      '<p><u>altı</u> <span style="color: #ff0000">kırmızı</span></p><div data-embed="youtube" data-id="dQw4w9WgXcQ" data-title="Tanıtım"></div>',
    )

    expect(toMarkdown(editor)).toBe(
      'altı kırmızı\n\n[Tanıtım](https://www.youtube.com/watch?v=dQw4w9WgXcQ)',
    )
  })

  it('writes mentions as escaped text and footnotes as numbered references', async () => {
    const editor = await editorWith(
      '<p><span data-mention="u_1">@*Ayşe*</span> dedi<sup data-footnote="">ilk <strong>not</strong></sup> ve<sup data-footnote="">ikinci</sup></p>',
      [...rich, Mention, Footnote],
    )

    expect(toMarkdown(editor)).toBe(
      '@\\*Ayşe\\* dedi[^1] ve[^2]\n\n[^1]: ilk **not**\n\n[^2]: ikinci',
    )
  })

  it('writes formulas as dollar math with angle brackets turned into commands', async () => {
    const editor = await editorWith(
      '<p>a <span data-math="inline">x&lt;y</span> b</p><div data-math="block">\\sum_i a_i > 0</div>',
      [...rich, MathExtension],
    )

    expect(toMarkdown(editor)).toBe('a $x\\lt y$ b\n\n$$\n\\sum_i a_i \\gt  0\n$$')
  })

  it('falls back to code when a formula cannot be written between dollar signs', async () => {
    const editor = await editorWith(
      '<p><span data-math="inline">\\$5 `a`</span></p><div data-math="block">a\n$$\nb</div>',
      [...rich, MathExtension],
    )

    expect(toMarkdown(editor)).toBe('`` \\$5 `a` ``\n\n```math\na\n$$\nb\n```')
  })

  it('serializes nodes it does not know as their text', async () => {
    const editor = await editorWith('<p>yalnız metin</p>', basicExtensions)

    expect(toMarkdown(editor)).toBe('yalnız metin')
  })
})

describe('looksLikeMarkdown', () => {
  it('recognises headings, fences, tables, bold and multi-line lists', () => {
    expect(looksLikeMarkdown('# Başlık')).toBe(true)
    expect(looksLikeMarkdown('```\nkod\n```')).toBe(true)
    expect(looksLikeMarkdown('| a | b |\n| --- | --- |')).toBe(true)
    expect(looksLikeMarkdown('bu **önemli**')).toBe(true)
    expect(looksLikeMarkdown('- bir\n- iki')).toBe(true)
  })

  it('leaves ordinary prose and a single numbered line alone', () => {
    expect(looksLikeMarkdown('Merhaba dünya, bugün 3. gün.')).toBe(false)
    expect(looksLikeMarkdown('1. madde')).toBe(false)
    expect(looksLikeMarkdown('a * b * c')).toBe(false)
  })

  it.each([
    ['blank lines', '\n'.repeat(200_000)],
    ['blank lines after a marker', `-${'\n'.repeat(200_000)}`],
    ['open brackets', '['.repeat(200_000)],
    ['open link targets', '[a]('.repeat(50_000)],
    ['spaced pipes', '| '.repeat(100_000)],
  ])('answers quickly for %s', (_name, text) => {
    const started = performance.now()

    looksLikeMarkdown(text)

    expect(performance.now() - started).toBeLessThan(200)
  })

  it('leaves text longer than the Markdown limit alone', () => {
    const text = `# Başlık\n${'a'.repeat(MAX_MARKDOWN_LENGTH)}`

    expect(looksLikeMarkdown(text)).toBe(false)
  })
})
