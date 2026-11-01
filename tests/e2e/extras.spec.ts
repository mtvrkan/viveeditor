import { expect, type Page, test } from '@playwright/test'

interface EditorWindow {
  viveEditor: {
    focus(): void
    getText(): string
    commands: { setTextSelection(from: number, to?: number): boolean }
  }
}

const surface = (page: Page) => page.getByRole('textbox', { name: 'Makale metni' })
const output = (page: Page) => page.getByTestId('output')
const panel = (page: Page) => page.getByRole('dialog', { name: 'Yapay zekâ yardımı' })

async function openEmpty(page: Page, query = ''): Promise<void> {
  await page.goto(`/extras.html?empty${query}`)
  await surface(page).click()
}

async function selectFirstParagraph(page: Page): Promise<void> {
  await page.evaluate(() => {
    const editor = (window as unknown as EditorWindow).viveEditor
    editor.focus()
    editor.commands.setTextSelection(1, 1 + editor.getText().length)
  })
}

async function askAi(page: Page, query = ''): Promise<void> {
  await openEmpty(page, query)
  await page.keyboard.type('merhaba dünya')
  await selectFirstParagraph(page)
  await page
    .getByRole('toolbar', { name: 'Seçim araçları' })
    .getByRole('button', { name: 'Yapay zekâ' })
    .click()
  await expect(panel(page)).toBeVisible()
  await panel(page).getByRole('button', { name: 'Daha iyi yaz' }).click()
}

test('inserts a mention chosen with the keyboard', async ({ page }) => {
  await openEmpty(page)

  await page.keyboard.type('Merhaba @bur')
  await expect(page.getByRole('listbox', { name: 'Kişiler' })).toBeVisible()
  await page.keyboard.press('Enter')

  await expect(output(page)).toContainText(
    '<span class="vive-mention" data-mention="u_burak">@Burak Demir</span>',
  )
})

test('inserts an emoji chosen with the keyboard after the list loads', async ({ page }) => {
  await openEmpty(page)

  await page.keyboard.type('Uçuş :rocket')
  const menu = page.getByRole('listbox', { name: 'Emoji' })
  await expect(menu.getByRole('option').first()).toBeVisible()
  await page.keyboard.press('Enter')

  await expect(output(page)).toContainText('Uçuş 🚀')
})

test('turns dollar-wrapped text into a formula drawn by KaTeX', async ({ page }) => {
  await openEmpty(page)

  await page.keyboard.type('Alan $x^2$')

  await expect(surface(page).locator('[data-math="inline"] .katex')).toBeVisible()
  await expect(output(page)).toContainText('<span data-math="inline">x^2</span>')
})

test('keeps a formula with a huge negative kern inside its own box', async ({ page }) => {
  await openEmpty(page)

  await page.keyboard.type('$\\kern{-999em}x$')
  const formula = surface(page).locator('[data-math="inline"]')
  await expect(formula.locator('.katex')).toHaveCount(1)

  const box = await formula.evaluate((element) => {
    const style = getComputedStyle(element)
    const own = element.getBoundingClientRect()
    const editor = element.closest('[contenteditable]')?.getBoundingClientRect()
    return {
      overflow: style.overflow,
      contain: style.contain,
      inside: Boolean(editor && own.left >= editor.left && own.right <= editor.right),
    }
  })
  expect(box).toEqual({
    overflow: 'hidden',
    contain: expect.stringContaining('paint'),
    inside: true,
  })
})

test('refuses an outdated KaTeX and shows the formula source instead', async ({ page }) => {
  await page.goto('/extras.html?katex=old')

  await expect(page.getByTestId('errors')).toHaveText('Formül hatası: KATEX_OUTDATED')
  const formula = surface(page).locator('[data-math="inline"]')
  await expect(formula).toContainText('\\pi r^2')
  await expect(formula.locator('.katex')).toHaveCount(0)
})

test('adds a footnote from the slash menu and edits it in place', async ({ page }) => {
  await openEmpty(page)
  await page.keyboard.type('Metin')
  await page.keyboard.press('Enter')

  await page.keyboard.type('/dipn')
  await expect(page.getByRole('listbox', { name: 'Blok ekle' })).toBeVisible()
  await page.keyboard.press('Enter')
  const field = page.getByRole('textbox', { name: 'Dipnot metni' })
  await expect(field).toBeFocused()
  await page.keyboard.type('Kaynak')
  await page.keyboard.press('Escape')

  await expect(output(page)).toHaveText('<p>Metin</p><p><sup data-footnote="">Kaynak</sup></p>')
})

test('inserts a template through the schema, without its script', async ({ page }) => {
  await openEmpty(page)

  await page.keyboard.type('/hab')
  await expect(page.getByRole('listbox', { name: 'Blok ekle' })).toBeVisible()
  await page.keyboard.press('Enter')

  await expect(output(page)).toContainText('<h2>Başlık</h2><p>Giriş paragrafı.</p>')
  await expect(output(page)).not.toContainText('script')
})

test('streams an AI suggestion, replaces the selection and undoes it in one step', async ({
  page,
}) => {
  await askAi(page)

  await expect(panel(page).getByRole('status')).toHaveText('Öneri hazır')
  await panel(page).getByRole('button', { name: 'Seçimin yerine koy' }).click()
  await expect(output(page)).toHaveText('<p>Merhaba dünya</p>')
  await page.keyboard.press('ControlOrMeta+z')

  await expect(output(page)).toHaveText('<p>merhaba dünya</p>')
})

test('stops an AI answer and ignores what arrives afterwards', async ({ page }) => {
  await askAi(page, '&ai=slow')
  const preview = panel(page).locator('.ve-ai-preview')
  await expect(preview).toContainText('kelime1')

  await panel(page).getByRole('button', { name: 'Durdur' }).click()
  const stopped = await preview.textContent()
  await page.waitForTimeout(600)

  await expect(preview).toHaveText(stopped ?? '')
  await expect(panel(page).getByRole('button', { name: 'Durdur' })).toBeHidden()
})

test('keeps hostile AI output as plain text and never loads its images', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('tracker.invalid')) requests.push(request.url())
  })
  await askAi(page, '&ai=hostile')
  await expect(panel(page).getByRole('status')).toHaveText('Öneri hazır')

  await panel(page).getByRole('button', { name: 'Altına ekle' }).click()

  await expect(output(page)).toContainText('&lt;img src="https://tracker.invalid/pixel.png"')
  await expect(output(page)).toContainText('![iz](https://tracker.invalid/image.png)')
  await expect(output(page)).not.toContainText('<img')
  await expect(output(page)).not.toContainText('href="javascript')
  await expect(output(page)).not.toContainText('‮')
  expect(requests).toEqual([])
})

test('does not open formula or footnote editors in read-only mode', async ({ page }) => {
  await page.goto('/extras.html?readonly')

  await surface(page).locator('[data-math="inline"]').click()
  await surface(page).locator('sup[data-footnote]').click()

  await expect(page.getByRole('textbox', { name: 'LaTeX formülü' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Dipnot metni' })).toHaveCount(0)
})
