import { expect, type Page, test } from '@playwright/test'

const surface = (page: Page) => page.getByRole('textbox', { name: 'Makale metni' })
const output = (page: Page) => page.getByTestId('output')
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Biçimlendirme' })

async function typeAndSelect(page: Page, text: string): Promise<void> {
  await page.goto('/ui.html?empty')
  await surface(page).click()
  await page.keyboard.type(text)
  await page.keyboard.press('ControlOrMeta+a')
}

async function openTool(page: Page, name: RegExp): Promise<void> {
  const button = toolbar(page).getByRole('button', { name })
  if (await button.isVisible()) {
    await button.click()
    return
  }
  await toolbar(page).getByRole('button', { name: 'Diğer araçlar' }).click()
  await page.getByRole('menu', { name: 'Diğer araçlar' }).getByRole('menuitem', { name }).click()
}

test('colours the selection from the text colour panel', async ({ page }) => {
  await typeAndSelect(page, 'renkli metin')

  await openTool(page, /^Yazı rengi/)
  await page
    .getByRole('dialog', { name: 'Yazı rengi' })
    .getByRole('button', { name: 'Kırmızı' })
    .click()

  await expect(output(page)).toContainText('<span style="color:')
  await expect(surface(page)).toBeFocused()
})

test('picks a highlight colour with the keyboard and removes it again', async ({ page }) => {
  await typeAndSelect(page, 'önemli cümle')

  await openTool(page, /^Vurgu/)
  const panel = page.getByRole('dialog', { name: 'Vurgu' })
  await expect(panel.getByRole('button', { name: 'Sarı' })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await expect(output(page)).toContainText('<mark style="background-color:')

  await surface(page).focus()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('ControlOrMeta+Shift+h')
  await expect(output(page)).toHaveText('<p>önemli cümle</p>')
})

test('centers a paragraph from the alignment menu', async ({ page }) => {
  await typeAndSelect(page, 'ortalanacak satır')
  const align = toolbar(page).getByRole('button', { name: 'Hizalama' })

  if (await align.isVisible()) await align.click()
  else await toolbar(page).getByRole('button', { name: 'Diğer araçlar' }).click()
  await page.getByRole('menuitemradio', { name: /^Ortala/ }).click()

  await expect(output(page)).toHaveText(/^<p style="text-align: center;?">ortalanacak satır<\/p>$/)
})

test('starts a task list from "[ ] " and ticks it with the checkbox', async ({ page }) => {
  await page.goto('/ui.html?empty')
  await surface(page).click()

  await page.keyboard.type('[ ] süt al')
  const checkbox = surface(page).getByRole('checkbox', { name: 'Tamamlandı' })
  await checkbox.click()

  await expect(output(page)).toContainText('data-checked="true"')
  await expect(checkbox).toBeChecked()
})

for (const width of [700, 1024]) {
  test(`keeps every tool reachable at ${width}px without scrolling the toolbar`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/ui.html')
    const pill = toolbar(page)

    const fits = await pill.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
    const hidden = await pill
      .locator('[data-tool]')
      .evaluateAll((buttons) => buttons.filter((button) => (button as HTMLElement).hidden).length)
    const more = pill.getByRole('button', { name: 'Diğer araçlar' })
    let offered = 0
    if (hidden > 0) {
      await more.click()
      offered = await page
        .getByRole('menu', { name: 'Diğer araçlar' })
        .locator('button:not([hidden])')
        .count()
    }

    expect(fits).toBe(true)
    expect(offered).toBeGreaterThanOrEqual(hidden)
  })
}
