import { expect, type Page, test } from '@playwright/test'

const surface = (page: Page) => page.getByRole('textbox', { name: 'Makale metni' })
const output = (page: Page) => page.getByTestId('output')
const contextMenu = (page: Page) => page.getByRole('menu', { name: 'Bağlam menüsü' })

async function load(page: Page, html: string): Promise<void> {
  await page.route('https://images.example.test/**', async (route) => {
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: 160, height: 100 } })
    await route.fulfill({ contentType: 'image/png', body: png })
  })
  await page.goto('/ui.html?empty')
  await page.evaluate((content) => {
    const editor = (window as unknown as { viveEditor: { setContent(html: string): void } })
      .viveEditor
    editor.setContent(content)
  }, html)
}

const TABLE =
  '<table><tr><td><p>a</p></td><td><p>b</p></td></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></table><p>Son</p>'

test.describe('desktop', () => {
  test.skip(({ isMobile }) => isMobile, 'the custom menu is for mouse and keyboard')

  test('adds a row below from the Satır submenu of a table cell', async ({ page }) => {
    await load(page, TABLE)

    await surface(page).locator('td').first().click({ button: 'right' })
    await contextMenu(page).getByRole('menuitem', { name: 'Satır' }).click()
    await page
      .getByRole('menu', { name: 'Satır' })
      .getByRole('menuitem', { name: 'Alta satır ekle' })
      .click()

    await expect(output(page)).toContainText(
      '<tr><td><p>a</p></td><td><p>b</p></td></tr><tr><td><p></p></td><td><p></p></td></tr>',
    )
    await expect(contextMenu(page)).toBeHidden()
  })

  test('keeps a multi-cell selection when a selected cell is right-clicked', async ({ page }) => {
    await load(page, TABLE)
    await page.evaluate(() => {
      const editor = (
        window as unknown as {
          viveEditor: { commands: { setTextSelection(at: number): boolean; selectRow(): boolean } }
        }
      ).viveEditor
      editor.commands.setTextSelection(3)
      editor.commands.selectRow()
    })
    await expect(surface(page).locator('.selectedCell')).toHaveCount(2)

    await surface(page).locator('td').nth(1).click({ button: 'right' })

    await expect(contextMenu(page)).toBeVisible()
    await expect(surface(page).locator('.selectedCell')).toHaveCount(2)
  })

  test('opens a submenu with the keyboard and returns with Escape', async ({ page }) => {
    await load(page, TABLE)

    await surface(page).locator('td').nth(1).click({ button: 'right' })
    const row = contextMenu(page).getByRole('menuitem', { name: 'Satır' })
    await row.focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('menu', { name: 'Satır' })).toBeVisible()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('menu', { name: 'Satır' })).toBeHidden()
    await expect(row).toBeFocused()
    await expect(row).toHaveAttribute('aria-expanded', 'false')
  })

  test('centres an image from its menu', async ({ page }) => {
    await load(
      page,
      '<p>Önce</p><img src="https://images.example.test/kedi.png" alt="Kedi"><p>Sonra</p>',
    )
    const image = surface(page).locator('.vive-image img')
    await expect(image).toBeVisible()

    await image.click({ button: 'right' })
    await contextMenu(page).getByRole('menuitemradio', { name: 'Ortala' }).click()

    await expect(output(page)).toContainText('data-align="center"')
  })

  test('opens the link menu with Shift+F10 at the cursor', async ({ page }) => {
    await load(page, '<p>Bkz. <a href="https://example.com">örnek site</a> burada</p>')
    await surface(page).getByText('örnek site').click()
    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(
            (
              window as unknown as { viveEditor: { query: { link(): unknown } } }
            ).viveEditor.query.link(),
          ),
        ),
      )
      .toBe(true)

    await page.keyboard.press('Shift+F10')

    await expect(contextMenu(page)).toBeVisible()
    await expect(contextMenu(page).getByRole('menuitem', { name: 'Bağlantıyı aç' })).toBeFocused()
    await expect(
      contextMenu(page).getByRole('menuitem', { name: 'Bağlantıyı kaldır' }),
    ).toBeVisible()
  })

  test('keeps the browser menu on plain text', async ({ page }) => {
    await load(page, '<p>Düz bir paragraf</p>')

    const prevented = await surface(page)
      .locator('p')
      .evaluate((paragraph) => {
        const rect = paragraph.getBoundingClientRect()
        const event = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2,
          clientX: rect.left + 5,
          clientY: rect.top + 5,
        })
        paragraph.dispatchEvent(event)
        return event.defaultPrevented
      })

    expect(prevented).toBe(false)
    await expect(contextMenu(page)).toHaveCount(0)
  })

  test('stays inside the viewport near the right edge', async ({ page }) => {
    await load(page, TABLE)
    const cell = surface(page).locator('td').nth(1)
    const box = await cell.boundingBox()
    if (!box) throw new Error('Missing cell')

    await cell.click({ button: 'right', position: { x: box.width - 4, y: 4 } })
    await contextMenu(page).getByRole('menuitem', { name: 'Sütun' }).click()
    const width = await page.evaluate(() => document.documentElement.clientWidth)
    const menus = await page
      .locator('.ve-context .ve-menu:not([hidden])')
      .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().right))

    expect(menus).toHaveLength(2)
    for (const right of menus) expect(right).toBeLessThanOrEqual(width)
  })
})

test.describe('touch', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch behaviour only')

  test('leaves a long-press context menu to the browser', async ({ page }) => {
    await load(page, TABLE)
    const cell = surface(page).locator('td').first()
    await cell.tap()

    const prevented = await cell.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const event = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        clientX: rect.left + 4,
        clientY: rect.top + 4,
      })
      element.dispatchEvent(event)
      return event.defaultPrevented
    })

    expect(prevented).toBe(false)
    await expect(contextMenu(page)).toHaveCount(0)
  })
})
