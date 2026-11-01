import { expect, type Page, test } from '@playwright/test'

const surface = (page: Page) => page.getByRole('textbox', { name: 'Makale metni' })
const output = (page: Page) => page.getByTestId('output')
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Biçimlendirme' })

async function openEmpty(page: Page): Promise<void> {
  await page.goto('/ui.html?empty')
  await surface(page).click()
}

test('applies bold from the floating toolbar and marks the button pressed', async ({ page }) => {
  await openEmpty(page)
  await page.keyboard.type('kalın yazı')
  await page.keyboard.press('ControlOrMeta+a')
  const bold = toolbar(page).getByRole('button', { name: /^Kalın/ })

  await bold.click()

  await expect(output(page)).toHaveText('<p><strong>kalın yazı</strong></p>')
  await expect(bold).toHaveAttribute('aria-pressed', 'true')
  await expect(surface(page)).toBeFocused()
})

test('shows the selection bubble and applies italic from it', async ({ page }) => {
  await page.goto('/ui.html')
  const bubble = page.getByRole('toolbar', { name: 'Seçim araçları' })

  await surface(page).locator('strong').first().dblclick()
  await expect(bubble).toBeVisible()
  await bubble.getByRole('button', { name: /^İtalik/ }).click()

  await expect(output(page)).toContainText('<em>')
})

test('inserts a heading from the slash menu with the keyboard', async ({ page }) => {
  await openEmpty(page)

  await page.keyboard.type('/bas')
  const menu = page.getByRole('listbox', { name: 'Blok ekle' })
  await expect(menu).toBeVisible()
  await expect(surface(page)).toHaveAttribute('aria-activedescendant', /.+/)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.keyboard.type('Giriş')

  await expect(menu).toBeHidden()
  await expect(output(page)).toHaveText('<h2>Giriş</h2>')
})

test('closes the slash menu on Escape and keeps the typed text', async ({ page }) => {
  await openEmpty(page)
  await page.keyboard.type('/')
  await expect(page.getByRole('listbox', { name: 'Blok ekle' })).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(page.getByRole('listbox', { name: 'Blok ekle' })).toBeHidden()
  await expect(output(page)).toHaveText('<p>/</p>')
})

test('refuses a javascript: link and accepts a bare domain', async ({ page }) => {
  await openEmpty(page)
  await page.keyboard.type('kurulum')
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('ControlOrMeta+k')
  const field = page.getByRole('textbox', { name: 'Bağlantı adresi' })
  await expect(field).toBeFocused()

  await field.fill('javascript:alert(1)')
  await page.keyboard.press('Enter')
  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Bu adres kabul edilmez', { exact: false })).toBeVisible()

  await field.fill('viveeditor.dev/kurulum')
  await page.keyboard.press('Enter')

  await expect(output(page)).toContainText('href="https://viveeditor.dev/kurulum"')
  await expect(surface(page)).toBeFocused()
})

test('moves focus into the toolbar with Alt+F10 and back with Escape', async ({ page }) => {
  await openEmpty(page)

  await page.keyboard.press('Alt+F10')
  const first = toolbar(page).locator('button[tabindex="0"]')
  await expect(first).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(toolbar(page).getByRole('button', { name: /^Kalın/ })).toBeFocused()
  await page.keyboard.press('Escape')

  await expect(surface(page)).toBeFocused()
})

test('opens the readability panel from the word count', async ({ page }) => {
  await page.goto('/ui.html')

  await page.getByRole('button', { name: /kelime\. Metin ölçümü$/ }).click()

  const panel = page.getByRole('dialog', { name: 'Metin ölçümü' })
  await expect(panel).toBeVisible()
  await expect(panel.locator('.ve-numeral')).toHaveText(/^\d{1,3}$/)
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
})

test('moves secondary tools into the more menu on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await openEmpty(page)
  await page.keyboard.type('alt')
  await page.keyboard.press('ControlOrMeta+a')

  await expect(toolbar(page).getByRole('button', { name: /^Altı çizili/ })).toBeHidden()
  await toolbar(page).getByRole('button', { name: 'Diğer araçlar' }).click()
  await page.getByRole('menuitemcheckbox', { name: /Altı çizili/ }).click()

  await expect(output(page)).toHaveText('<p><u>alt</u></p>')
  const box = await toolbar(page).boundingBox()
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390)
})

async function toggleSource(page: Page): Promise<void> {
  const button = toolbar(page).getByRole('button', { name: 'HTML kaynağı' })
  if (await button.isVisible()) {
    await button.click()
    return
  }
  await toolbar(page).getByRole('button', { name: 'Diğer araçlar' }).click()
  await page
    .getByRole('menu', { name: 'Diğer araçlar' })
    .getByRole('menuitemcheckbox', { name: 'HTML kaynağı' })
    .click()
}

test('edits the HTML source, drops unsafe markup and undoes the change in one step', async ({
  page,
}) => {
  await openEmpty(page)
  await page.keyboard.type('ilk metin')
  await toggleSource(page)
  const source = page.getByRole('textbox', { name: 'HTML kaynak kodu' })
  await expect(source).toBeFocused()
  await expect(source).toHaveValue('<p>ilk metin</p>')
  await expect(surface(page)).toBeHidden()

  await source.fill('<h2>Başlık</h2><p onclick="alert(1)">yeni</p><script>alert(2)</script>')
  await toggleSource(page)

  await expect(surface(page)).toBeFocused()
  await expect(output(page)).toHaveText('<h2>Başlık</h2><p>yeni</p>')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(output(page)).toHaveText('<p>ilk metin</p>')
})
