import { expect, type Page, test } from '@playwright/test'

async function clearEditor(page: Page): Promise<void> {
  await page.getByRole('textbox', { name: 'Playground içeriği' }).click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')
}

const output = (page: Page) => page.getByTestId('output')

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await clearEditor(page)
})

test('keeps formatting when typing over a formatted selection', async ({ page }) => {
  await page.keyboard.type('eski')
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('ControlOrMeta+i')

  await page.keyboard.type('yeni')

  await expect(output(page)).toHaveText('<p><em>yeni</em></p>')
})

test.describe('markdown shortcuts', () => {
  const cases: Array<[string, string, string]> = [
    ['bold', '**kalın** ', '<p><strong>kalın</strong>&nbsp;</p>'],
    ['italic', '*eğik* ', '<p><em>eğik</em>&nbsp;</p>'],
    ['strike', '~~çizik~~ ', '<p><s>çizik</s>&nbsp;</p>'],
    ['inline code', '`kod` ', '<p><code>kod</code>&nbsp;</p>'],
    ['heading', '## Başlık', '<h2>Başlık</h2>'],
    ['bullet list', '- madde', '<ul><li><p>madde</p></li></ul>'],
    ['ordered list', '1. ilk', '<ol><li><p>ilk</p></li></ol>'],
    ['blockquote', '> söz', '<blockquote><p>söz</p></blockquote>'],
    ['horizontal rule', '---', '<hr><p></p>'],
  ]

  for (const [name, typed, expected] of cases) {
    test(`turns markdown into ${name}`, async ({ page }) => {
      await page.keyboard.type(typed)

      await expect(output(page)).toHaveText(expected)
    })
  }

  test('does not italicise underscores inside Turkish words', async ({ page }) => {
    await page.keyboard.type('kalı_ş_ ')

    await expect(output(page)).toHaveText('<p>kalı_ş_&nbsp;</p>')
  })

  test('undoes a shortcut with Backspace right after it fires', async ({ page }) => {
    await page.keyboard.type('# ')

    await page.keyboard.press('Backspace')

    await expect(output(page)).toHaveText('<p>#&nbsp;</p>')
  })
})

test.describe('lists', () => {
  test('creates a new item on Enter and nests it with Tab', async ({ page }) => {
    await page.keyboard.type('- bir')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Tab')

    await page.keyboard.type('iki')

    await expect(output(page)).toHaveText(
      '<ul><li><p>bir</p><ul><li><p>iki</p></li></ul></li></ul>',
    )
  })

  test('leaves the list on Enter in an empty item', async ({ page }) => {
    await page.keyboard.type('- bir')
    await page.keyboard.press('Enter')
    await page.keyboard.press('Enter')

    await page.keyboard.type('dışarı')

    await expect(output(page)).toHaveText('<ul><li><p>bir</p></li></ul><p>dışarı</p>')
  })
})

test.describe('toolbar', () => {
  test('reflects the active mark with aria-pressed', async ({ page }) => {
    await page.keyboard.press('ControlOrMeta+b')

    await page.keyboard.type('kalın')

    await expect(page.getByTestId('bold')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('italic')).toHaveAttribute('aria-pressed', 'false')
  })

  test('refuses a javascript: link entered by the user', async ({ page }) => {
    await page.keyboard.type('tıkla')
    await page.keyboard.press('ControlOrMeta+a')
    page.once('dialog', (dialog) => dialog.accept('javascript:alert(1)'))

    await page.getByTestId('link').click()

    await expect(output(page)).toHaveText('<p>tıkla</p>')
  })

  test('adds a safe link from the toolbar', async ({ page }) => {
    await page.keyboard.type('site')
    await page.keyboard.press('ControlOrMeta+a')
    page.once('dialog', (dialog) => dialog.accept('https://viveeditor.dev'))

    await page.getByTestId('link').click()

    await expect(output(page)).toHaveText(
      '<p><a rel="noopener noreferrer nofollow" href="https://viveeditor.dev">site</a></p>',
    )
  })
})
