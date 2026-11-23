import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Footnote } from '@viveeditor/ext-footnote'
import { MathExtension } from '@viveeditor/ext-math'
import { Mention } from '@viveeditor/ext-mention'
import { toMarkdown } from '@viveeditor/markdown'
import { afterEach, describe, expect, it } from 'vitest'
import {
  classicPreset,
  Editor,
  type EditorContent,
  Embed,
  type JSONContent,
  SCHEMA_VERSION,
} from '../src/index.js'

const BASELINE = '0.1.0'
const FOLDER = resolve(process.cwd(), `../../tests/fixtures/compat/${BASELINE}`)
const WRITE = process.env.WRITE_COMPAT_BASELINE === BASELINE

const SOURCE = [
  '<h1 style="text-align: center">Başlık</h1>',
  '<h2>Alt başlık</h2>',
  '<h3 style="text-align: right">Üçüncü</h3>',
  '<p style="text-align: justify">Sağa <strong>kalın</strong> <em>italik</em> <u>altı</u> <s>üstü</s> <code>kod</code> <strong><em>ikisi</em></strong></p>',
  '<p><a href="https://example.com/a?b=1&amp;c=2" title="Örnek">bağlantı</a> <a href="/göreli">göreli</a> <a href="mailto:a@example.com">posta</a></p>',
  '<p><span style="color: #ff0000">kırmızı</span> <span style="color: rebeccapurple">mor</span> <mark style="background-color: #fff3a0">vurgu</mark></p>',
  '<p>satır<br>sonu</p>',
  '<p>&nbsp; iki baştaki boşluk, ortada   üç boşluk, kelime&nbsp;arası, sonda &nbsp;</p>',
  '<ul><li><p>bir</p><ul><li><p>iç</p></li></ul></li><li><p>iki</p></li></ul>',
  '<ol start="3"><li><p>üç</p></li><li><p>dört</p></li></ol>',
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>bitti</p></li><li data-type="taskItem" data-checked="false"><p>bekliyor</p></li></ul>',
  '<pre data-language="typescript"><code class="language-typescript">const a = 1 &lt; 2\n  return  a</code></pre>',
  '<pre><code>düz kod</code></pre>',
  '<blockquote><p>alıntı</p><p>ikinci satır</p></blockquote>',
  '<hr>',
  '<table><tbody><tr><th colspan="2" data-colwidth="120,80"><p>başlık</p></th></tr><tr><td><p>a</p></td><td><p>b</p></td></tr><tr><th><p>yan</p></th><td><p>c</p></td></tr></tbody></table>',
  '<img src="https://images.example.com/photo.jpg" alt="Fotoğraf" title="Başlık" width="640" height="480">',
  '<img src="https://images.example.com/decor.png" alt="">',
  '<img src="https://images.example.com/missing.png">',
  '<div class="vive-embed" data-embed="youtube" data-id="dQw4w9WgXcQ" data-start="42" data-title="Video"></div>',
  '<div class="vive-embed" data-embed="vimeo" data-id="76979871" data-hash="abcdef12"></div>',
  '<div class="vive-embed" data-embed="spotify" data-id="track:4uLU6hMCjMI75M1A2tKUQC"></div>',
  '<p><span data-mention="user_42">@Ayşe Yılmaz</span> yazdı<sup data-footnote="">Kaynak: <strong>rapor</strong> <em>2026</em> <a href="https://example.com">bağlantı</a></sup>.</p>',
  '<p>Alan <span data-math="inline">\\pi r^2 &lt; 4</span> olur.</p>',
  '<div data-math="block">\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}</div>',
].join('')

const FILES = {
  html: 'document.html',
  facade: 'document.facade.html',
  json: 'document.json',
  markdown: 'document.md',
} as const

let editors: Editor[] = []

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

async function open(content: EditorContent, facade = false): Promise<Editor> {
  const host = document.createElement('div')
  document.body.append(host)
  const extensions = [
    ...classicPreset('tr').map((extension) =>
      facade && extension.name === 'embed' ? Embed.configure({ facade: true }) : extension,
    ),
    Mention,
    MathExtension,
    Footnote,
  ]
  const editor = await Editor.create(host, { extensions, content })
  editors.push(editor)
  return editor
}

function baseline(name: keyof typeof FILES): string {
  return readFileSync(resolve(FOLDER, FILES[name]), 'utf8').trimEnd()
}

function baselineJson(): JSONContent {
  return JSON.parse(baseline('json')) as JSONContent
}

const ADDED_ATTRIBUTES: Record<string, Record<string, null | boolean>> = {
  paragraph: { indent: null, lineHeight: null },
  heading: { indent: null, lineHeight: null },
  image: { caption: null, align: null, href: null },
  table: { width: null, align: null, border: null, striped: false, borderColor: null },
  tableCell: { background: null, verticalAlign: null, textAlign: null },
  tableHeader: { background: null, verticalAlign: null, textAlign: null },
  orderedList: { type: null },
  bulletList: { bulletStyle: null },
}

const ADDED_MARK_ATTRIBUTES: Record<string, Record<string, null>> = {
  link: { target: null },
}

function withAdded<T extends { type?: string; attrs?: Record<string, unknown> }>(
  item: T,
  table: Record<string, Record<string, null | boolean>>,
): T {
  const added = item.type ? table[item.type] : undefined
  return added ? { ...item, attrs: { ...item.attrs, ...added } } : item
}

function withAddedAttributes(node: JSONContent): JSONContent {
  const content = node.content?.map(withAddedAttributes)
  const marks = node.marks?.map((mark) => withAdded(mark, ADDED_MARK_ATTRIBUTES))
  return {
    ...withAdded(node, ADDED_ATTRIBUTES),
    ...(marks && { marks }),
    ...(content && { content }),
  }
}

function currentJson(): JSONContent {
  return { ...withAddedAttributes(baselineJson()), schemaVersion: SCHEMA_VERSION }
}

describe.runIf(WRITE)(`write the ${BASELINE} baseline`, () => {
  it('stores the documents written by this version', async () => {
    const editor = await open(SOURCE)
    const facade = await open(SOURCE, true)
    mkdirSync(FOLDER, { recursive: true })
    writeFileSync(resolve(FOLDER, FILES.html), `${editor.getHTML()}\n`)
    writeFileSync(resolve(FOLDER, FILES.facade), `${facade.getHTML()}\n`)
    writeFileSync(resolve(FOLDER, FILES.json), `${JSON.stringify(editor.getJSON(), null, 2)}\n`)
    writeFileSync(resolve(FOLDER, FILES.markdown), `${toMarkdown(editor)}\n`)
    writeFileSync(resolve(FOLDER, 'source.html'), `${SOURCE}\n`)

    expect(existsSync(resolve(FOLDER, FILES.json))).toBe(true)
  })
})

describe.skipIf(WRITE)(`documents written by ${BASELINE}`, () => {
  it('keeps the baseline covering every feature', () => {
    const html = baseline('html')

    for (const marker of [
      'data-type="taskList"',
      'data-language="typescript"',
      'data-colwidth',
      'data-embed="vimeo"',
      'class="vive-mention"',
      'data-math="block"',
      'data-footnote',
      '&nbsp;',
      'text-align: justify',
    ]) {
      expect(html).toContain(marker)
    }
  })

  it('parses the same source into the same HTML', async () => {
    const editor = await open(readFileSync(resolve(FOLDER, 'source.html'), 'utf8').trimEnd())

    expect(editor.getHTML()).toBe(baseline('html'))
  })

  it('loads saved HTML and writes it back unchanged', async () => {
    const editor = await open(baseline('html'))

    expect(editor.getHTML()).toBe(baseline('html'))
  })

  it('loads saved HTML with embed facades and writes it back unchanged', async () => {
    const editor = await open(baseline('facade'), true)

    expect(editor.getHTML()).toBe(baseline('facade'))
  })

  it('loads saved JSON into the same document', async () => {
    const editor = await open(baselineJson())

    expect(editor.getJSON()).toEqual(currentJson())
    expect(editor.getHTML()).toBe(baseline('html'))
  })

  it('reads saved HTML into the same JSON', async () => {
    const editor = await open(baseline('html'))

    expect(editor.getJSON()).toEqual(currentJson())
  })

  it('exports the same Markdown', async () => {
    const editor = await open(baselineJson())

    expect(toMarkdown(editor)).toBe(baseline('markdown'))
  })
})
