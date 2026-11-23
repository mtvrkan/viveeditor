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
      '<p>H<sub>2</sub>O ve x<sup>2</sup></p>',
      `<img src="${PNG_DATA}" alt="nokta" width="20" height="10">`,
      `<figure data-align="center"><img src="${PNG_DATA}" alt="orta" width="20" height="10"></figure>`,
      `<a href="https://example.com/resim"><img src="${PNG_DATA}" alt="bağlı" width="20" height="10"></a>`,
      '<p>son</p>',
    ].join('')
    const editor = await editorWith(source)

    const file = await exportDocx(editor)
    const result = await importDocx(file, { allowBase64: true })
    const reloaded = await editorWith(result.html)

    expect(reloaded.getHTML()).toBe(editor.getHTML())
    expect(result.warnings).toEqual([])
  })

  it('reads back cell colours and vertical alignment', async () => {
    const editor = await editorWith(
      '<table><tbody><tr><td style="background-color: #cde8ff; vertical-align: middle"><p>a</p></td><td style="vertical-align: bottom"><p>b</p></td><td><p>c</p></td></tr></tbody></table><p>son</p>',
    )

    const reloaded = await editorWith((await importDocx(await exportDocx(editor))).html)

    expect(reloaded.getHTML()).toBe(editor.getHTML())
  })

  it('writes an aligned image with its caption as a Caption paragraph', async () => {
    const editor = await editorWith(
      `<figure data-align="center"><img src="${PNG_DATA}" alt="nokta" width="20" height="10"><figcaption>Şekil 1</figcaption></figure>`,
    )

    const parts = unzipSync(new Uint8Array(await (await exportDocx(editor)).arrayBuffer()))
    const document = new TextDecoder().decode(parts['word/document.xml'])

    expect(document).toContain('<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing>')
    expect(document).toContain(
      '<w:p><w:pPr><w:pStyle w:val="Caption"/><w:jc w:val="center"/></w:pPr><w:r><w:t xml:space="preserve">Şekil 1</w:t></w:r></w:p>',
    )
    expect(new TextDecoder().decode(parts['word/styles.xml'])).toContain('w:styleId="Caption"')
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
      '<figure><img alt="nokta" width="20" height="10" src="https://cdn.example.com/nokta.png"></figure>',
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

  it('writes point sizes as half points and reads them back', async () => {
    const editor = await editorWith(
      '<p>düz <span style="font-size: 18pt">büyük</span> <span style="font-size: 10.5pt">küçük</span></p>',
    )

    const file = await exportDocx(editor)
    const xml = new TextDecoder().decode(
      unzipSync(new Uint8Array(await file.arrayBuffer()))['word/document.xml'],
    )
    const reloaded = await editorWith((await importDocx(file)).html)

    expect(xml).toContain('<w:sz w:val="36"/>')
    expect(xml).toContain('<w:sz w:val="21"/>')
    expect(reloaded.getHTML()).toBe(editor.getHTML())
  })

  it('writes the old size steps as points relative to the 11 pt default', async () => {
    const editor = await editorWith(
      '<p><span style="font-size: 0.75em">a</span> <span style="font-size: 0.875em">b</span> <span style="font-size: 1.25em">c</span> <span style="font-size: 1.5em">d</span></p>',
    )

    const result = await importDocx(await exportDocx(editor))

    expect(result.html.replace(/;"/g, '"')).toBe(
      '<p><span style="font-size: 8pt">a</span> <span style="font-size: 9.5pt">b</span> <span style="font-size: 14pt">c</span> <span style="font-size: 16.5pt">d</span></p>',
    )
  })

  it('reads a run size only when it differs from the paragraph or style default', async () => {
    const styles = strToU8(
      `<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="32"/></w:rPr></w:style></w:styles>`,
    )
    const body = [
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${run('başlık', '<w:sz w:val="32"/>')}${run(' iri', '<w:sz w:val="48"/>')}</w:p>`,
      `<w:p>${run('düz', '<w:sz w:val="24"/>')}${run(' büyük', '<w:sz w:val="29"/>')}${run(' dev', '<w:sz w:val="400"/>')}</w:p>`,
    ].join('')

    const result = await importDocx(docx(body, '', { 'word/styles.xml': styles }))

    expect(result.html.replace(/;"/g, '"')).toBe(
      '<h1>başlık<span style="font-size: 24pt"> iri</span></h1><p>düz<span style="font-size: 14.5pt"> büyük</span> dev</p>',
    )
  })
})

async function partsOf(file: Blob): Promise<Record<string, string>> {
  const parts = unzipSync(new Uint8Array(await file.arrayBuffer()))
  return Object.fromEntries(
    Object.entries(parts).map(([name, bytes]) => [name, new TextDecoder().decode(bytes)]),
  )
}

const numbering = (abstracts: string, nums: string): Uint8Array =>
  strToU8(`<w:numbering xmlns:w="${W}">${abstracts}${nums}</w:numbering>`)

const abstractNum = (id: number, format: string, texts: string[]): string =>
  `<w:abstractNum w:abstractNumId="${id}">${texts
    .map(
      (text, level) =>
        `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="${format}"/><w:lvlText w:val="${text}"/></w:lvl>`,
    )
    .join('')}</w:abstractNum>`

describe('Word formatting for the 1.0 tools', () => {
  it('reads back line height, fonts, link targets, list styles and table styles', async () => {
    const editor = await editorWith(
      [
        '<p style="line-height: 1.5">aralık <span style="font-family: Georgia, serif">gürcü</span> <span style="font-family: \'Times New Roman\', Times, serif">roma</span> <a href="https://example.com/yeni" target="_blank">yeni</a> <a href="https://example.com/eski">eski</a></p>',
        '<h2 style="line-height: 2">başlık</h2>',
        '<ol start="0" type="a"><li><p>sıfır</p></li></ol>',
        '<ol type="I"><li><p>bir</p></li></ol>',
        '<ul style="list-style-type: square"><li><p>kare</p><ul style="list-style-type: circle"><li><p>daire</p></li></ul></li></ul>',
        '<table data-width="full" data-align="center" data-border="rows" style="--vive-table-border-color: #aabbcc"><tbody><tr><td style="background-color: #cde8ff; vertical-align: middle"><p style="line-height: 1">a</p></td><td><p>b</p></td></tr></tbody></table>',
        '<p>son</p>',
      ].join(''),
    )

    const result = await importDocx(await exportDocx(editor))
    const reloaded = await editorWith(result.html)

    expect(reloaded.getHTML()).toBe(editor.getHTML())
    expect(result.warnings).toEqual([])
  })

  it('writes line height, fonts and link targets as Word properties', async () => {
    const editor = await editorWith(
      '<p style="line-height: 1.15; text-align: center"><span style="font-family: \'Courier New\', Courier, monospace">kod</span> <span style="font-family: serif">a</span> <span style="font-family: sans-serif">b</span> <span style="font-family: monospace">c</span> <a href="https://example.com/" target="_blank">git</a></p>',
    )

    const xml = (await partsOf(await exportDocx(editor)))['word/document.xml'] ?? ''

    expect(xml).toContain(
      '<w:pPr><w:spacing w:line="276" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>',
    )
    expect(xml).toContain(
      '<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>',
    )
    expect(xml).toContain(
      '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>',
    )
    expect(xml).toContain('<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>')
    expect(xml.match(/w:ascii="Courier New"/g)).toHaveLength(2)
    expect(xml).toMatch(/<w:hyperlink r:id="rId\d+" w:tgtFrame="_blank">/)
  })

  it('writes one numbering definition per list style and keeps a zero start', async () => {
    const editor = await editorWith(
      '<ol start="0" type="i"><li><p>a</p></li></ol><ol type="i"><li><p>b</p></li></ol><ol type="A"><li><p>c</p></li></ol><ul style="list-style-type: square"><li><p>d</p></li></ul><ul><li><p>e</p></li></ul>',
    )

    const xml = (await partsOf(await exportDocx(editor)))['word/numbering.xml'] ?? ''

    expect(xml.match(/<w:abstractNum /g)).toHaveLength(5)
    expect(xml).toContain(
      'w:abstractNumId="2"><w:multiLevelType w:val="hybridMultilevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="lowerRoman"/>',
    )
    expect(xml).toContain('<w:numFmt w:val="upperLetter"/>')
    expect(xml).toContain('<w:numFmt w:val="bullet"/><w:lvlText w:val="▪"/>')
    expect(xml).toContain('<w:startOverride w:val="0"/>')
    expect(xml.match(/<w:abstractNumId w:val="2"\/>/g)).toHaveLength(2)
    expect(xml).toContain('<w:num w:numId="5"><w:abstractNumId w:val="0"/></w:num>')
  })

  it('writes table width, alignment, borders, stripes and cell alignment', async () => {
    const editor = await editorWith(
      [
        '<table data-width="full" data-align="center" data-border="rows" style="--vive-table-border-color: #aabbcc"><tbody><tr><td style="text-align: right"><p>a</p><p style="text-align: center">b</p></td></tr></tbody></table><p>x</p>',
        '<table data-border="none" data-striped="true"><tbody><tr><th><p>h</p></th></tr><tr><td><p>1</p></td></tr><tr><td style="background-color: #cde8ff"><p>2</p></td></tr><tr><td><p>3</p></td></tr></tbody></table><p>y</p>',
        '<table style="--vive-table-border-color: #112233"><tbody><tr><td><p>z</p></td></tr></tbody></table>',
      ].join(''),
    )

    const xml = (await partsOf(await exportDocx(editor)))['word/document.xml'] ?? ''
    const nil = (name: string): string => `<w:${name} w:val="nil"/>`
    const line = (name: string, color: string): string =>
      `<w:${name} w:val="single" w:sz="4" w:space="0" w:color="${color}"/>`

    expect(xml).toContain(
      `<w:tblStyle w:val="TableGrid"/><w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/><w:tblBorders>${line('top', 'AABBCC')}${nil('left')}${line('bottom', 'AABBCC')}${nil('right')}${line('insideH', 'AABBCC')}${nil('insideV')}</w:tblBorders>`,
    )
    expect(xml).toContain(
      '<w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:t xml:space="preserve">a</w:t></w:r></w:p><w:p><w:pPr><w:jc w:val="center"/></w:pPr>',
    )
    expect(xml).toContain(
      `<w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map(nil).join('')}</w:tblBorders>`,
    )
    expect(xml.match(/w:fill="F2F2F2"/g)).toHaveLength(2)
    expect(xml).toContain('w:fill="CDE8FF"')
    expect(xml).toContain(line('insideV', '112233'))
    expect(xml).toContain('<w:p><w:r><w:t xml:space="preserve">x</w:t></w:r></w:p>')
  })

  it('reads back a striped table and keeps own cell colours', async () => {
    const editor = await editorWith(
      '<table data-striped="true" data-border="rows"><tbody><tr><th><p>h</p><p></p></th><th><p>i</p></th></tr><tr><td><p>1</p></td><td style="background-color: #cde8ff"><p>2</p></td></tr><tr><td><p>3</p></td><td><p>4</p></td></tr><tr><td><p>5</p></td><td><p>6</p></td></tr></tbody></table><p>son</p>',
    )

    const reloaded = await editorWith((await importDocx(await exportDocx(editor))).html)

    expect(reloaded.getHTML()).toBe(editor.getHTML())
    expect(reloaded.getHTML()).toContain('data-striped="true"')
  })

  it('keeps a lone light grey cell as a cell background', async () => {
    const cell = (fill: string): string =>
      `<w:tc>${fill ? `<w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${fill}"/></w:tcPr>` : ''}<w:p>${run('x')}</w:p></w:tc>`
    const row = (...fills: string[]): string => `<w:tr>${fills.map(cell).join('')}</w:tr>`
    const lone = `<w:tbl>${row('', '')}${row('F2F2F2', '')}</w:tbl>`
    const odd = `<w:tbl>${row('F2F2F2')}${row('F2F2F2')}</w:tbl>`

    const html = (await importDocx(docx(lone + odd))).html

    expect(html).not.toContain('data-striped')
    expect(html.match(/background-color: #F2F2F2/gi)).toHaveLength(3)
  })

  it('wraps a linked image in a hyperlink with its own relationship', async () => {
    const editor = await editorWith(
      `<a href="https://example.com/hedef"><img src="${PNG_DATA}" alt="nokta"></a>`,
    )

    const parts = await partsOf(await exportDocx(editor))

    expect(parts['word/document.xml']).toMatch(/<w:hyperlink r:id="(rId\d+)"><w:r><w:drawing>/)
    const id = /<w:hyperlink r:id="(rId\d+)"><w:r><w:drawing>/.exec(
      parts['word/document.xml'] ?? '',
    )?.[1]
    expect(parts['word/_rels/document.xml.rels']).toContain(
      `Id="${id}" Type="${R}/hyperlink" Target="https://example.com/hedef" TargetMode="External"`,
    )
  })

  it('reads table width, alignment, row borders and a consistent border colour', async () => {
    const edge = (name: string, value: string, color = 'AABBCC'): string =>
      value === 'nil'
        ? `<w:${name} w:val="nil"/>`
        : `<w:${name} w:val="${value}" w:color="${color}"/>`
    const table = (properties: string): string =>
      `<w:tbl><w:tblPr>${properties}</w:tblPr><w:tr><w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run('a')}</w:p><w:p><w:pPr><w:jc w:val="center"/></w:pPr>${run('b')}</w:p></w:tc></w:tr></w:tbl>`
    const body = [
      table(
        `<w:tblW w:w="5000" w:type="pct"/><w:jc w:val="center"/><w:tblBorders>${edge('top', 'single')}${edge('start', 'nil')}${edge('bottom', 'single')}${edge('end', 'nil')}${edge('insideH', 'single')}${edge('insideV', 'nil')}</w:tblBorders>`,
      ),
      table(
        `<w:tblW w:w="5000" w:type="dxa"/><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((name) => edge(name, 'nil')).join('')}</w:tblBorders>`,
      ),
      table(
        `<w:tblBorders>${edge('top', 'single')}${edge('left', 'single', 'auto')}${edge('bottom', 'single')}</w:tblBorders>`,
      ),
    ].join('')

    const html = (await importDocx(docx(body))).html

    expect(html).toContain(
      '<table data-width="full" data-align="center" data-border="rows" style="--vive-table-border-color: #aabbcc"><tbody><tr><td><p style="text-align: center;">a</p><p style="text-align: center;">b</p></td></tr></tbody></table>',
    )
    expect(html).toContain('<table data-border="none"><tbody>')
    expect(html).toMatch(/<table><tbody>.*<\/table>$/)
  })

  it('reads line height only for the four editor values', async () => {
    const paragraph = (spacing: string, text: string): string =>
      `<w:p><w:pPr>${spacing}</w:pPr>${run(text)}</w:p>`
    const body = [
      paragraph('<w:spacing w:before="120" w:line="360" w:lineRule="auto"/>', 'a'),
      paragraph('<w:spacing w:line="480"/>', 'b'),
      paragraph('<w:spacing w:line="300" w:lineRule="auto"/>', 'c'),
      paragraph('<w:spacing w:line="240" w:lineRule="exact"/>', 'd'),
    ].join('')

    const html = (await importDocx(docx(body))).html.replace(/;"/g, '"')

    expect(html).toBe(
      '<p style="line-height: 1.5">a</p><p style="line-height: 2">b</p><p>c</p><p>d</p>',
    )
  })

  it('reads fonts from the editor list, falling back from generic Word fonts', async () => {
    const font = (name: string): string => `<w:rFonts w:ascii="${name}" w:hAnsi="${name}"/>`
    const styles = strToU8(
      `<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr>${font('Verdana')}</w:rPr></w:rPrDefault></w:docDefaults></w:styles>`,
    )
    const body = `<w:p>${run('a', font('arial'))}${run('b', font('Georgia'))}${run('c', font('Comic Sans MS'))}${run('d', font('Verdana'))}</w:p>`
    const file = docx(body, '', { 'word/styles.xml': styles })

    const standard = (await importDocx(file)).html
    const custom = (await importDocx(file, { fontFamilies: ['serif', 'sans-serif', 'Georgia'] }))
      .html

    expect(standard).toBe(
      '<p><span style="font-family: Arial, Helvetica, sans-serif;">a</span><span style="font-family: Georgia, serif;">b</span>cd</p>',
    )
    expect(custom).toBe(
      '<p><span style="font-family: sans-serif;">a</span><span style="font-family: Georgia;">b</span>cd</p>',
    )
  })

  it('reads list formats, starts and uniform bullet glyphs', async () => {
    const item = (numId: number, text: string, ilvl = 0): string =>
      `<w:p><w:pPr><w:numPr><w:ilvl w:val="${ilvl}"/><w:numId w:val="${numId}"/></w:numPr></w:pPr>${run(text)}</w:p>`
    const extra = {
      'word/numbering.xml': numbering(
        [
          abstractNum(1, 'upperRoman', ['%1.']),
          abstractNum(2, 'bullet', ['◦', '◦']),
          abstractNum(3, 'bullet', ['•', '◦']),
          abstractNum(4, 'lowerLetter', ['%1.']),
        ].join(''),
        '<w:num w:numId="1"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="0"/></w:lvlOverride></w:num><w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num><w:num w:numId="3"><w:abstractNumId w:val="3"/></w:num><w:num w:numId="4"><w:abstractNumId w:val="4"/></w:num>',
      ),
    }

    const html = (
      await importDocx(docx(item(1, 'a') + item(2, 'b') + item(3, 'c') + item(4, 'd'), '', extra))
    ).html.replace(/;"/g, '"')

    expect(html).toBe(
      '<ol start="0" type="I"><li><p>a</p></li></ol><ul style="list-style-type: circle"><li><p>b</p></li></ul><ul><li><p>c</p></li></ul><ol type="a"><li><p>d</p></li></ol>',
    )
  })

  it('reads link targets and linked images through the link checks', async () => {
    const relationships = [
      link('rId7', 'https://example.com/a'),
      link('rId8', 'javascript:alert(1)'),
      link('rId9', 'https://example.com/b'),
      `<Relationship Id="rId5" Type="${R}/image" Target="media/a.png"/>`,
    ].join('')
    const drawing = `<w:r><w:drawing><wp:inline><wp:extent cx="190500" cy="95250"/><wp:docPr id="1" name="x" descr="nokta"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="rId5"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
    const body = `<w:p><w:hyperlink r:id="rId7" w:tgtFrame="_blank">${run('yeni')}</w:hyperlink><w:hyperlink r:id="rId9" w:tgtFrame="_top">${run('aynı')}</w:hyperlink></w:p><w:p><w:hyperlink r:id="rId9">${drawing}</w:hyperlink></w:p><w:p><w:hyperlink r:id="rId8">${drawing}</w:hyperlink></w:p>`

    const result = await importDocx(docx(body, relationships, { 'word/media/a.png': PNG }), {
      upload: async () => 'https://cdn.example.com/a.png',
    })
    const editor = await editorWith(result.html)

    expect(result.html).toContain('<a href="https://example.com/a" target="_blank">yeni</a>')
    expect(result.html).toContain('<a href="https://example.com/b">aynı</a>')
    const images = (editor.getJSON() as { content: { type: string; attrs: unknown }[] }).content
      .filter((node) => node.type === 'image')
      .map((node) => node.attrs)

    expect(images).toMatchObject([
      { href: 'https://example.com/b', src: 'https://cdn.example.com/a.png' },
      { href: null, src: 'https://cdn.example.com/a.png' },
    ])
    expect(result.warnings).toEqual([{ code: 'LINK_DROPPED', count: 1 }])
  })
})

describe('importDocx images in paragraphs', () => {
  const relationships = [
    link('rId7', 'https://example.com/hedef'),
    `<Relationship Id="rId5" Type="${R}/image" Target="media/a.png"/>`,
  ].join('')
  const drawing = `<w:r><w:drawing><wp:inline><wp:extent cx="190500" cy="95250"/><wp:docPr id="1" name="x" descr="nokta"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:blipFill><a:blip r:embed="rId5"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  const image =
    '<img src="https://cdn.example.com/a.png" alt="nokta" width="20" height="10" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
  const load = async (body: string): Promise<string> => {
    const result = await importDocx(docx(body, relationships, { 'word/media/a.png': PNG }), {
      upload: async () => 'https://cdn.example.com/a.png',
    })
    return (await editorWith(result.html)).getHTML()
  }

  it('reads an image-only paragraph as just the image, keeping its alignment', async () => {
    expect(await load(`<w:p>${drawing}</w:p>`)).toBe(image)
    expect(await load(`<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${drawing}</w:p>`)).toBe(
      `<figure data-align="center">${image}</figure>`,
    )
  })

  it('reads a linked image-only paragraph as just the linked image', async () => {
    expect(await load(`<w:p><w:hyperlink r:id="rId7">${drawing}</w:hyperlink></w:p>`)).toBe(
      `<a rel="noopener noreferrer nofollow" href="https://example.com/hedef">${image}</a>`,
    )
  })

  it('keeps the text around an image without empty paragraphs', async () => {
    expect(await load(`<w:p>${drawing}${run('sonra')}</w:p>`)).toBe(`${image}<p>sonra</p>`)
    expect(
      await load(`<w:p>${run('önce')}${drawing}${run(' ')}${drawing}${run('sonra')}</w:p>`),
    ).toBe(`<p>önce</p>${image}${image}<p>sonra</p>`)
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
