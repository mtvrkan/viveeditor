import { fileURLToPath } from 'node:url'
import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page, test } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

const bundle = fileURLToPath(
  new URL('../../packages/viveeditor/dist/viveeditor.classic.iife.js', import.meta.url),
)
const styles = fileURLToPath(
  new URL('../../packages/viveeditor/dist/viveeditor.css', import.meta.url),
)

const surface = (page: Page) => page.getByRole('textbox', { name: 'Makale metni' })
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Biçimlendirme' })

interface EditorWindow {
  viveEditor: {
    focus(): void
    getText(): string
    commands: { setTextSelection(from: number, to?: number): boolean }
  }
}

const COMBOBOX_POPUP = '.ve-slash'

const isComboboxPopupScroll = (rule: string, target: string): boolean =>
  rule === 'scrollable-region-focusable' && target === COMBOBOX_POPUP

async function expectNoViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  const summary = violations
    .map((violation) => ({
      ...violation,
      nodes: violation.nodes.filter(
        (node) => !isComboboxPopupScroll(violation.id, node.target.join(' ')),
      ),
    }))
    .filter((violation) => violation.nodes.length > 0)
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      targets: violation.nodes.map((node) => node.target.join(' ')).slice(0, 5),
      detail: violation.nodes[0]?.failureSummary,
    }))
  expect(summary).toEqual([])
}

async function openTool(page: Page, name: string | RegExp): Promise<void> {
  const button = toolbar(page).getByRole('button', { name, exact: typeof name === 'string' })
  if (await button.isVisible()) {
    await button.click()
    return
  }
  await toolbar(page).getByRole('button', { name: 'Diğer araçlar' }).click()
  await page
    .getByRole('menu', { name: 'Diğer araçlar' })
    .getByRole('menuitem', { name, exact: typeof name === 'string' })
    .click()
}

async function selectAll(page: Page): Promise<void> {
  await surface(page).click()
  await page.keyboard.press('ControlOrMeta+a')
}

async function caretInLastParagraph(page: Page): Promise<void> {
  await surface(page).locator(':scope > p').last().click()
  await page.keyboard.press('End')
}

async function selectFirstParagraph(page: Page): Promise<void> {
  await page.evaluate(() => {
    const editor = (window as unknown as EditorWindow).viveEditor
    editor.focus()
    editor.commands.setTextSelection(1, 1 + editor.getText().length)
  })
}

for (const theme of ['light', 'dark']) {
  test(`ui page has no WCAG violations in the ${theme} theme`, async ({ page }) => {
    await page.goto(`/ui.html?theme=${theme}`)
    await expect(toolbar(page)).toBeVisible()
    await expectNoViolations(page)
  })

  test(`extras page has no WCAG violations in the ${theme} theme`, async ({ page }) => {
    await page.goto(`/extras.html?theme=${theme}`)
    await expect(toolbar(page)).toBeVisible()
    await expectNoViolations(page)
  })
}

test('core playground has no WCAG violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('textbox', { name: 'Playground içeriği' })).toBeVisible()
  await expectNoViolations(page)
})

test('drop-in textarea has no WCAG violations', async ({ page }) => {
  await page.setContent(`<!doctype html><html lang="tr"><head><title>Drop-in</title></head><body>
    <main><form>
      <label for="body">Makale</label>
      <textarea id="body" name="body" data-editor required><p>Başlangıç</p></textarea>
      <button type="submit">Gönder</button>
    </form></main></body></html>`)
  await page.addStyleTag({ path: styles })
  await page.addScriptTag({ path: bundle })
  await expect(page.getByRole('textbox', { name: 'Makale' })).toBeVisible()
  await expectNoViolations(page)
})

const panels: { name: string; wide?: boolean; open(page: Page): Promise<Locator> }[] = [
  {
    name: 'link panel',
    async open(page) {
      await selectAll(page)
      await page.keyboard.press('ControlOrMeta+k')
      return page.getByRole('textbox', { name: 'Bağlantı adresi' })
    },
  },
  {
    name: 'text colour panel',
    async open(page) {
      await selectAll(page)
      await openTool(page, /^Yazı rengi/)
      return page.getByRole('dialog', { name: 'Yazı rengi' })
    },
  },
  {
    name: 'table size picker',
    async open(page) {
      await caretInLastParagraph(page)
      await openTool(page, 'Tablo')
      return page.getByRole('dialog', { name: 'Tablo ekle' })
    },
  },
  {
    name: 'table actions',
    async open(page) {
      await surface(page).locator('td').first().click()
      await openTool(page, 'Tablo')
      return page.getByRole('dialog', { name: 'Tablo' })
    },
  },
  {
    name: 'image panel',
    async open(page) {
      await caretInLastParagraph(page)
      await openTool(page, 'Görsel')
      return page.getByRole('dialog', { name: 'Görsel ekle' })
    },
  },
  {
    name: 'embed panel',
    async open(page) {
      await caretInLastParagraph(page)
      await openTool(page, 'Video')
      return page.getByRole('dialog', { name: 'Video veya ses ekle' })
    },
  },
  {
    name: 'search panel',
    async open(page) {
      await caretInLastParagraph(page)
      await page.keyboard.press('ControlOrMeta+f')
      return page.getByRole('dialog', { name: 'Bul ve değiştir' })
    },
  },
  {
    name: 'file menu',
    wide: true,
    async open(page) {
      await caretInLastParagraph(page)
      await openTool(page, 'Dosya')
      return page.getByRole('menu', { name: 'Dosya' })
    },
  },
  {
    name: 'measure panel',
    async open(page) {
      await page.getByRole('button', { name: /kelime\. Metin ölçümü$/ }).click()
      return page.getByRole('dialog', { name: 'Metin ölçümü' })
    },
  },
  {
    name: 'source view',
    wide: true,
    async open(page) {
      await caretInLastParagraph(page)
      await openTool(page, 'HTML kaynağı')
      return page.getByRole('textbox', { name: /HTML/ })
    },
  },
  {
    name: 'slash menu',
    async open(page) {
      await caretInLastParagraph(page)
      await page.keyboard.press('Enter')
      await page.keyboard.type('/')
      return page.getByRole('listbox', { name: 'Blok ekle' })
    },
  },
  {
    name: 'more menu',
    async open(page) {
      await page.setViewportSize({ width: 390, height: 800 })
      await surface(page).click()
      await toolbar(page).getByRole('button', { name: 'Diğer araçlar' }).click()
      return page.getByRole('menu', { name: 'Diğer araçlar' })
    },
  },
]

for (const { name, wide, open } of panels) {
  for (const theme of ['light', 'dark']) {
    test(`${name} has no WCAG violations in the ${theme} theme`, async ({ page }) => {
      if (wide) await page.setViewportSize({ width: 1600, height: 900 })
      await page.goto(`/ui.html?theme=${theme}`)
      if (wide) await page.addStyleTag({ content: '.page { max-width: none }' })
      await expect(toolbar(page)).toBeVisible()
      await expect(await open(page)).toBeVisible()
      await expectNoViolations(page)
    })
  }
}

for (const theme of ['light', 'dark']) {
  test(`suggestion list has no WCAG violations in the ${theme} theme`, async ({ page }) => {
    await page.goto(`/extras.html?empty&theme=${theme}`)
    await surface(page).click()
    await page.keyboard.type('Merhaba @bur')
    await expect(page.getByRole('listbox', { name: 'Kişiler' })).toBeVisible()
    await expectNoViolations(page)
  })

  test(`AI panel has no WCAG violations in the ${theme} theme`, async ({ page }) => {
    await page.goto(`/extras.html?empty&theme=${theme}`)
    await surface(page).click()
    await page.keyboard.type('merhaba dünya')
    await selectFirstParagraph(page)
    await page
      .getByRole('toolbar', { name: 'Seçim araçları' })
      .getByRole('button', { name: 'Yapay zekâ' })
      .click()
    await expect(page.getByRole('dialog', { name: 'Yapay zekâ yardımı' })).toBeVisible()
    await expectNoViolations(page)
  })
}

test('reaches every scrolled slash menu option from the keyboard', async ({ page }) => {
  await page.goto('/ui.html')
  await caretInLastParagraph(page)
  await page.keyboard.press('Enter')
  await page.keyboard.type('/')
  const menu = page.getByRole('listbox', { name: 'Blok ekle' })
  await expect(menu).toBeVisible()

  await page.keyboard.press('ArrowUp')

  const last = menu.getByRole('option').last()
  await expect(last).toHaveAttribute('aria-selected', 'true')
  await expect(last).toBeInViewport()
  await expect(surface(page)).toHaveAttribute(
    'aria-activedescendant',
    (await last.getAttribute('id')) ?? '',
  )
})

async function openWide(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 })
  await page.goto('/ui.html')
  await page.addStyleTag({ content: '.page { max-width: none }' })
  await expect(toolbar(page)).toBeVisible()
}

async function selectLastLine(page: Page): Promise<void> {
  await caretInLastParagraph(page)
  await page.keyboard.press('Shift+Home')
}

const popupTriggers = [
  /^Yazı rengi/,
  /^Vurgu \(/,
  'Hizalama',
  'Tablo',
  'Görsel',
  'Video',
  'Dosya',
  /kelime\. Metin ölçümü$/,
]

for (const name of popupTriggers) {
  test(`closes the ${name} popup with Escape and returns focus to its button`, async ({ page }) => {
    await openWide(page)
    await selectLastLine(page)
    const button = page.getByRole('button', { name, exact: typeof name === 'string' })
    await button.focus()

    await page.keyboard.press('Enter')
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    await expect(button).not.toBeFocused()
    await page.keyboard.press('Escape')

    await expect(button).toHaveAttribute('aria-expanded', 'false')
    await expect(button).toBeFocused()
  })
}

test('closes the more menu with Escape and returns focus to its button', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 })
  await page.goto('/ui.html')
  await caretInLastParagraph(page)
  const button = toolbar(page).getByRole('button', { name: 'Diğer araçlar' })
  await button.focus()

  await page.keyboard.press('Enter')
  await expect(page.getByRole('menu', { name: 'Diğer araçlar' })).toBeVisible()
  await page.keyboard.press('Escape')

  await expect(page.getByRole('menu', { name: 'Diğer araçlar' })).toBeHidden()
  await expect(button).toBeFocused()
})

const focusStyle = (locator: Locator) =>
  locator.evaluate((element) => {
    const style = getComputedStyle(element)
    return `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor} | ${style.boxShadow}`
  })

test('shows a visible focus indicator on keyboard focus', async ({ page }) => {
  await openWide(page)
  await selectLastLine(page)
  await page.keyboard.press('Alt+F10')
  const button = toolbar(page).locator('button[tabindex="0"]')
  await expect(button).toBeFocused()
  const focused = await focusStyle(button)

  await page.keyboard.press('Escape')

  const blurred = await focusStyle(button)
  expect(focused).not.toBe(blurred)
  expect(focused).not.toMatch(/^none .* \| none$/)
})

const TARGET_SELECTOR =
  '.ve-root button, .ve-root input, .ve-root select, .ve-root [role^="menuitem"], .ve-root [role="option"]'

const undersizedTargets = (page: Page) =>
  page.evaluate((selector) => {
    const MIN = 24
    const targets = [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((element) => element.checkVisibility() && !element.closest('.vive-content p'))
      .map((element) => ({
        element,
        box: (element.closest('label') ?? element).getBoundingClientRect(),
      }))
    const center = (box: DOMRect) => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 })
    const small = (box: DOMRect) => box.width < MIN || box.height < MIN
    const distanceToBox = (point: { x: number; y: number }, box: DOMRect) =>
      Math.hypot(
        Math.max(box.left - point.x, 0, point.x - box.right),
        Math.max(box.top - point.y, 0, point.y - box.bottom),
      )
    const spaced = (target: (typeof targets)[number]) =>
      targets.every((other) => {
        if (other === target || other.element.contains(target.element)) return true
        if (target.element.contains(other.element)) return true
        const from = center(target.box)
        if (small(other.box)) {
          const to = center(other.box)
          return Math.hypot(from.x - to.x, from.y - to.y) >= MIN
        }
        return distanceToBox(from, other.box) >= MIN / 2
      })
    return targets
      .filter((target) => small(target.box) && !spaced(target))
      .map(({ element, box }) => ({
        name: element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 30),
        width: Math.round(box.width),
        height: Math.round(box.height),
      }))
  }, TARGET_SELECTOR)

test('keeps toolbar and panel targets at least 24 by 24 pixels or spaced apart', async ({
  page,
}) => {
  await openWide(page)
  await selectLastLine(page)
  const found = [...(await undersizedTargets(page))]

  for (const name of [/^Yazı rengi/, 'Tablo', 'Görsel', 'Video']) {
    const button = page.getByRole('button', { name, exact: typeof name === 'string' })
    await button.click()
    await expect(button).toHaveAttribute('aria-expanded', 'true')
    found.push(...(await undersizedTargets(page)))
    await page.keyboard.press('Escape')
    await selectLastLine(page)
  }

  expect(found).toEqual([])
})
