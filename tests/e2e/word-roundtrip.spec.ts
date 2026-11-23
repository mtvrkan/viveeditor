import { readFile } from 'node:fs/promises'
import { expect, type Page, test } from '@playwright/test'

const surface = (page: Page) => page.getByRole('textbox', { name: 'Makale metni' })
const output = (page: Page) => page.getByTestId('output')
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Biçimlendirme' })
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const DOCUMENT = [
  '<h2 style="text-align: center; line-height: 1.5">Başlık</h2>',
  '<p><span style="font-size: 14pt">on dört</span> <span style="font-family: Georgia, serif">georgia</span> <span style="color: #c62828">kırmızı</span> <mark style="background-color: #fff2a8">vurgu</mark></p>',
  '<p><a href="https://example.com/a" target="_blank">yeni sekme</a></p>',
  '<ol start="3" type="a"><li><p>üç</p></li><li><p>dört</p></li></ol>',
  '<ul style="list-style-type: square"><li><p>kare</p></li></ul>',
  '<table data-striped="true"><tbody><tr><th><p>A</p></th><th><p>B</p></th></tr><tr><td style="text-align: center"><p>orta</p></td><td><p>d</p></td></tr></tbody></table>',
  '<p>son</p>',
].join('')

async function chooseFileItem(page: Page, name: string): Promise<void> {
  const button = toolbar(page).getByRole('button', { name: 'Dosya', exact: true })
  if (await button.isVisible()) {
    await button.click()
    await page.getByRole('menu', { name: 'Dosya' }).getByRole('menuitem', { name }).click()
    return
  }
  await toolbar(page).getByRole('button', { name: 'Diğer araçlar' }).click()
  await page.getByRole('menu', { name: 'Diğer araçlar' }).getByRole('menuitem', { name }).click()
}

test('a document with the 1.0 features comes back from Word with what Word can hold', async ({
  page,
}) => {
  await page.goto('/ui.html?empty')
  await page.evaluate((html) => {
    ;(
      window as unknown as { viveEditor: { setContent(html: string): void } }
    ).viveEditor.setContent(html)
  }, DOCUMENT)
  await surface(page).click()
  const download = page.waitForEvent('download')
  await chooseFileItem(page, 'Word olarak kaydet (.docx)')
  const file = await download
  const buffer = await readFile(await file.path())

  await page.goto('/ui.html?empty')
  await surface(page).click()
  const chooser = page.waitForEvent('filechooser')
  await chooseFileItem(page, 'Dosya aç…')
  await (await chooser).setFiles({ name: 'rapor.docx', mimeType: DOCX_MIME, buffer })
  await expect(output(page)).toContainText('son')
  const html = (await output(page).textContent()) ?? ''

  expect(html).toMatch(/<h2 style="text-align: center;?[^"]*">Başlık<\/h2>/)
  expect(html).toMatch(/<span style="font-size: 14pt;?">on dört<\/span>/)
  expect(html).toMatch(/<span style="font-family: Georgia, serif;?">georgia<\/span>/)
  expect(html).toMatch(/<span style="color: (#c62828|rgb\(198, 40, 40\));?">kırmızı<\/span>/)
  expect(html).toContain('<mark')
  expect(html).toContain('href="https://example.com/a"')
  expect(html).toMatch(/<ol start="3" type="a"><li><p>üç<\/p><\/li><li><p>dört<\/p><\/li><\/ol>/)
  expect(html).toContain('<table data-striped="true">')
  expect(html).toMatch(/<td><p style="text-align: center;?">orta<\/p><\/td>/)
  expect(html).toContain('<th><p>A</p></th>')
})
