import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { listExtensions } from '@viveeditor/ext-list'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanOfficeHtml, detectOffice, OfficePaste } from '../src/index.js'

const WORD_HEAD = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta name=Generator content="Microsoft Word 15"><style><!--
p.MsoNormal {margin:0cm;}
@list l0 {mso-list-id:1;}
@list l0:level1 {mso-level-number-format:bullet; mso-level-text:\\F0B7;}
@list l0:level2 {mso-level-number-format:bullet; mso-level-text:o;}
@list l0:level3 {mso-level-number-format:bullet; mso-level-text:\\F0A7;}
@list l1:level1 {mso-level-tab-stop:none; mso-level-number-position:left;}
@list l1:level2 {mso-level-number-format:alpha-lower;}
@list l2:level1 {mso-level-start-at:4;}
--></style></head><body lang=TR><!--StartFragment-->`
const WORD_TAIL = '<!--EndFragment--></body></html>'

function wordItem(list: string, level: number, marker: string, html: string): string {
  return `<p class=MsoListParagraphCxSpMiddle style='margin-left:${level * 36}pt;text-indent:-18pt;mso-list:${list} level${level} lfo1'><![if !supportLists]><span style='font-family:Symbol'><span style='mso-list:Ignore'>${marker}<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;</span></span></span><![endif]>${html}<o:p></o:p></p>`
}

const word = (body: string): string => `${WORD_HEAD}${body}${WORD_TAIL}`

let editors: Editor[] = []

async function editorWith(extensions = [OfficePaste]): Promise<Editor> {
  const root = document.createElement('div')
  document.body.append(root)
  const editor = await Editor.create(root, {
    extensions: [...basicExtensions, ...listExtensions, ...extensions],
  })
  editors.push(editor)
  return editor
}

const viewOf = (editor: Editor): EditorView => (editor as unknown as { view: EditorView }).view

function paste(editor: Editor, html: string): void {
  viewOf(editor).pasteHTML(html, new Event('paste') as ClipboardEvent)
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('detectOffice', () => {
  it('recognises Word, Google Docs and LibreOffice and leaves other HTML alone', () => {
    expect(detectOffice(word(''))).toBe('word')
    expect(detectOffice('<b id="docs-internal-guid-1a2b"><p>x</p></b>')).toBe('docs')
    expect(detectOffice('<meta name="generator" content="LibreOffice 25.2"><p>x</p>')).toBe(
      'libreoffice',
    )
    expect(detectOffice('<p class="note">x</p>')).toBeNull()
    expect(cleanOfficeHtml('<p class="note">x</p>')).toBe('<p class="note">x</p>')
  })
})

describe('cleanOfficeHtml for Word', () => {
  it('turns fake bullets on three levels into nested lists', () => {
    const html = word(
      wordItem('l0', 1, '·', 'Bir') +
        wordItem('l0', 2, 'o', 'İki') +
        wordItem('l0', 3, '§', 'Üç') +
        wordItem('l0', 1, '·', 'Dört'),
    )

    expect(cleanOfficeHtml(html)).toBe(
      '<ul><li><p>Bir</p><ul><li><p>İki</p><ul><li><p>Üç</p></li></ul></li></ul></li><li><p>Dört</p></li></ul>',
    )
  })

  it('reads numbered lists from the list styles and keeps the start number', () => {
    const html = word(
      wordItem('l1', 1, '1.', 'Giriş') +
        wordItem('l1', 2, 'a.', 'Kapsam') +
        `<p class=MsoNormal>Ara metin</p>` +
        wordItem('l2', 1, '4.', 'Devam'),
    )

    expect(cleanOfficeHtml(html)).toBe(
      '<ol><li><p>Giriş</p><ol><li><p>Kapsam</p></li></ol></li></ol><p class="MsoNormal">Ara metin</p><ol start="4"><li><p>Devam</p></li></ol>',
    )
  })

  it('guesses the list type from the marker when the styles are missing', () => {
    const html = `<p class=MsoListParagraph style='mso-list:l5 level1 lfo2'><![if !supportLists]><span>3)<span>&nbsp;</span></span><![endif]><b>Kalın</b> madde</p><p class=MsoListParagraph style='mso-list:l6 level1 lfo3'><![if !supportLists]><span>-<span>&nbsp;</span></span><![endif]>Tire</p>`

    expect(cleanOfficeHtml(html)).toBe(
      '<ol start="3"><li><p><b>Kalın</b> madde</p></li></ol><ul><li><p>Tire</p></li></ul>',
    )
  })

  it('removes the number Word writes in front of a numbered heading', () => {
    const html = word(
      `<h2 style='mso-list:l1 level1 lfo1'><![if !supportLists]><span><span style='mso-list:Ignore'>1.<span>&nbsp;</span></span></span><![endif]>Giriş</h2>`,
    )

    expect(cleanOfficeHtml(html)).toBe('<h2 style="mso-list:l1 level1 lfo1">Giriş</h2>')
  })

  it('keeps the title and quote styles and drops local images', () => {
    const html = word(
      `<p class=MsoTitle>Rapor</p><p class=MsoQuote>Alıntı</p><p class=MsoNormal><img width=10 height=10 src="file:///C:/Users/someone/AppData/Local/Temp/msohtmlclip1/01/clip_image001.png">Metin</p>`,
    )

    expect(cleanOfficeHtml(html)).toBe(
      '<h1>Rapor</h1><blockquote><p>Alıntı</p></blockquote><p class="MsoNormal">Metin</p>',
    )
  })

  it('keeps the text after a list marker comment that is never closed', () => {
    const html = `<p class=MsoListParagraph style='mso-list:l5 level1 lfo2'><![if !supportLists]><span>-</span> Metin kalır</p>`

    expect(cleanOfficeHtml(html)).toBe('<ul><li><p><span>-</span> Metin kalır</p></li></ul>')
  })

  it.each([
    [
      'unclosed list rules',
      (count: number) => `<style>${'@list l1:level1 {'.repeat(count)}</style>`,
    ],
    [
      'unclosed marker comments',
      (count: number) =>
        `<p style='mso-list:l1 level1'>${'<![if !supportLists]><span>x</span>'.repeat(count)}</p>`,
    ],
  ])(
    'cleans %s in linear time',
    (_name, body) => {
      const fastest = (count: number): number => {
        const html = word(body(count))
        let best = Number.POSITIVE_INFINITY
        for (let round = 0; round < 3; round++) {
          const started = performance.now()
          cleanOfficeHtml(html)
          best = Math.min(best, performance.now() - started)
        }
        return best
      }
      fastest(1_000)

      const small = fastest(5_000)
      const large = fastest(20_000)

      expect(large).toBeLessThan(small * 10)
    },
    60_000,
  )
})

describe('cleanOfficeHtml for Google Docs and LibreOffice', () => {
  it('moves nested lists that sit directly in a list into the item above', () => {
    const html =
      '<b style="font-weight:normal;" id="docs-internal-guid-1a2b"><ul><li aria-level="1"><p>Bir</p></li><ul><li aria-level="2"><p>İki</p></li></ul><li aria-level="1"><p>Üç</p></li></ul></b>'

    expect(cleanOfficeHtml(html)).toContain(
      '<ul><li aria-level="1"><p>Bir</p><ul><li aria-level="2"><p>İki</p></li></ul></li><li aria-level="1"><p>Üç</p></li></ul>',
    )
  })

  it('splits combined underline and strikethrough into separate marks', () => {
    const html =
      '<meta name="generator" content="LibreOffice 25.2"><p><span style="text-decoration: underline line-through">ikisi</span></p>'

    expect(cleanOfficeHtml(html)).toBe('<p><span style=""><u><s>ikisi</s></u></span></p>')
  })
})

describe('OfficePaste', () => {
  it('pastes Word lists as real nested lists before the core cleanup runs', async () => {
    const editor = await editorWith()

    paste(editor, word(wordItem('l0', 1, '·', 'Bir') + wordItem('l0', 2, 'o', 'İki')))

    expect(editor.getHTML()).toBe('<ul><li><p>Bir</p><ul><li><p>İki</p></li></ul></li></ul>')
  })

  it('reports how many local images were dropped', async () => {
    const onDropped = vi.fn()
    const editor = await editorWith([OfficePaste.configure({ onDropped })])

    paste(
      editor,
      word('<p class=MsoNormal><img src="file:///tmp/a.png"><img src="file:///tmp/b.png">x</p>'),
    )

    expect(onDropped).toHaveBeenCalledWith({ source: 'word', images: 2 })
    expect(editor.getHTML()).toBe('<p>x</p>')
  })

  it('leaves the core cleanup as it was for other HTML', async () => {
    const editor = await editorWith()

    paste(editor, '<p>düz <b>metin</b></p>')

    expect(editor.getHTML()).toBe('<p>düz <strong>metin</strong></p>')
  })
})
