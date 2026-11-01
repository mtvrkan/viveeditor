import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, type Page, test } from '@playwright/test'
import { dispatchPaste } from './clipboard'

const dist = fileURLToPath(new URL('../../packages/viveeditor/dist/', import.meta.url))
const CDN = 'https://cdn.viveeditor.test/viveeditor@0/dist/'

async function serveCdn(page: Page, tamper?: string): Promise<string[]> {
  const requested: string[] = []
  await page.route(`${CDN}**`, async (route) => {
    const file = new URL(route.request().url()).pathname.split('/').pop() ?? ''
    requested.push(file)
    let body = await readFile(`${dist}${file}`)
    if (file === tamper) body = Buffer.concat([body, Buffer.from('\n;')])
    await route.fulfill({
      status: 200,
      contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body,
    })
  })
  return requested
}

async function openDropIn(
  page: Page,
  textarea = '<textarea data-editor></textarea>',
): Promise<void> {
  await page.setContent(
    `<!doctype html><html lang="tr"><head><link rel="stylesheet" href="${CDN}viveeditor.css"></head><body><label>Makale ${textarea}</label><script src="${CDN}viveeditor.classic.iife.js"></script></body></html>`,
  )
  await expect(page.getByRole('textbox', { name: 'Makale' })).toBeVisible()
}

async function chooseFileItem(page: Page, name: string): Promise<void> {
  const toolbar = page.getByRole('toolbar', { name: 'Biçimlendirme' })
  const button = toolbar.getByRole('button', { name: 'Dosya', exact: true })
  if (await button.isVisible()) {
    await button.click()
    await page.getByRole('menu', { name: 'Dosya' }).getByRole('menuitem', { name }).click()
    return
  }
  await toolbar.getByRole('button', { name: 'Diğer araçlar' }).click()
  await page.getByRole('menu', { name: 'Diğer araçlar' }).getByRole('menuitem', { name }).click()
}

test('loads the Word add-on from the folder of the CDN script on first use', async ({ page }) => {
  const requested = await serveCdn(page)
  await openDropIn(page)
  await page.getByRole('textbox', { name: 'Makale' }).fill('Merhaba')
  expect(requested).not.toContain('viveeditor.docx.iife.js')

  const download = page.waitForEvent('download')
  await chooseFileItem(page, 'Word olarak kaydet (.docx)')
  const file = await download

  const shared = await page.evaluate(() =>
    ['isAllowedUrl', 'imageSize', 'sniffImageType', 'normalizeColor'].filter(
      (name) => typeof Reflect.get(Reflect.get(window, 'ViveEditor'), name) !== 'function',
    ),
  )

  expect(shared).toEqual([])
  expect(file.suggestedFilename()).toBe('belge.docx')
  expect(requested.filter((name) => name === 'viveeditor.docx.iife.js')).toHaveLength(1)
  await expect(page.locator(`script[src="${CDN}viveeditor.docx.iife.js"]`)).toHaveAttribute(
    'integrity',
    /^sha384-/,
  )
})

test('turns pasted Markdown into formatted text with the Markdown add-on', async ({ page }) => {
  await serveCdn(page)
  await openDropIn(page)
  const surface = page.getByRole('textbox', { name: 'Makale' })
  await surface.click()

  await dispatchPaste(surface, { 'text/plain': '## Başlık\n\n- **bir**\n- iki' })

  await expect(surface.locator('h2')).toHaveText('Başlık')
  await expect(surface.locator('li strong')).toHaveText('bir')
})

test('refuses an add-on whose content does not match its integrity hash', async ({ page }) => {
  await serveCdn(page, 'viveeditor.docx.iife.js')
  await openDropIn(page)

  await chooseFileItem(page, 'Word olarak kaydet (.docx)')

  await expect(page.getByRole('alert')).toContainText('Dönüştürücü yüklenemedi')
  await expect(page.locator(`script[src="${CDN}viveeditor.docx.iife.js"]`)).toHaveCount(0)
})

test('leaves the File menu out for data-files="false"', async ({ page }) => {
  await serveCdn(page)
  await openDropIn(page, '<textarea data-editor data-files="false"></textarea>')

  await expect(page.locator('[data-tool="file"]')).toHaveCount(0)
})
