import { expect, type Page, test } from '@playwright/test'

const surface = (page: Page) => page.getByRole('textbox', { name: 'Makale metni' })
const output = (page: Page) => page.getByTestId('output')
const panel = (page: Page) => page.getByRole('dialog', { name: 'Bul ve değiştir' })

async function writeAndSearch(page: Page, text: string, query: string): Promise<void> {
  await page.goto('/ui.html?empty')
  await surface(page).click()
  await page.keyboard.type(text)
  await page.keyboard.press('ControlOrMeta+f')
  await expect(panel(page)).toBeVisible()
  await page.keyboard.type(query)
}

test('finds Turkish matches regardless of dotted and dotless capitals', async ({ page }) => {
  await writeAndSearch(page, 'İstanbul ve ISTANBUL ile istanbul', 'istanbul')

  await expect(panel(page).getByRole('textbox', { name: 'Bul' })).toBeFocused()
  await expect(panel(page).getByRole('status')).toHaveText('0 / 3')
  await page.keyboard.press('Enter')
  await expect(panel(page).getByRole('status')).toHaveText('1 / 3')
  await page.keyboard.press('Shift+Enter')

  await expect(panel(page).getByRole('status')).toHaveText('3 / 3')
})

test('replaces every match and returns to the text on Escape', async ({ page }) => {
  await writeAndSearch(page, 'eski model, eski fiyat', 'eski')

  await panel(page).getByRole('textbox', { name: 'Yerine yaz' }).fill('yeni')
  await panel(page).getByRole('button', { name: 'Tümünü değiştir' }).click()
  await page.keyboard.press('Escape')

  await expect(output(page)).toHaveText('<p>yeni model, yeni fiyat</p>')
  await expect(panel(page)).toBeHidden()
  await expect(surface(page)).toBeFocused()
  await expect(surface(page).locator('.ProseMirror-search-match')).toHaveCount(0)
})

test('says when nothing matches and disables the replace buttons', async ({ page }) => {
  await writeAndSearch(page, 'metin', 'yok')

  await expect(panel(page).getByRole('status')).toHaveText('Sonuç yok')
  await expect(panel(page).getByRole('button', { name: 'Tümünü değiştir' })).toBeDisabled()
})
