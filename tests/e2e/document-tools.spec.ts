import { expect, type Page, test } from '@playwright/test'

const surface = (page: Page) => page.getByRole('textbox', { name: 'Makale metni' })
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Biçimlendirme' })

async function useTool(page: Page, name: string): Promise<void> {
  const button = toolbar(page).getByRole('button', { name, exact: true })
  if (await button.isVisible()) {
    await button.click()
    return
  }
  await toolbar(page).getByRole('button', { name: 'Diğer araçlar' }).click()
  await page
    .getByRole('menu', { name: 'Diğer araçlar' })
    .getByRole('menuitem', { name })
    .or(page.getByRole('menu', { name: 'Diğer araçlar' }).getByRole('menuitemcheckbox', { name }))
    .click()
}

async function load(page: Page, html: string): Promise<void> {
  await page.goto('/ui.html?empty')
  await page.evaluate((content) => {
    const editor = (window as unknown as { viveEditor: { setContent(value: string): void } })
      .viveEditor
    editor.setContent(content)
  }, html)
  await surface(page).click()
}

const LONG = Array.from({ length: 30 }, (_, index) => `<p>Paragraf ${index + 1}</p>`).join('')

test('jumps to a heading from the outline', async ({ page }) => {
  await load(page, `<h2>Giriş</h2>${LONG}<h3>Sonuç bölümü</h3><p>son</p>`)

  await useTool(page, 'Ana hat')
  const outline = page.getByRole('dialog', { name: 'Ana hat' })
  await expect(outline.getByRole('button')).toHaveText(['Giriş', 'Sonuç bölümü'])
  await outline.getByRole('button', { name: 'Sonuç bölümü' }).click()

  await expect(outline).toBeHidden()
  await expect(surface(page)).toBeFocused()
  await expect(page.locator('.vive-content h3')).toBeInViewport()
})

test('lists accessibility problems and selects the one shown', async ({ page }) => {
  await load(
    page,
    '<h2>Bir</h2><h4>Dört</h4><p>Ayrıntılar için <a href="https://example.com">buraya tıklayın</a>.</p>',
  )

  await useTool(page, 'Erişilebilirlik denetimi')
  const panel = page.getByRole('dialog', { name: 'Erişilebilirlik denetimi' })
  await expect(panel.getByRole('status')).toHaveText('2 sorun bulundu')
  await panel.getByRole('button', { name: 'Göster' }).nth(1).click()

  await expect(surface(page)).toBeFocused()
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('buraya tıklayın')
})

test('opens the keyboard shortcut list with Alt+0 and returns with Escape', async ({ page }) => {
  await load(page, '<p>metin</p>')

  await page.keyboard.press('Alt+Digit0')
  const panel = page.getByRole('dialog', { name: 'Klavye kısayolları' })
  await expect(panel).toBeVisible()
  await expect(panel.getByText('Kalın', { exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(panel).toBeHidden()
  await expect(surface(page)).toBeFocused()
})

test('fills the window in full screen and leaves it with Escape', async ({ page }) => {
  await load(page, '<p>metin</p>')
  const root = page.locator('.ve-root')

  await useTool(page, 'Tam ekran')
  const box = await root.boundingBox()
  const viewport = page.viewportSize()
  await surface(page).click()
  await page.keyboard.press('Escape')

  expect(box?.width).toBe(viewport?.width)
  expect(box?.height).toBe(viewport?.height)
  await expect(root).not.toHaveClass(/ve-fullscreen/)
  await expect(surface(page)).toBeFocused()
})

test('offers an unsaved draft after a reload and restores it', async ({ page }) => {
  await page.goto('/ui.html?empty&autosave')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await surface(page).click()
  await page.keyboard.type('Kaybolmayan taslak')
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('viveeditor:draft:playground')))
    .not.toBeNull()

  await page.reload()
  const bar = page.getByRole('region', { name: 'Kaydedilmemiş taslak' })
  await expect(bar).toBeVisible()
  await bar.getByRole('button', { name: 'Taslağı geri yükle' }).click()

  await expect(surface(page)).toHaveText('Kaybolmayan taslak')
  await expect(bar).toBeHidden()
})
