import { fileURLToPath } from 'node:url'
import { expect, type Page, test } from '@playwright/test'

const bundle = fileURLToPath(
  new URL('../../packages/viveeditor/dist/viveeditor.classic.iife.js', import.meta.url),
)
const styles = fileURLToPath(
  new URL('../../packages/viveeditor/dist/viveeditor.css', import.meta.url),
)

const FORM = `
  <form action="https://forms.viveeditor.test/submit" method="post">
    <label for="body">Makale</label>
    <textarea id="body" name="body" data-editor required><p>Başlangıç</p></textarea>
    <button type="submit">Gönder</button>
  </form>
`

async function loadDropIn(page: Page, html = FORM): Promise<string[]> {
  const posted: string[] = []
  await page.route('https://forms.viveeditor.test/**', async (route) => {
    posted.push(route.request().postData() ?? '')
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>ok</p>' })
  })
  await page.setContent(`<!doctype html><html lang="tr"><body>${html}</body></html>`)
  await page.addStyleTag({ path: styles })
  await page.addScriptTag({ path: bundle })
  return posted
}

test('turns a data-editor textarea into an editor from one script tag', async ({ page }) => {
  await loadDropIn(page)

  const surface = page.getByRole('textbox', { name: 'Makale' })

  await expect(surface).toBeVisible()
  await expect(surface).toHaveAttribute('contenteditable', 'true')
  await expect(page.locator('textarea#body')).toBeHidden()
})

test('submits the edited HTML under the textarea name', async ({ page }) => {
  const posted = await loadDropIn(page)
  const surface = page.getByRole('textbox', { name: 'Makale' })
  await surface.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.type('**Kalın** yazı')

  await page.getByRole('button', { name: 'Gönder' }).click()

  await expect.poll(() => posted.length).toBe(1)
  const body = new URLSearchParams(posted[0]).get('body')
  expect(body).toBe('<p><strong>Kalın</strong> yazı</p>')
})

test('blocks submitting an empty required editor and focuses it', async ({ page }) => {
  const posted = await loadDropIn(page)
  const surface = page.getByRole('textbox', { name: 'Makale' })
  await surface.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')

  await page.getByRole('button', { name: 'Gönder' }).click()

  await expect(surface).toHaveAttribute('aria-invalid', 'true')
  await expect(surface).toBeFocused()
  expect(posted).toEqual([])
})

test('shows a visible required message linked to the editor', async ({ page }) => {
  await loadDropIn(page)
  const surface = page.getByRole('textbox', { name: 'Makale' })
  await surface.click()
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')

  await page.getByRole('button', { name: 'Gönder' }).click()

  const message = page.getByText('Bu alan boş bırakılamaz.')
  await expect(message).toBeVisible()
  await expect(surface).toHaveAccessibleDescription('Bu alan boş bırakılamaz.')
  await page.keyboard.type('dolu')
  await expect(message).toBeHidden()
})

test('ships the floating toolbar in the one-script build', async ({ page }) => {
  await loadDropIn(page)

  await expect(page.getByRole('toolbar', { name: 'Biçimlendirme' })).toBeVisible()
})

test('focuses the editor when its label is clicked', async ({ page }) => {
  await loadDropIn(page)

  await page.getByText('Makale', { exact: true }).click()

  await expect(page.getByRole('textbox', { name: 'Makale' })).toBeFocused()
})
