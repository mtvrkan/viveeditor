import { expect, type Page, test } from '@playwright/test'
import { dispatchPaste } from './clipboard'

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

test('clears bold and alignment with the keyboard shortcut', async ({ page }) => {
  await typeAndSelect(page, 'temizlenecek metin')
  await page.keyboard.press('ControlOrMeta+b')
  await page.keyboard.press('ControlOrMeta+Shift+e')
  await expect(output(page)).toContainText('<strong>')

  await page.keyboard.press('ControlOrMeta+Backslash')

  await expect(output(page)).toHaveText('<p>temizlenecek metin</p>')
  await expect(surface(page)).toBeFocused()
})

test('clears formatting from the toolbar button', async ({ page }) => {
  await typeAndSelect(page, 'kalın yazı')
  await page.keyboard.press('ControlOrMeta+b')

  await openTool(page, /^Biçimi temizle/)

  await expect(output(page)).toHaveText('<p>kalın yazı</p>')
})

test('paints copied formatting onto text selected with the mouse', async ({ page }) => {
  await page.goto('/ui.html?empty')
  await surface(page).click()
  await page.keyboard.type('düz ')
  await page.keyboard.press('ControlOrMeta+b')
  await page.keyboard.type('kalın')
  await page.keyboard.press('ArrowLeft')

  await openTool(page, /^Biçim boyacısı/)
  const box = await surface(page).evaluate((element) => {
    const text = element.querySelector('p')?.firstChild
    if (!text) throw new Error('No text to select.')
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 3)
    const { left, right, top, height } = range.getBoundingClientRect()
    return { left, right, y: top + height / 2 }
  })
  await page.mouse.move(box.left + 1, box.y)
  await page.mouse.down()
  await page.mouse.move(box.right - 1, box.y, { steps: 5 })
  await page.mouse.up()

  await expect(output(page)).toHaveText('<p><strong>düz</strong> <strong>kalın</strong></p>')
  await expect(surface(page)).not.toHaveClass(/vive-format-painter/)
})

async function pasteRich(page: Page): Promise<void> {
  await page.goto('/ui.html?empty')
  await surface(page).click()
  await dispatchPaste(surface(page), {
    'text/html':
      '<h2>Başlık</h2><p><strong>kalın</strong> <a href="https://example.com">bağ</a></p>',
    'text/plain': 'Başlık\nkalın bağ',
  })
}

test('switches a formatted paste to text only from the paste options button', async ({ page }) => {
  await pasteRich(page)
  const button = page.getByRole('button', { name: 'Yapıştırma seçenekleri (Ctrl)' })
  await expect(button).toBeVisible()

  await button.click()
  await page.getByRole('menuitemradio', { name: 'Yalnızca metin' }).click()

  await expect(output(page)).toHaveText('<p>Başlık</p><p>kalın bağ</p>')
  await expect(surface(page)).toBeFocused()
  await page.keyboard.type('!')
  await expect(button).toBeHidden()
})

test('opens the paste options with Ctrl and hides them with Escape', async ({ page }) => {
  await pasteRich(page)
  const button = page.getByRole('button', { name: 'Yapıştırma seçenekleri (Ctrl)' })
  await expect(button).toBeVisible()

  await page.keyboard.press('Control')
  await expect(page.getByRole('menuitemradio', { name: 'Biçimi koru' })).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')

  await expect(output(page)).toContainText('<h2>Başlık</h2><p>kalın <a ')
  await expect(output(page)).not.toContainText('<strong>')
  await page.keyboard.press('Escape')
  await expect(button).toBeHidden()
})

async function pickFromMenu(
  page: Page,
  tool: string,
  role: 'menuitem' | 'menuitemradio' | 'menuitemcheckbox',
  item: RegExp,
): Promise<void> {
  const button = toolbar(page).getByRole('button', { name: tool })
  if (await button.isVisible()) await button.click()
  else await toolbar(page).getByRole('button', { name: 'Diğer araçlar' }).click()
  await page.locator('[role="menu"]:not([hidden])').getByRole(role, { name: item }).click()
}

test('makes the selection superscript and bigger from the text style menu', async ({ page }) => {
  await page.goto('/ui.html?empty')
  await surface(page).click()
  await page.keyboard.type('E=mc2')
  await page.keyboard.press('Shift+ArrowLeft')

  await pickFromMenu(page, 'Yazı biçimi', 'menuitemcheckbox', /^Üst simge/)
  await page.keyboard.press('ControlOrMeta+a')
  await pickFromMenu(page, 'Yazı biçimi', 'menuitemradio', /^Büyük$/)

  await expect(output(page)).toHaveText(
    /^<p><span style="font-size: 1\.25em;?">E=mc<\/span><sup><span style="font-size: 1\.25em;?">2<\/span><\/sup><\/p>$|^<p><span style="font-size: 1\.25em;?">E=mc<sup>2<\/sup><\/span><\/p>$/,
  )
  await expect(surface(page)).toBeFocused()
})

test('indents a paragraph with the keyboard and from the alignment menu', async ({ page }) => {
  await page.goto('/ui.html?empty')
  await surface(page).click()
  await page.keyboard.type('girinti')

  await page.keyboard.press('ControlOrMeta+]')
  await page.keyboard.press('ControlOrMeta+]')
  await pickFromMenu(page, 'Hizalama', 'menuitem', /^Girintiyi azalt/)

  await expect(output(page)).toHaveText(/^<p style="margin-inline-start: 2em;?">girinti<\/p>$/)
})

test('types curly quotes, dashes and the Turkish apostrophe', async ({ page }) => {
  await page.goto('/ui.html?empty')
  await surface(page).click()

  await page.keyboard.type(`"Merhaba" -- Ankara'da...`)

  await expect(output(page)).toHaveText('<p>“Merhaba” — Ankara’da…</p>')
})

test('changes the case of the word at the cursor with Shift+F3', async ({ page }) => {
  await page.goto('/ui.html?empty')
  await surface(page).click()
  await page.keyboard.type('istanbul')

  await page.keyboard.press('Shift+F3')
  await expect(output(page)).toHaveText('<p>İstanbul</p>')
  await page.keyboard.press('Shift+F3')

  await expect(output(page)).toHaveText('<p>İSTANBUL</p>')
})

test('inserts a special character from the panel with the keyboard', async ({ page }) => {
  await page.goto('/ui.html?empty')
  await surface(page).click()
  await page.keyboard.type('fiyat ')

  await openTool(page, /^Özel karakter/)
  const panel = page.getByRole('dialog', { name: 'Özel karakter' })
  await panel.getByLabel('Kategori').selectOption({ label: 'Para birimleri' })
  await panel.getByRole('button', { name: '₺' }).focus()
  await page.keyboard.press('Enter')

  await expect(output(page)).toHaveText('<p>fiyat ₺</p>')
  await expect(panel).toBeHidden()
  await expect(surface(page)).toBeFocused()
})
