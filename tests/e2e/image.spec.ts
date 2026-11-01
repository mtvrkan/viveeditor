import { expect, type Page, test } from '@playwright/test'

const surface = (page: Page) => page.getByRole('textbox', { name: 'Makale metni' })
const output = (page: Page) => page.getByTestId('output')
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Biçimlendirme' })

async function openImageTool(page: Page): Promise<void> {
  const button = toolbar(page).getByRole('button', { name: 'Görsel' })
  if (await button.isVisible()) {
    await button.click()
    return
  }
  await toolbar(page).getByRole('button', { name: 'Diğer araçlar' }).click()
  await page
    .getByRole('menu', { name: 'Diğer araçlar' })
    .getByRole('menuitem', { name: 'Görsel' })
    .click()
}

async function samplePng(page: Page): Promise<Buffer> {
  return page.screenshot({ clip: { x: 0, y: 0, width: 120, height: 80 } })
}

async function uploadSample(page: Page): Promise<void> {
  const png = await samplePng(page)
  await surface(page).click()
  await openImageTool(page)
  const dialog = page.getByRole('dialog', { name: 'Görsel ekle' })
  await expect(dialog).toBeVisible()
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'ornek.png',
    mimeType: 'image/png',
    buffer: png,
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/ui.html?empty')
})

test('uploads a chosen file with a progress placeholder', async ({ page }) => {
  await uploadSample(page)

  await expect(page.locator('.vive-image-upload')).toBeVisible()
  await expect(output(page)).toContainText('<img src="data:image/png;base64,')
  await expect(page.locator('.vive-image-upload')).toHaveCount(0)
  await expect(page.locator('.vive-image-alt')).toBeVisible()
})

test('inserts an image by address with alt text and rejects unsafe addresses', async ({ page }) => {
  await surface(page).click()
  await openImageTool(page)
  const dialog = page.getByRole('dialog', { name: 'Görsel ekle' })
  const address = dialog.getByLabel('Görsel adresi')

  await address.fill('javascript:alert(1)')
  await address.press('Enter')
  await expect(dialog.getByText('Bu adres kullanılamaz', { exact: false })).toBeVisible()
  await expect(address).toHaveAttribute('aria-invalid', 'true')

  await address.fill('https://example.invalid/kedi.png')
  await dialog.getByLabel('Alternatif metin').fill('Uyuyan kedi')
  await dialog.getByRole('button', { name: 'Ekle' }).click()

  await expect(dialog).toBeHidden()
  await expect(output(page)).toContainText(
    '<img src="https://example.invalid/kedi.png" alt="Uyuyan kedi" loading="lazy" decoding="async" referrerpolicy="no-referrer">',
  )
  await expect(output(page)).not.toContainText('javascript')
})

test('edits alt text of a selected image and resizes it by preset', async ({ page }) => {
  await uploadSample(page)
  await expect(output(page)).toContainText('<img src="data:image/png;base64,')

  await page.locator('.vive-image img').click()
  await openImageTool(page)
  const dialog = page.getByRole('dialog', { name: 'Görsel', exact: true })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '50%' }).click()
  await dialog.getByLabel('Alternatif metin').fill('Ekran örneği')
  await dialog.getByRole('button', { name: 'Uygula' }).click()

  await expect(output(page)).toContainText('alt="Ekran örneği"')
  await expect(output(page)).toContainText(/width="\d+" height="\d+"/)
  await expect(page.locator('.vive-image-alt')).toBeHidden()
})

test('resizes an image by dragging its handle', async ({ page }) => {
  await uploadSample(page)
  await expect(output(page)).toContainText('<img src="data:image/png;base64,')
  const image = page.locator('.vive-image img')
  await image.click()
  const before = (await image.boundingBox())?.width ?? 0
  const handle = page.locator('.vive-image-resize')
  const box = await handle.boundingBox()
  if (!box) throw new Error('Missing resize handle')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()

  await expect(output(page)).toContainText(`width="${Math.round(before - 40)}"`)
})

test('uploads an image file dropped onto the editor', async ({ page }) => {
  const png = await samplePng(page)
  await surface(page).click()

  await page.evaluate(
    (bytes) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File([new Uint8Array(bytes)], 'birak.png', { type: 'image/png' }))
      const target = document.querySelector('.vive-content')
      if (!target) throw new Error('Missing editor surface')
      const rect = target.getBoundingClientRect()
      target.dispatchEvent(
        new DragEvent('drop', {
          dataTransfer: transfer,
          clientX: rect.left + 20,
          clientY: rect.top + 20,
          bubbles: true,
          cancelable: true,
        }),
      )
    },
    [...png],
  )

  await expect(output(page)).toContainText('<img src="data:image/png;base64,')
})

test('opens the image panel from the slash menu and inserts in place of the typed command', async ({
  page,
}) => {
  await surface(page).click()

  await page.keyboard.type('/görsel')
  await expect(page.getByRole('listbox', { name: 'Blok ekle' })).toBeVisible()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Görsel ekle' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Görsel adresi').fill('https://example.invalid/kedi.png')
  await dialog.getByLabel('Alternatif metin').fill('Uyuyan kedi')
  await dialog.getByRole('button', { name: 'Ekle' }).click()

  await expect(dialog).toBeHidden()
  await expect(output(page)).toContainText('<img src="https://example.invalid/kedi.png"')
  await expect(output(page)).not.toContainText('/görsel')
})
