import { afterEach, describe, expect, it } from 'vitest'
import { classicPreset, Editor } from '../src/index.js'

const WORD_HEAD = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta name=Generator content="Microsoft Word 15"><style><!--
p.MsoNormal {margin:0cm;}
--></style></head><body lang=TR><!--StartFragment-->`
const WORD_TAIL = '<!--EndFragment--></body></html>'

const DOCS = (body: string): string =>
  `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1a2b3c4d">${body}</b><br class="Apple-interchange-newline">`

let editors: Editor[] = []

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

async function pasted(html: string): Promise<string> {
  const host = document.createElement('div')
  document.body.append(host)
  const editor = await Editor.create(host, { extensions: classicPreset('tr') })
  editors.push(editor)
  const view = (
    editor as unknown as { view: { pasteHTML(html: string, event: ClipboardEvent): boolean } }
  ).view
  view.pasteHTML(html, new Event('paste') as ClipboardEvent)
  return editor.getHTML().replace(/;"/g, '"')
}

describe('pasting from Word', () => {
  it('keeps point sizes from the list and Word line heights the editor offers', async () => {
    const html = await pasted(
      `${WORD_HEAD}<p class=MsoNormal>önce<o:p></o:p></p><p class=MsoNormal style='line-height:150%'><span style='font-size:14.0pt'>büyük</span> <span style='font-size:13.3pt'>yuvarlanan</span> <span style='font-size:200.0pt'>dev</span><o:p></o:p></p><p class=MsoNormal style='line-height:107%'>tek<o:p></o:p></p>${WORD_TAIL}`,
    )

    expect(html).toBe(
      '<p>önce</p><p style="line-height: 1.5"><span style="font-size: 14pt">büyük</span> yuvarlanan dev</p><p>tek</p>',
    )
  })

  it('maps Word font stacks to the list entry with the same first name and drops the rest', async () => {
    const html = await pasted(
      `${WORD_HEAD}<p class=MsoNormal><span style='font-family:"Georgia",serif'>georgia</span> <span style='font-family:"Times New Roman",serif'>times</span> <span style='font-family:Calibri,sans-serif;mso-ascii-theme-font:minor-latin'>calibri</span> <span style='font-family:"Courier New", Courier, monospace'>kod</span><o:p></o:p></p>${WORD_TAIL}`,
    )

    expect(html).toBe(
      `<p><span style="font-family: Georgia, serif">georgia</span> <span style="font-family: 'Times New Roman', Times, serif">times</span> calibri <span style="font-family: 'Courier New', Courier, monospace">kod</span></p>`,
    )
  })

  it('keeps cell shading but not Word borders or padding', async () => {
    const html = await pasted(
      `${WORD_HEAD}<table class=MsoTableGrid border=1 cellspacing=0 cellpadding=0 style='border-collapse:collapse;border:none'><tr><td width=100 valign=top style='width:75pt;border:solid windowtext 1.0pt;background:#D9E2F3;padding:0cm 5.4pt 0cm 5.4pt'><p class=MsoNormal>gölge<o:p></o:p></p></td><td width=100 valign=bottom style='width:75pt;border:solid windowtext 1.0pt;border-left:none;padding:0cm 5.4pt'><p class=MsoNormal align=center style='text-align:center'>alt<o:p></o:p></p></td></tr></table>${WORD_TAIL}`,
    )

    expect(html).toMatch(/<td style="background-color: (#d9e2f3|rgb\(217, 226, 243\))">/)
    expect(html).toContain('vertical-align: bottom')
    expect(html).not.toMatch(/border|padding|windowtext/)
  })
})

describe('pasting from Google Docs', () => {
  it('keeps list styles the schema knows and drops unknown ones', async () => {
    const html = await pasted(
      DOCS(
        '<ul style="margin-top:0;margin-bottom:0;"><li dir="ltr" style="list-style-type:square;font-size:11pt;"><p dir="ltr" style="line-height:1.38;margin-top:0pt;"><span style="font-size:11pt;font-family:Arial,sans-serif;">kare</span></p></li></ul><ol style="margin-top:0;margin-bottom:0;list-style-type:lower-roman"><li dir="ltr"><p dir="ltr">roma</p></li></ol><ul style="list-style-type:\'-\'"><li><p>tire</p></li></ul>',
      ),
    )

    expect(html).toContain('<ol type="i"><li><p>roma</p></li></ol>')
    expect(html).toContain('<ul><li><p>tire</p></li></ul>')
    expect(html).not.toContain('line-height: 1.38')
    expect(html).toContain('<span style="font-family: Arial, Helvetica, sans-serif">kare</span>')
  })

  it('keeps point sizes and drops a quoted family that is not in the list', async () => {
    const html = await pasted(
      DOCS(
        '<p dir="ltr">önce</p><p dir="ltr" style="line-height:1.5;"><span style="font-size:16pt;font-family:\'Roboto Slab\',serif;color:#000000;">başlık</span><span style="font-size:10.5pt;font-family:Georgia, serif;">metin</span></p>',
      ),
    )

    expect(html).toBe(
      '<p>önce</p><p style="line-height: 1.5"><span style="font-size: 16pt">başlık</span><span style="font-size: 10.5pt"><span style="font-family: Georgia, serif">metin</span></span></p>',
    )
  })
})
