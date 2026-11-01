import { expect, type Page, test } from '@playwright/test'
import { dispatchPaste } from './clipboard'

const surface = (page: Page) => page.getByRole('textbox', { name: 'Makale metni' })
const output = (page: Page) => page.getByTestId('output')

const WORD_STYLE = `<style><!--
@list l0:level1 {mso-level-number-format:bullet;}
@list l0:level2 {mso-level-number-format:bullet;}
@list l1:level1 {mso-level-tab-stop:none;}
--></style>`

function wordItem(list: string, level: number, marker: string, text: string): string {
  return `<p class=MsoListParagraphCxSpMiddle style='margin-left:${level * 36}pt;text-indent:-18pt;mso-list:${list} level${level} lfo1'><![if !supportLists]><span style='font-family:Symbol'><span style='mso-list:Ignore'>${marker}<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;</span></span></span><![endif]>${text}<o:p></o:p></p>`
}

async function pasteHtml(page: Page, html: string): Promise<void> {
  await page.goto('/ui.html?empty')
  await surface(page).click()
  await dispatchPaste(surface(page), { 'text/html': html, 'text/plain': 'yedek' })
}

test('pastes Word fake bullets and numbers as real nested lists', async ({ page }) => {
  await pasteHtml(
    page,
    `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head>${WORD_STYLE}</head><body><!--StartFragment-->${wordItem('l0', 1, '·', 'Bir')}${wordItem('l0', 2, 'o', '<b>İki</b>')}${wordItem('l0', 1, '·', 'Üç')}<p class=MsoNormal>Ara</p>${wordItem('l1', 1, '1.', 'Adım')}<!--EndFragment--></body></html>`,
  )

  await expect(output(page)).toHaveText(
    '<ul><li><p>Bir</p><ul><li><p><strong>İki</strong></p></li></ul></li><li><p>Üç</p></li></ul><p>Ara</p><ol><li><p>Adım</p></li></ol>',
  )
})

test('pastes Google Docs nested lists inside their parent item', async ({ page }) => {
  await pasteHtml(
    page,
    '<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1a2b3c4d"><ul style="margin-top:0;"><li dir="ltr" aria-level="1" style="list-style-type:disc;"><p dir="ltr" role="presentation"><span style="font-weight:700;">Bir</span></p></li><ul><li dir="ltr" aria-level="2" style="list-style-type:circle;"><p dir="ltr" role="presentation"><span style="font-style:italic;">İki</span></p></li></ul></ul></b>',
  )

  await expect(output(page)).toHaveText(
    '<ul><li><p><strong>Bir</strong></p><ul><li><p><em>İki</em></p></li></ul></li></ul>',
  )
})
