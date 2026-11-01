import { expect, type Page, test } from '@playwright/test'

const START = '<p>İlk metin</p>'
const SAMPLE = '<h2>Örnek başlık</h2><p>Dışarıdan yüklenen metin.</p>'

const surface = (page: Page) => page.getByRole('textbox', { name: 'Makale metni' })
const output = (page: Page) => page.getByTestId('output')
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Biçimlendirme' })

async function replaceText(page: Page, text: string): Promise<void> {
  await surface(page).click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type(text)
}

for (const framework of ['react', 'vue', 'svelte', 'angular']) {
  test.describe(`${framework} component`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/${framework}.html`)
      await expect(surface(page)).toHaveAttribute('contenteditable', 'true')
    })

    test('shows the first value once with the toolbar', async ({ page }) => {
      await expect(output(page)).toHaveText(START)
      await expect(surface(page)).toHaveCount(1)
      await expect(toolbar(page)).toBeVisible()
    })

    test('writes typed text into the bound value', async ({ page }) => {
      await replaceText(page, 'merhaba dünya')

      await expect(output(page)).toHaveText('<p>merhaba dünya</p>')
    })

    test('shows a value set by the page', async ({ page }) => {
      await page.getByTestId('set-value').click()

      await expect(surface(page).getByRole('heading', { name: 'Örnek başlık' })).toBeVisible()
      await expect(output(page)).toHaveText(SAMPLE)
    })

    test('sends toolbar formatting to the bound value', async ({ page }) => {
      await replaceText(page, 'kalın')
      await page.keyboard.press('ControlOrMeta+a')

      await toolbar(page)
        .getByRole('button', { name: /^Kalın/ })
        .click()

      await expect(output(page)).toHaveText('<p><strong>kalın</strong></p>')
    })
  })
}

test('angular component stops editing when readonly is switched on', async ({ page }) => {
  await page.goto('/angular.html')
  await expect(surface(page)).toHaveAttribute('contenteditable', 'true')

  await page.getByRole('checkbox', { name: 'Salt okunur' }).check()

  await expect(surface(page)).toHaveAttribute('contenteditable', 'false')
})

test.describe('<vive-editor> element', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/element.html')
    await expect(surface(page)).toHaveAttribute('contenteditable', 'true')
  })

  test('submits the edited HTML under its name', async ({ page }) => {
    await replaceText(page, '**Kalın** yazı')

    await page.getByRole('button', { name: 'Gönder' }).click()

    await expect(output(page)).toHaveText('<p><strong>Kalın</strong> yazı</p>')
  })

  test('goes back to the first value when the form resets', async ({ page }) => {
    await replaceText(page, 'değişti')

    await page.getByRole('button', { name: 'Sıfırla' }).click()

    await expect(surface(page)).toHaveText('İlk metin')
    await expect(page.locator('vive-editor')).toHaveJSProperty('value', START)
  })

  test('blocks submitting while required and empty', async ({ page }) => {
    await surface(page).click()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')

    await page.getByRole('button', { name: 'Gönder' }).click()

    await expect(page.locator('vive-editor:invalid')).toHaveCount(1)
    await expect(output(page)).not.toHaveAttribute('data-submits')
  })
})
