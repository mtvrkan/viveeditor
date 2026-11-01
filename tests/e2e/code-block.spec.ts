import { expect, type Page, test } from '@playwright/test'

interface EditorWindow {
  viveEditor: { getSelection(): { from: number } }
}

const surface = (page: Page) => page.getByRole('textbox', { name: 'Makale metni' })
const output = (page: Page) => page.getByTestId('output')

async function startCodeBlock(page: Page): Promise<void> {
  await page.goto('/ui.html?empty')
  await surface(page).click()
  await page.keyboard.type('```javascript ')
}

test('starts a code block from ``` and leaves it after three Enters', async ({ page }) => {
  await startCodeBlock(page)

  await page.keyboard.type('const a = 1')
  for (let press = 0; press < 3; press++) await page.keyboard.press('Enter')
  await page.keyboard.type('sonra')

  await expect(output(page)).toContainText(
    '<pre data-language="javascript"><code class="language-javascript">const a = 1</code></pre><p>sonra</p>',
  )
})

test('colours the code once the highlighter has loaded', async ({ page }) => {
  await startCodeBlock(page)

  await page.keyboard.type('const answer = 42')

  await expect(surface(page).locator('pre span[style*="--shiki-light"]').first()).toBeVisible()
  await expect(output(page)).not.toContainText('shiki')
})

test('indents with Tab and lets Escape then Tab leave the block', async ({ page }) => {
  await startCodeBlock(page)

  await page.keyboard.type('x')
  await page.keyboard.press('ArrowLeft')
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as EditorWindow).viveEditor.getSelection().from),
    )
    .toBe(1)
  await page.keyboard.press('Tab')
  await expect(output(page)).toContainText('>  x</code>')
  await page.keyboard.press('Escape')
  await page.keyboard.press('Tab')

  await expect(surface(page)).not.toBeFocused()
  await expect(output(page)).toContainText('>  x</code>')
})

test('changes the language from the labelled select', async ({ page }) => {
  await startCodeBlock(page)
  await page.keyboard.type('print(1)')

  await surface(page).getByRole('combobox', { name: 'Dil' }).selectOption('python')

  await expect(output(page)).toContainText('<pre data-language="python">')
})
