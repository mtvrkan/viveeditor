import { expect, test } from '@playwright/test'

test('stops typing at the character limit and shows the count', async ({ page }) => {
  await page.goto('/ui.html?empty&limit=12')
  const surface = page.getByRole('textbox', { name: 'Makale metni' })
  const count = page.locator('.ve-count')
  await surface.click()

  await page.keyboard.type('Merhaba dünya ve ötesi')

  await expect(surface).toHaveText('Merhaba düny')
  await expect(count).toContainText('12/12')
  await expect(count).toHaveAttribute('data-limit', 'full')
  await expect(
    page.getByRole('status').filter({ hasText: 'Karakter sınırına ulaşıldı' }),
  ).toBeAttached()

  await page.keyboard.press('Backspace')
  await page.keyboard.type('a')
  await expect(surface).toHaveText('Merhaba düna')
})
