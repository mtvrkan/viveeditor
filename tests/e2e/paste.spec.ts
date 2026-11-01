import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, type Page, test } from '@playwright/test'

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/paste/${name}`, import.meta.url)), 'utf8')
}

async function pasteHtml(page: Page, html: string, text: string): Promise<void> {
  const surface = page.getByRole('textbox', { name: 'Playground içeriği' })
  await surface.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')
  await surface.evaluate(
    (element, data) => {
      const transfer = new DataTransfer()
      transfer.setData('text/html', data.html)
      transfer.setData('text/plain', data.text)
      element.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }),
      )
    },
    { html, text },
  )
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
