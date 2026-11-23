import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, type Page, test } from '@playwright/test'
import { dispatchPaste } from './clipboard'

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/paste/${name}`, import.meta.url)), 'utf8')
}

async function pasteHtml(page: Page, html: string, text: string): Promise<void> {
  const surface = page.getByRole('textbox', { name: 'Playground içeriği' })
  await surface.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')
  await dispatchPaste(surface, { 'text/html': html, 'text/plain': text })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('pastes from Word without metadata, fake bullets or stray spaces', async ({ page }) => {
  await pasteHtml(page, fixture('word.html'), 'Rapor özeti')

  await expect(page.getByTestId('output')).toHaveText(
    '<p><strong>Rapor</strong> <em>özeti</em></p><p>Birinci madde</p><p><s>eski</s> değer</p>',
  )
})

test('pastes from Google Docs keeping headings and real formatting only', async ({ page }) => {
  await pasteHtml(page, fixture('google-docs.html'), 'Toplantı notları')

  await expect(page.getByTestId('output')).toHaveText(
    '<h2>Toplantı notları</h2><p><strong>Karar:</strong><em> yayına al</em></p>',
  )
})

test('pastes only the text while Shift is held', async ({ page }) => {
  const surface = page.getByRole('textbox', { name: 'Playground içeriği' })
  await surface.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')

  await page.keyboard.down('Shift')
  await dispatchPaste(surface, {
    'text/html': '<h2>Başlık</h2><p><strong>kalın</strong> https://youtu.be/dQw4w9WgXcQ</p>',
    'text/plain': 'Başlık\nkalın https://youtu.be/dQw4w9WgXcQ',
  })
  await page.keyboard.up('Shift')

  await expect(page.getByTestId('output')).toHaveText(
    '<p>Başlık</p><p>kalın https://youtu.be/dQw4w9WgXcQ</p>',
  )
})

test('pastes the clipboard once as plain text with the shortcut', async ({
  page,
  context,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Only Chromium lets tests grant clipboard access.')
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const surface = page.getByRole('textbox', { name: 'Playground içeriği' })
  await surface.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')
  await page.evaluate(() => navigator.clipboard.writeText('düz **metin**'))

  await page.keyboard.press('ControlOrMeta+Shift+v')

  await expect(page.getByTestId('output')).toHaveText('<p>düz **metin**</p>')
  await page.waitForTimeout(300)
  await expect(page.getByTestId('output')).toHaveText('<p>düz **metin**</p>')
})
