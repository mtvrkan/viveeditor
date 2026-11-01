import { readFile } from 'node:fs/promises'
import { expect, type Page, test } from '@playwright/test'

const surface = (page: Page) => page.getByRole('textbox', { name: 'Makale metni' })
const output = (page: Page) => page.getByTestId('output')
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Biçimlendirme' })
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

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

async function save(page: Page, name: string): Promise<{ fileName: string; path: string }> {
  const download = page.waitForEvent('download')
  await chooseFileItem(page, name)
  const file = await download
  return { fileName: file.suggestedFilename().normalize('NFC'), path: await file.path() }
}

async function open(
  page: Page,
  file: string | { name: string; mimeType: string; buffer: Buffer },
): Promise<void> {
  const chooser = page.waitForEvent('filechooser')
  await chooseFileItem(page, 'Dosya aç…')
  await (await chooser).setFiles(file)
}

test('saves the document as Markdown under a safe name', async ({ page }) => {
  await page.goto('/ui.html')

  const { fileName, path } = await save(page, 'Markdown olarak kaydet (.md)')
  const markdown = await readFile(path, 'utf8')

  expect(fileName.replaceAll('_', ' ')).toBe('Sürüm notları.md')
  expect(markdown).toContain('## Yeni sürüm notları')
  expect(markdown).toContain('**biçim kaybolmuyor**')
  await expect(page.getByRole('status').filter({ hasText: 'Dosya kaydedildi.' })).toBeAttached()
})

test('saves a Word file and opens it again with the same structure', async ({ page }) => {
  await page.goto('/ui.html')
  const { fileName, path } = await save(page, 'Word olarak kaydet (.docx)')

  const buffer = await readFile(path)
  await page.goto('/ui.html?empty')
  await surface(page).click()
  await open(page, { name: fileName, mimeType: DOCX_MIME, buffer })

  expect(fileName.replaceAll('_', ' ')).toBe('Sürüm notları.docx')
  await expect(output(page)).toContainText(
    /<h2 style="text-align: center;?">Yeni sürüm notları<\/h2>/,
  )
  await expect(output(page)).toContainText('<strong>biçim kaybolmuyor</strong>')
  await expect(output(page)).toContainText('<th><p>Özellik</p></th>')
  await expect(output(page)).toContainText('<blockquote>')
})

test('replaces an empty document with an opened Markdown file', async ({ page }) => {
  await page.goto('/ui.html?empty')
  await surface(page).click()

  await open(page, {
    name: 'notlar.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('## Başlık\n\n- bir\n- **iki**\n'),
  })

  await expect(output(page)).toHaveText(
    '<h2>Başlık</h2><ul><li><p>bir</p></li><li><p><strong>iki</strong></p></li></ul>',
  )
})

test('inserts a text file at the cursor and removes it with one undo', async ({ page }) => {
  await page.goto('/ui.html?empty')
  await surface(page).click()
  await page.keyboard.type('var')
  const before = await output(page).textContent()

  await open(page, { name: 'not.txt', mimeType: 'text/plain', buffer: Buffer.from('eklenen') })
  await expect(output(page)).toContainText('eklenen')
  await surface(page).click()
  await page.keyboard.press('ControlOrMeta+z')

  await expect(output(page)).toHaveText(before ?? '')
})

test('shows a visible message for a file type it cannot open', async ({ page }) => {
  await page.goto('/ui.html')
  const before = await output(page).textContent()

  await open(page, { name: 'tablo.xlsx', mimeType: 'application/zip', buffer: Buffer.from('x') })

  await expect(page.getByRole('alert')).toContainText('Bu dosya türü açılamıyor')
  await expect(output(page)).toHaveText(before ?? '')
})

test('prints from a frame without scripts and can print again right away', async ({ page }) => {
  await page.addInitScript(() => {
    if (window === window.top) return
    window.print = () => {
      const top = window.top as Window & { printed?: string[] }
      top.printed = [...(top.printed ?? []), document.documentElement.outerHTML]
      window.dispatchEvent(new Event('afterprint'))
    }
  })
  await page.goto('/ui.html')
  const printed = () => page.evaluate(() => (window as { printed?: string[] }).printed ?? [])

  await chooseFileItem(page, 'Yazdır veya PDF')
  await expect.poll(async () => (await printed()).length).toBe(1)
  await chooseFileItem(page, 'Yazdır veya PDF')

  await expect.poll(async () => (await printed()).length).toBe(2)
  const [first] = await printed()
  expect(first).toContain('Yeni sürüm notları')
  expect(first).toContain('Content-Security-Policy')
  expect(first).not.toContain('<script')
  expect(await page.locator('iframe.ve-print-frame').count()).toBeLessThanOrEqual(1)
})
