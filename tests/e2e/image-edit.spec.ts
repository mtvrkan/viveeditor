import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page, test } from '@playwright/test'
import { chooseFromOverflow } from './overflow'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const HISTORY_GROUP_DELAY = 600

const surface = (page: Page) => page.getByRole('textbox', { name: 'Makale metni' })
const output = (page: Page) => page.getByTestId('output')
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Biçimlendirme' })
const cropDialog = (page: Page) => page.getByRole('dialog', { name: 'Görseli kırp' })
const image = (page: Page) => page.locator('.vive-image img')

async function openImageTool(page: Page): Promise<void> {
  const button = toolbar(page).getByRole('button', { name: 'Görsel' })
  if (await button.isVisible()) {
    await button.click()
    return
  }
  await chooseFromOverflow(page, 'Görsel')
}

async function insertSample(page: Page, theme = ''): Promise<void> {
  await page.goto(`/ui.html?empty${theme}`)
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 120, height: 80 }, scale: 'css' })
  await surface(page).click()
  await openImageTool(page)
  await page
    .getByRole('dialog', { name: 'Görsel ekle' })
    .locator('input[type="file"]')
    .setInputFiles({ name: 'ornek.png', mimeType: 'image/png', buffer: png })
  await expect(output(page)).toContainText('width="120" height="80"')
}

async function storedSize(page: Page): Promise<{ src: string; width: number; height: number }> {
  const html = (await output(page).textContent()) ?? ''
  const match = /<img src="([^"]+)"[^>]*? width="(\d+)" height="(\d+)"/.exec(html)
  if (!match) throw new Error(`No sized image in ${html.slice(0, 200)}`)
  return { src: match[1] ?? '', width: Number(match[2]), height: Number(match[3]) }
}

async function center(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Missing element box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function openCrop(page: Page): Promise<void> {
  await image(page).click()
  await openImageTool(page)
  await page
    .getByRole('dialog', { name: 'Görsel', exact: true })
    .getByRole('button', { name: 'Kırp' })
    .click()
  await expect(cropDialog(page)).toBeVisible()
  await expect(cropDialog(page).locator('.ve-crop-image')).toBeVisible()
}

test.describe('mouse resize', () => {
  test.skip(({ isMobile }) => isMobile, 'touch has its own test')

  test('drags a corner, keeps the ratio and undoes in one step', async ({ page }) => {
    await insertSample(page)
    await page.waitForTimeout(HISTORY_GROUP_DELAY)
    await image(page).click()
    const handles = page.locator('.vive-image-handles')
    await expect(handles).toBeVisible()
    await expect(handles).toHaveAttribute('aria-hidden', 'true')
    await expect(page.locator('.vive-image-size')).toHaveText('120 × 80')
    const start = await center(page.locator('[data-corner="se"]'))

    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 60, start.y + 5, { steps: 6 })
    await expect(page.locator('.vive-image-size')).toHaveText('180 × 120')
    await page.mouse.up()

    await expect(output(page)).toContainText('width="180" height="120"')
    await expect(page.locator('.vive-image-handles')).toBeVisible()
    await surface(page).press('ControlOrMeta+z')
    await expect(output(page)).toContainText('width="120" height="80"')
  })

  test('shrinks from a top-left corner and resets on double-click', async ({ page }) => {
    await insertSample(page)
    await image(page).click()
    const start = await center(page.locator('[data-corner="nw"]'))

    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 30, start.y + 30, { steps: 4 })
    await page.mouse.up()
    const shrunk = await storedSize(page)
    await page.locator('[data-corner="se"]').dblclick()

    expect(shrunk.width).toBe(75)
    expect(Math.abs(shrunk.height - (shrunk.width * 80) / 120)).toBeLessThanOrEqual(1)
    await expect(output(page)).toContainText('width="120" height="80"')
  })
})

test('resizes with a touch drag on the handle', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch drag runs on the phone project')
  await insertSample(page)
  await image(page).tap()
  const handle = page.locator('[data-corner="se"]')
  await expect(handle).toBeVisible()
  const start = await center(handle)

  expect(await handle.evaluate((element) => getComputedStyle(element).touchAction)).toBe('none')
  expect(await image(page).evaluate((element) => getComputedStyle(element).touchAction)).toBe(
    'auto',
  )
  await handle.evaluate((element, point) => {
    const fire = (type: string, x: number, y: number): void => {
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 7,
          pointerType: 'touch',
          isPrimary: true,
          button: 0,
          clientX: x,
          clientY: y,
        }),
      )
    }
    fire('pointerdown', point.x, point.y)
    fire('pointermove', point.x + 20, point.y + 10)
    fire('pointermove', point.x + 30, point.y + 10)
    fire('pointerup', point.x + 30, point.y + 10)
  }, start)

  await expect(output(page)).toContainText('width="150" height="100"')
})

test.describe('crop', () => {
  test.skip(({ isMobile }) => isMobile, 'the crop flow is covered with a mouse')

  test('crops a same-origin image to a square through the upload path', async ({ page }) => {
    await insertSample(page)
    const before = await storedSize(page)
    await openCrop(page)

    await cropDialog(page).getByRole('button', { name: '1:1' }).click()
    await expect(cropDialog(page).locator('.ve-crop-size')).toHaveText('80 × 80')
    await cropDialog(page).getByRole('button', { name: 'Uygula' }).click()

    await expect(cropDialog(page)).toBeHidden()
    await expect(output(page)).toContainText('width="80" height="80"')
    const after = await storedSize(page)
    expect(after.src).not.toBe(before.src)
    expect(after.src.startsWith('data:image/png;base64,')).toBe(true)
    const natural = await image(page).evaluate((element: HTMLImageElement) => [
      element.naturalWidth,
      element.naturalHeight,
    ])
    expect(natural).toEqual([80, 80])
    await surface(page).press('ControlOrMeta+z')
    await expect(output(page)).toContainText(before.src.slice(0, 80))
    expect((await storedSize(page)).width).toBe(120)
  })

  test('moves and resizes the crop area with the keyboard', async ({ page }) => {
    await insertSample(page)
    await openCrop(page)
    const area = cropDialog(page).getByRole('group', { name: 'Kırpma alanı' })
    await expect(area).toBeFocused()

    for (let step = 0; step < 10; step++) await area.press('Shift+ArrowLeft')
    for (let step = 0; step < 5; step++) await area.press('ArrowRight')
    await expect(cropDialog(page).locator('.ve-crop-size')).toHaveText('110 × 80')
    await cropDialog(page).getByRole('button', { name: 'Uygula' }).click()

    await expect(output(page)).toContainText('width="110" height="80"')
  })

  test('opens from the context menu and Escape cancels without changes', async ({ page }) => {
    await insertSample(page)
    const before = await storedSize(page)
    await image(page).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Kırp…' }).click()
    await expect(cropDialog(page)).toBeVisible()
    await expect(cropDialog(page).locator('.ve-crop-image')).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(cropDialog(page)).toBeHidden()
    expect(await storedSize(page)).toEqual(before)
  })

  test('explains a cross-origin image that cannot be read', async ({ page }) => {
    await page.goto('/ui.html?empty')
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: 60, height: 40 }, scale: 'css' })
    await page.route('https://images.example.invalid/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'image/png',
        headers: { 'access-control-allow-origin': 'https://other.example' },
        body: png,
      }),
    )
    await surface(page).click()
    await openImageTool(page)
    const insert = page.getByRole('dialog', { name: 'Görsel ekle' })
    await insert.getByLabel('Görsel adresi').fill('https://images.example.invalid/kedi.png')
    await insert.getByLabel('Alternatif metin').fill('Kedi')
    await insert.getByRole('button', { name: 'Ekle' }).click()
    await page.locator('.vive-image').click()
    await openImageTool(page)
    await page
      .getByRole('dialog', { name: 'Görsel', exact: true })
      .getByRole('button', { name: 'Kırp' })
      .click()

    await expect(cropDialog(page).getByRole('status')).toContainText('CORS')
    await expect(cropDialog(page).getByRole('button', { name: 'Uygula' })).toBeDisabled()
  })

  for (const theme of ['light', 'dark']) {
    test(`crop dialog has no WCAG violations in the ${theme} theme`, async ({ page }) => {
      await insertSample(page, `&theme=${theme}`)
      await openCrop(page)

      const { violations } = await new AxeBuilder({ page })
        .include('dialog.ve-crop')
        .withTags(WCAG_TAGS)
        .analyze()

      expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([])
    })
  }
})
