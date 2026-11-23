import { expect, type Page, test } from '@playwright/test'

const surface = (page: Page) => page.getByRole('textbox', { name: 'Makale metni' })
const output = (page: Page) => page.getByTestId('output')
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Biçimlendirme' })

async function openTableTool(page: Page): Promise<void> {
  const button = toolbar(page).getByRole('button', { name: 'Tablo' })
  if (await button.isVisible()) {
    await button.click()
    return
  }
  await toolbar(page).getByRole('button', { name: 'Diğer araçlar' }).click()
  await page
    .getByRole('menu', { name: 'Diğer araçlar' })
    .getByRole('menuitem', { name: 'Tablo' })
    .click()
}

async function insertFromGrid(page: Page, right: number, down: number): Promise<void> {
  await page.goto('/ui.html?empty')
  await surface(page).click()
  await openTableTool(page)
  const picker = page.getByRole('dialog', { name: 'Tablo ekle' })
  await expect(picker).toBeVisible()
  for (let step = 0; step < right; step++) await page.keyboard.press('ArrowRight')
  for (let step = 0; step < down; step++) await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
}

test('inserts a 3 × 3 table with a header row from the slash menu', async ({ page }) => {
  await page.goto('/ui.html?empty')
  await surface(page).click()

  await page.keyboard.type('/tablo')
  await expect(page.getByRole('listbox', { name: 'Blok ekle' })).toBeVisible()
  await page.keyboard.press('Enter')
  await page.keyboard.type('Ad')

  await expect(output(page)).toContainText(
    '<table><tbody><tr><th><p>Ad</p></th><th><p></p></th><th><p></p></th></tr>',
  )
  await expect(surface(page).locator('tr')).toHaveCount(3)
})

test('picks the table size in the grid with the keyboard', async ({ page }) => {
  await insertFromGrid(page, 1, 1)

  await expect(surface(page).locator('tr')).toHaveCount(2)
  await expect(surface(page).locator('tr').first().locator('th')).toHaveCount(2)
  await expect(surface(page)).toBeFocused()
})

test('moves with Tab and adds a row after the last cell', async ({ page }) => {
  await insertFromGrid(page, 1, 0)

  await page.keyboard.type('a')
  await page.keyboard.press('Tab')
  await page.keyboard.type('b')
  await page.keyboard.press('Tab')
  await page.keyboard.type('c')

  await expect(output(page)).toContainText(
    '<tr><th><p>a</p></th><th><p>b</p></th></tr><tr><td><p>c</p></td><td><p></p></td></tr>',
  )
})

test('lets Escape then Tab move focus out of the table', async ({ page }) => {
  await insertFromGrid(page, 1, 1)

  await page.keyboard.press('Escape')
  await page.keyboard.press('Tab')

  await expect(surface(page)).not.toBeFocused()
})

test('edits the table from the actions panel', async ({ page }) => {
  await insertFromGrid(page, 1, 1)
  const actions = page.getByRole('dialog', { name: 'Tablo' })

  await openTableTool(page)
  await expect(actions.getByRole('button', { name: 'Hücreleri birleştir' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  await actions.getByRole('button', { name: 'Alta satır ekle' }).click()
  await expect(surface(page).locator('tr')).toHaveCount(3)
  await actions.getByRole('tab', { name: 'Tablo' }).click()
  await actions.getByRole('button', { name: 'Sütunu genişlet' }).click()
  await expect(output(page)).toContainText('data-colwidth="')
  await actions.getByRole('button', { name: 'Tabloyu sil' }).click()

  await expect(surface(page).locator('table')).toHaveCount(0)
})

test('colours a cell and centres it vertically from the actions panel', async ({ page }) => {
  await insertFromGrid(page, 1, 1)
  const actions = page.getByRole('dialog', { name: 'Tablo' })

  await openTableTool(page)
  await actions
    .getByRole('group', { name: 'Hücre rengi' })
    .getByRole('button', { name: 'Mavi' })
    .click()
  await expect(actions).toBeVisible()
  await expect(actions.getByRole('button', { name: 'Mavi' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await actions.getByRole('button', { name: 'Orta', exact: true }).click()

  await expect(output(page)).toContainText(
    /<th style="background-color: (#cde8ff|rgb\(205, 232, 255\)); vertical-align: middle;?">/,
  )
})

test('centres and stripes the table from the Tablo tab without leaving the panel', async ({
  page,
}) => {
  await insertFromGrid(page, 1, 1)
  const actions = page.getByRole('dialog', { name: 'Tablo' })

  await openTableTool(page)
  await expect(actions.getByRole('tab', { name: 'Hücre' })).toBeFocused()
  await page.keyboard.press('ArrowRight')
  const tab = actions.getByRole('tab', { name: 'Tablo' })
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  const tablePanel = actions.getByRole('tabpanel', { name: 'Tablo' })
  await tablePanel.getByRole('button', { name: 'Ortala' }).click()
  await tablePanel.getByRole('switch', { name: 'Satırları renklendir' }).check()
  await expect(tablePanel.getByRole('button', { name: 'Ortala' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  const overflow = await actions.evaluate((element) => element.scrollWidth - element.clientWidth)

  expect(overflow).toBeLessThanOrEqual(0)
  await expect(output(page)).toContainText('<table data-align="center" data-striped="true">')
})
