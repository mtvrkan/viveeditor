import type { Locator, Page } from '@playwright/test'

type Name = string | RegExp

function entry(menu: Locator, name: Name, exact = false): Locator {
  return menu
    .getByRole('menuitem', { name, exact })
    .or(menu.getByRole('menuitemcheckbox', { name, exact }))
    .or(menu.getByRole('menuitemradio', { name, exact }))
    .first()
}

const deepest = (page: Page): Locator => page.getByRole('menu').last()

export async function chooseFromOverflow(page: Page, ...path: Name[]): Promise<void> {
  const [first, ...rest] = path
  if (first === undefined) return
  await page
    .getByRole('toolbar', { name: 'Biçimlendirme' })
    .getByRole('button', { name: 'Diğer araçlar' })
    .click()
  const more = page.getByRole('menu', { name: 'Diğer araçlar' })
  if (!(await entry(more, first).isVisible())) {
    for (const category of await more
      .locator(':scope > [data-item^="category-"]:not([hidden])')
      .all()) {
      await category.click()
      if (await entry(deepest(page), first).isVisible()) break
      const back = deepest(page).locator('.ve-back')
      if (await back.isVisible()) await back.click()
    }
  }
  await entry(deepest(page), first).click()
  for (const name of rest) await entry(deepest(page), name).click()
}
