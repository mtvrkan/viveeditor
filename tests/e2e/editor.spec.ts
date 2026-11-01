import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('renders initial content as a labelled textbox', async ({ page }) => {
  const surface = page.getByRole('textbox', { name: 'Playground içeriği' })

  await expect(surface).toBeVisible()

  await expect(surface).toHaveAttribute('contenteditable', 'true')
  await expect(page.getByTestId('output')).toHaveText('<p>Merhaba <strong>viveEditor</strong>!</p>')
})

test('types Turkish characters and mirrors them to the HTML output', async ({ page }) => {
  const surface = page.getByRole('textbox', { name: 'Playground içeriği' })
  await surface.click()
  await page.keyboard.press('ControlOrMeta+a')

  await page.keyboard.type('Işık ğüşiöç İĞÜŞÖÇ')

  await expect(page.getByTestId('output')).toHaveText('<p>Işık ğüşiöç İĞÜŞÖÇ</p>')
})

test('applies bold from the toolbar and undoes it', async ({ page }) => {
  const surface = page.getByRole('textbox', { name: 'Playground içeriği' })
  await surface.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('metin')
  await page.keyboard.press('ControlOrMeta+a')

  await page.getByTestId('bold').click()

  await expect(page.getByTestId('output')).toHaveText('<p><strong>metin</strong></p>')
  await page.getByTestId('undo').click()
  await expect(page.getByTestId('output')).toHaveText('<p>metin</p>')
})

test('applies italic to selected text with the keyboard shortcut', async ({ page }) => {
  const surface = page.getByRole('textbox', { name: 'Playground içeriği' })
  await surface.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('eğik')
  await page.keyboard.press('ControlOrMeta+a')

  await page.keyboard.press('ControlOrMeta+i')

  await expect(page.getByTestId('output')).toHaveText('<p><em>eğik</em></p>')
})

test('strips script and event handlers from pasted HTML', async ({ page }) => {
  const dialogs: string[] = []
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message())
    await dialog.dismiss()
  })
  const surface = page.getByRole('textbox', { name: 'Playground içeriği' })
  await surface.click()
  await page.keyboard.press('ControlOrMeta+a')

  await surface.evaluate((element) => {
    const data = new DataTransfer()
    data.setData(
      'text/html',
      '<p onclick="alert(1)">güvenli<img src=x onerror="alert(2)"><script>alert(3)</script></p>',
    )
    data.setData('text/plain', 'güvenli')
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    )
  })

  await expect(page.getByTestId('output')).toHaveText('<p>güvenli</p>')
  expect(dialogs).toEqual([])
})
