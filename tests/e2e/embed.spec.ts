import { expect, type Page, test } from '@playwright/test'
import { dispatchPaste } from './clipboard'

const surface = (page: Page) => page.getByRole('textbox', { name: 'Makale metni' })
const output = (page: Page) => page.getByTestId('output')
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Biçimlendirme' })

async function openEmbedTool(page: Page): Promise<void> {
  const button = toolbar(page).getByRole('button', { name: 'Video' })
  if (await button.isVisible()) {
    await button.click()
    return
  }
  await toolbar(page).getByRole('button', { name: 'Diğer araçlar' }).click()
  await page
    .getByRole('menu', { name: 'Diğer araçlar' })
    .getByRole('menuitem', { name: 'Video' })
    .click()
}

test.beforeEach(async ({ page }) => {
  await page.route(/youtube|vimeo|spotify/, (route) => route.abort())
  await page.goto('/ui.html?empty')
})

test('inserts a YouTube link as a facade that loads the player only on play', async ({ page }) => {
  await surface(page).click()
  await openEmbedTool(page)
  const dialog = page.getByRole('dialog', { name: 'Video veya ses ekle' })
  await expect(dialog.getByText('Desteklenenler: YouTube, Vimeo, Spotify')).toBeVisible()

  await dialog.getByLabel('Bağlantı').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90')
  await dialog.getByLabel('Bağlantı').press('Enter')

  await expect(dialog).toBeHidden()
  await expect(output(page)).toContainText(
    'src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90"',
  )
  await expect(surface(page).locator('iframe')).toHaveCount(0)
  await surface(page).getByRole('button', { name: 'Oynat: YouTube (YouTube)' }).click()
  await expect(surface(page).locator('iframe')).toHaveAttribute(
    'src',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90&autoplay=1',
  )
})

test('refuses an unsupported link and keeps the panel open', async ({ page }) => {
  await surface(page).click()
  await openEmbedTool(page)
  const dialog = page.getByRole('dialog', { name: 'Video veya ses ekle' })
  const field = dialog.getByLabel('Bağlantı')

  await field.fill('https://evil.example/video')
  await dialog.getByRole('button', { name: 'Ekle' }).click()

  await expect(field).toHaveAttribute('aria-invalid', 'true')
  await expect(dialog.getByText(/Bu bağlantı desteklenmiyor/)).toBeVisible()
  await expect(output(page)).not.toContainText('data-embed')
})

test('turns a pasted Vimeo link into an embed that one undo turns back into text', async ({
  page,
}) => {
  await surface(page).click()

  await dispatchPaste(surface(page), { 'text/plain': 'https://vimeo.com/76979871' })

  await expect(output(page)).toContainText('data-embed="vimeo" data-id="76979871"')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(output(page)).toHaveText('<p>https://vimeo.com/76979871</p>')
})

test('opens the video panel from the slash menu', async ({ page }) => {
  await surface(page).click()

  await page.keyboard.type('/youtube')
  await expect(page.getByRole('listbox', { name: 'Blok ekle' })).toBeVisible()
  await expect(surface(page)).toHaveAttribute('aria-activedescendant', /.+/)
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Video veya ses ekle' })
  await expect(dialog.getByLabel('Bağlantı')).toBeFocused()
  await dialog.getByLabel('Bağlantı').fill('https://youtu.be/dQw4w9WgXcQ')
  await dialog.getByLabel('Bağlantı').press('Enter')

  await expect(dialog).toBeHidden()
  await expect(output(page)).toContainText('youtube-nocookie.com/embed/dQw4w9WgXcQ')
  await expect(output(page)).not.toContainText('/youtube')
})
