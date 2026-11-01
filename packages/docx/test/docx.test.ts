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
import { strToU8, unzipSync, zipSync } from 'fflate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DocxError, exportDocx, importDocx } from '../src/index.js'
import { escapeXml } from '../src/write.js'

const rich: readonly Extension[] = [
  ...basicExtensions,
  ...listExtensions,
  ...formatExtensions,
  ...taskListExtensions,
  CodeBlock,
  Table,
  Image.configure({ allowBase64: true }),
  Embed,
]
const PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4z8DwHwyBNAMAQPAH+Vb3dZQAAAAASUVORK5CYII=',
  ),
  (character) => character.charCodeAt(0),
)
const PNG_DATA = `data:image/png;base64,${btoa(String.fromCharCode(...PNG))}`
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
let editors: Editor[] = []

async function editorWith(content: string, extensions = rich): Promise<Editor> {
  const root = document.createElement('div')
  document.body.append(root)
  const editor = await Editor.create(root, { extensions, content })
  editors.push(editor)
  return editor
}

function docx(body: string, relationships = '', extra: Record<string, Uint8Array> = {}): Blob {
  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types/>'),
    '_rels/.rels': strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`,
    ),
    'word/document.xml': strToU8(
      `<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}</w:body></w:document>`,
    ),
    'word/_rels/document.xml.rels': strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`,
    ),
    ...extra,
  }
  return new Blob([zipSync(files) as BlobPart])
}

const link = (id: string, target: string): string =>
  `<Relationship Id="${id}" Type="${R}/hyperlink" Target="${target}" TargetMode="External"/>`

const run = (text: string, properties = ''): string =>
  `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise
  } catch (error) {
    return error instanceof DocxError ? error.code : String(error)
  }
  return 'resolved'
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('exportDocx and importDocx', () => {
  it('reads back the document it wrote for the supported content', async () => {
    const source = [
      '<h1>Başlık</h1>',
      '<h3 style="text-align: center">Ortada</h3>',
      '<p><strong>kalın</strong> <em>italik</em> <u>altı</u> <s>eski</s> <span style="color: #c00000">kırmızı</span> <mark style="background-color: #ffff00">sarı</mark> <a href="https://example.com/a?b=1&amp;c=2">bağlantı</a></p>',
      '<ul><li><p>bir</p><ul><li><p>iki</p></li></ul></li><li><p>üç</p></li></ul>',
      '<ol start="4"><li><p>dört</p></li><li><p>beş</p><p>devamı</p></li></ol>',
      '<blockquote><p>alıntı</p></blockquote>',
      '<pre><code>satır 1\nsatır 2</code></pre>',
      '<table><tbody><tr><th><p>A</p></th><th><p>B</p></th><th><p>C</p></th></tr><tr><td colspan="2"><p>geniş</p></td><td rowspan="2"><p>uzun</p></td></tr><tr><td><p>x</p></td><td><p>y</p></td></tr></tbody></table>',
      '<p>son<br>satır</p>',
    ].join('')
    const editor = await editorWith(source)

    const file = await exportDocx(editor)
    const result = await importDocx(file)
    const reloaded = await editorWith(result.html)

    expect(reloaded.getHTML()).toBe(editor.getHTML())
    expect(result.warnings).toEqual([])
  })

  it('writes check boxes, players and code marks as plain Word content', async () => {
    const editor = await editorWith(
      '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><div><p>bitti</p></div></li></ul><div data-embed="youtube" data-id="dQw4w9WgXcQ" data-title="Tanıtım"></div><p><code>kod</code></p>',
    )

    const result = await importDocx(await exportDocx(editor))

    expect(result.html).toContain('☑ bitti')
    expect(result.html).toContain(
      '<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Tanıtım</a>',
    )
    expect(result.html).toContain('kod')
  })

  it('embeds data URL images and hands them to the uploader under a fixed name', async () => {
    const editor = await editorWith(`<img src="${PNG_DATA}" alt="nokta" width="20" height="10">`)
    const upload = vi.fn(async (file: File) => {
      expect(file.name).toBe('image-1.png')
      expect(file.type).toBe('image/png')
      return 'https://cdn.example.com/nokta.png'
    })

    const file = await exportDocx(editor)
    const parts = unzipSync(new Uint8Array(await file.arrayBuffer()))
    const result = await importDocx(file, { upload })

    expect(Object.keys(parts)).toContain('word/media/image1.png')
    expect(upload).toHaveBeenCalledTimes(1)
    expect(result.html).toBe(
      '<p><img alt="nokta" width="20" height="10" src="https://cdn.example.com/nokta.png"></p>',
    )
  })

  it('drops images when there is no uploader and base64 is not allowed', async () => {
    const editor = await editorWith(`<img src="${PNG_DATA}" alt="nokta">`)

    const result = await importDocx(await exportDocx(editor))

    expect(result.html).not.toContain('<img')
    expect(result.warnings).toEqual([{ code: 'IMAGE_DROPPED', count: 1 }])
  })

  it('writes mentions as text, formulas as code and footnotes as numbered notes at the end', async () => {
    const editor = await editorWith(
      '<p><span data-mention="u_1">@Ayşe</span> <span data-math="inline">x^2</span> son<sup data-footnote="">bir <em>not</em></sup></p><div data-math="block">a\nb</div>',
      [...rich, Mention, MathExtension, Footnote],
    )

    const parts = unzipSync(new Uint8Array(await (await exportDocx(editor)).arrayBuffer()))
    const document = new TextDecoder().decode(parts['word/document.xml'])
    const result = await importDocx(new Blob([zipSync(parts) as BlobPart]))

    expect(document).toContain(
      '<w:rStyle w:val="CodeChar"/></w:rPr><w:t xml:space="preserve">x^2</w:t>',
    )
    expect(document).toContain(
      '<w:vertAlign w:val="superscript"/></w:rPr><w:t xml:space="preserve">1</w:t>',
    )
    expect(result.html).toContain('@Ayşe')
    expect(result.html).toMatch(/<pre><code>a\nb<\/code><\/pre>.*<p>1\. bir <em>not<\/em><\/p>$/)
  })

  it('keeps only valid XML characters and writes no author', async () => {
    const editor = await editorWith('<p>a\u0001b</p>')

    const file = await exportDocx(editor, { title: 'Rapor <1>' })
    const parts = unzipSync(new Uint8Array(await file.arrayBuffer()))
    const core = new TextDecoder().decode(parts['docProps/core.xml'])
    const document = new TextDecoder().decode(parts['word/document.xml'])

    expect(escapeXml('x\u0000<&>"\'\uFFFE')).toBe('x&lt;&amp;&gt;&quot;&apos;')
    expect(core).toContain('<dc:title>Rapor &lt;1&gt;</dc:title>')
    expect(core).not.toMatch(/creator|lastModifiedBy/)
    expect(document).toContain('>ab</w:t>')
  })
})

describe('importDocx with hostile files', () => {
  it('rejects a file that is not a zip', async () => {
    expect(await failure(importDocx(new Blob(['merhaba'])))).toBe('NOT_DOCX')
  })

  it('rejects a document type declaration before parsing it', async () => {
    const file = docx('<w:p/>')
    const bytes = unzipSync(new Uint8Array(await file.arrayBuffer()))
    bytes['word/document.xml'] = strToU8(
      `<!DOCTYPE x [<!ENTITY a "aaaa">]><w:document xmlns:w="${W}"><w:body/></w:document>`,
    )

    expect(await failure(importDocx(new Blob([zipSync(bytes) as BlobPart])))).toBe('UNSUPPORTED')
  })

  it('stops inflating a part that expands past its limit', async () => {
    const huge = strToU8(`<w:p>${'<w:r/>'.repeat(400_000)}</w:p>`)

    const code = await failure(
      importDocx(docx('', '', { 'word/styles.xml': huge }), { limits: { partBytes: 1024 } }),
    )

    expect(code).toBe('TOO_LARGE')
  })

  it('rejects a zip with two entries of the same name', async () => {
    const file = docxWithDuplicate()

    expect(await failure(importDocx(file))).toBe('DAMAGED')
  })

  it('keeps the text of links that are not absolute web or mail addresses', async () => {
    const targets = [
      'example.com',
      '//evil.test/x',
      'file:///etc/passwd',
      '\\\\server\\share',
      'javascript:alert(1)',
      'https://ok.example.com/',
    ]
    const relationships = targets.map((target, index) => link(`rId${index + 10}`, target)).join('')
    const body = targets
      .map(
        (_, index) =>
          `<w:p><w:hyperlink r:id="rId${index + 10}">${run(`l${index}`)}</w:hyperlink></w:p>`,
      )
      .join('')

    const result = await importDocx(docx(body, relationships))

    expect(result.html.match(/<a /g)).toHaveLength(1)
    expect(result.html).toContain('<a href="https://ok.example.com/">l5</a>')
    expect(result.html).toContain('<p>l0</p>')
    expect(result.warnings).toEqual([{ code: 'LINK_DROPPED', count: 5 }])
  })

  it('drops hidden, deleted and field-code text but keeps inserted text and field results', async () => {
    const body = `<w:p>${run('görünür ')}${run('gizli', '<w:vanish/>')}<w:del><w:r><w:delText>silindi</w:delText></w:r></w:del><w:ins>${run('eklendi ')}</w:ins><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>HYPERLINK "javascript:x"</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${run('sonuç')}<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`

    const result = await importDocx(docx(body))

    expect(result.html).toBe('<p>görünür eklendi sonuç</p>')
    expect(result.warnings).toEqual([{ code: 'HIDDEN_TEXT', count: 1 }])
  })

  it('names uploaded images itself and ignores the name stored in the file', async () => {
    const name = 'resim\u202Egnp.exe'
    const relationships = `<Relationship Id="rId5" Type="${R}/image" Target="media/${name}"/>`
    const body = `<w:p><w:r><w:drawing><wp:inline><wp:extent cx="190500" cy="95250"/><wp:docPr id="1" name="x" descr="nokta"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="rId5"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
    const upload = vi.fn(async (_file: File) => 'https://cdn.example.com/a.png')

    await importDocx(docx(body, relationships, { [`word/media/${name}`]: PNG }), { upload })

    expect(upload.mock.calls[0]?.[0]?.name).toBe('image-1.png')
  })

  it('stops when the signal is aborted', async () => {
    const controller = new AbortController()
    controller.abort()

    expect(await failure(importDocx(docx('<w:p/>'), { signal: controller.signal }))).toBe('ABORTED')
  })

  it('refuses tables with more cells than the limit', async () => {
    const row = `<w:tr>${'<w:tc><w:p/></w:tc>'.repeat(10)}</w:tr>`

    const code = await failure(
      importDocx(docx(`<w:tbl>${row.repeat(3)}</w:tbl>`), { limits: { cells: 20 } }),
    )

    expect(code).toBe('TOO_COMPLEX')
  })
})

describe('importDocx security regressions', () => {
  it('flattens deep tables without reading alternate or deleted content', async () => {
    const inner = `<w:p>${run('derin')}</w:p><mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice><w:p>${run('seçenek')}</w:p></mc:Choice></mc:AlternateContent><w:del><w:p>${run('silindi')}</w:p></w:del>`
    let table = inner
    for (let level = 0; level < 4; level++)
      table = `<w:tbl><w:tr><w:tc>${table}</w:tc></w:tr></w:tbl>`

    const result = await importDocx(docx(table))

    expect(result.html).toContain('derin')
    expect(result.html).not.toMatch(/seçenek|silindi/)
    expect(result.warnings).toContainEqual({ code: 'NESTING_FLATTENED', count: 1 })
  })

  it('refuses a table wider than the column limit', async () => {
    const cell = '<w:tc><w:tcPr><w:gridSpan w:val="63"/></w:tcPr><w:p/></w:tc>'

    expect(await failure(importDocx(docx(`<w:tbl><w:tr>${cell.repeat(2)}</w:tr></w:tbl>`)))).toBe(
      'TOO_COMPLEX',
    )
  })

  it('refuses a table whose rows times columns exceed the cell limit', async () => {
    const wide = `<w:tr>${'<w:tc><w:p/></w:tc>'.repeat(50)}</w:tr>`
    const narrow = '<w:tr><w:tc><w:p/></w:tc></w:tr>'

    const code = await failure(
      importDocx(docx(`<w:tbl>${wide}${narrow.repeat(5)}</w:tbl>`), { limits: { cells: 200 } }),
    )

    expect(code).toBe('TOO_COMPLEX')
  })

  it('drops images whose size cannot be read', async () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])
    const relationships = `<Relationship Id="rId5" Type="${R}/image" Target="media/a.jpg"/>`
    const body = `<w:p><w:r><w:drawing><wp:inline><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="rId5"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
    const upload = vi.fn(async () => 'https://cdn.example.com/a.jpg')

    const result = await importDocx(docx(body, relationships, { 'word/media/a.jpg': jpeg }), {
      upload,
    })

    expect(upload).not.toHaveBeenCalled()
    expect(result.warnings).toEqual([{ code: 'IMAGE_DROPPED', count: 1 }])
  })

  it('hides text hidden by a character style and ignores prototype keys', async () => {
    const styles = strToU8(
      `<w:styles xmlns:w="${W}"><w:style w:type="character" w:styleId="Gizli"><w:name w:val="Gizli"/><w:rPr><w:vanish/></w:rPr></w:style></w:styles>`,
    )
    const body = `<w:p><w:pPr><w:jc w:val="constructor"/></w:pPr>${run('açık ', '<w:highlight w:val="constructor"/>')}${run('gizli', '<w:rStyle w:val="Gizli"/>')}</w:p>`

    const result = await importDocx(docx(body, '', { 'word/styles.xml': styles }))

    expect(result.html).toBe('<p>açık </p>')
  })
})

describe('exportDocx with unexpected attributes', () => {
  it('writes valid XML for prototype-named attribute values', async () => {
    const editor = await editorWith('<p>a</p>')
    const json = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'constructor' },
          content: [{ type: 'text', text: 'a' }],
        },
        { type: 'embed', attrs: { provider: '__proto__', id: 'x', title: 'video' } },
        { type: 'embed', attrs: { provider: 'constructor', id: 'https://evil.test', title: 'v2' } },
      ],
    }

    const file = await exportDocx({ schema: editor.schema, getJSON: () => json })
    const parts = unzipSync(new Uint8Array(await file.arrayBuffer()))
    const document = new TextDecoder().decode(parts['word/document.xml'])

    expect(document).not.toMatch(/function|w:jc|evil/)
    expect(document).toContain('video')
  })
})

function docxWithDuplicate(): Blob {
  const bytes = zipSync({
    '_rels/.rels': strToU8('<Relationships/>'),
    '_rels/.relz': strToU8('<Relationships/>'),
  })
  const text = new TextDecoder('latin1').decode(bytes)
  const patched = text.replaceAll('_rels/.relz', '_rels/.rels')
  return new Blob([Uint8Array.from(patched, (character) => character.charCodeAt(0)) as BlobPart])
}
