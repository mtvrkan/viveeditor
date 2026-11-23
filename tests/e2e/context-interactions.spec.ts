import { expect, type Page, test } from '@playwright/test'

const surface = (page: Page) => page.getByRole('textbox', { name: 'Makale metni' })
const output = (page: Page) => page.getByTestId('output')
const toolbar = (page: Page) => page.getByRole('toolbar', { name: 'Biçimlendirme' })
const contextMenu = (page: Page) => page.getByRole('menu', { name: 'Bağlam menüsü' })

interface TestEditor {
  setContent(html: string): void
  setEditable(editable: boolean): void
  getSelection(): { from: number; to: number }
  getHTML(): string
  commands: Record<string, (...args: unknown[]) => boolean>
  query: Record<string, () => unknown>
}

async function load(page: Page, html: string, query = 'empty'): Promise<void> {
  await page.route('https://images.example.test/**', async (route) => {
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: 160, height: 100 } })
    await route.fulfill({ contentType: 'image/png', body: png })
  })
  await page.goto(`/ui.html?${query}`)
  await page.evaluate((content) => {
    ;(window as unknown as { viveEditor: TestEditor }).viveEditor.setContent(content)
  }, html)
}

const selection = (page: Page) =>
  page.evaluate(() => (window as unknown as { viveEditor: TestEditor }).viveEditor.getSelection())

const inTable = (page: Page) =>
  expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { viveEditor: TestEditor }).viveEditor.query.inTable?.(),
      ),
    )
    .toBe(true)

const readOnly = (page: Page) =>
  page.evaluate(() => {
    ;(window as unknown as { viveEditor: TestEditor }).viveEditor.setEditable(false)
  })

const TABLE =
  '<table><tr><td><p>a</p></td><td><p>b</p></td></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></table><p>Son</p>'

test.describe('context menu', () => {
  test.skip(({ isMobile }) => isMobile, 'the custom menu is for mouse and keyboard')

  test('shows only safe items in read-only mode and leaves tables to the browser', async ({
    page,
  }) => {
    await load(
      page,
      `${TABLE}<p><a href="https://example.com">örnek</a></p><pre><code>const a = 1</code></pre>`,
    )
    await readOnly(page)

    await surface(page).getByText('örnek').click({ button: 'right' })
    await expect(contextMenu(page)).toBeVisible()
    const linkItems = await contextMenu(page).getByRole('menuitem').allTextContents()
    await page.keyboard.press('Escape')
    await surface(page).getByText('const a = 1').click({ button: 'right' })
    await expect(contextMenu(page)).toBeVisible()
    const codeItems = await contextMenu(page).getByRole('menuitem').allTextContents()
    await page.keyboard.press('Escape')
    const prevented = await surface(page)
      .locator('td')
      .first()
      .evaluate((cell) => {
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })
        cell.dispatchEvent(event)
        return event.defaultPrevented
      })

    expect(linkItems).toEqual(['Bağlantıyı aç', 'Bağlantı adresini kopyala'])
    expect(codeItems).toEqual(['Kodu kopyala'])
    expect(prevented).toBe(false)
  })

  test('opens the innermost object: an image or a link inside a table cell, the table for a nested list', async ({
    page,
  }) => {
    await load(
      page,
      '<table><tr><td><ul><li><p>dış</p><ul><li><p>iç madde</p></li></ul></li></ul></td><td><img src="https://images.example.test/kedi.png" alt="Kedi"></td></tr><tr><td><p><a href="https://example.com">bağ</a></p></td><td><p>d</p></td></tr></table><p>Son</p>',
    )
    const kinds: (string | null)[] = []

    for (const target of [
      surface(page).getByText('iç madde'),
      surface(page).locator('td img'),
      surface(page).getByText('bağ', { exact: true }),
    ]) {
      await expect(target).toBeVisible()
      await target.click({ button: 'right' })
      kinds.push(await contextMenu(page).getAttribute('data-kind'))
      await page.keyboard.press('Escape')
    }

    expect(kinds).toEqual(['table', 'image', 'link'])
  })

  test('closes with Escape, returns focus to the text and keeps the selection', async ({
    page,
  }) => {
    await load(page, TABLE)
    await surface(page).locator('td').nth(3).click({ button: 'right' })
    await expect(contextMenu(page)).toBeVisible()
    const before = await selection(page)

    await page.keyboard.press('Escape')

    await expect(contextMenu(page)).toBeHidden()
    await expect(surface(page)).toBeFocused()
    expect(await selection(page)).toEqual(before)
  })

  test('deletes the table from the menu and gives focus back to the text', async ({ page }) => {
    await load(page, TABLE)

    await surface(page).locator('td').first().click({ button: 'right' })
    await contextMenu(page).getByRole('menuitem', { name: 'Tabloyu sil' }).click()

    await expect(output(page)).toHaveText('<p>Son</p>')
    await expect(surface(page)).toBeFocused()
  })

  test('opens a cell submenu with Shift+F10 and the arrow keys and runs an action with Enter', async ({
    page,
  }) => {
    await load(page, TABLE)
    await surface(page).locator('td').first().click()
    await inTable(page)

    await page.keyboard.press('Shift+F10')
    await expect(contextMenu(page)).toBeVisible()
    const row = contextMenu(page).getByRole('menuitem', { name: 'Satır' })
    for (let step = 0; step < 6; step++) {
      if (await row.evaluate((item) => item === document.activeElement)) break
      await page.keyboard.press('ArrowDown')
    }
    await expect(row).toBeFocused()
    await page.keyboard.press('ArrowRight')
    const submenu = page.getByRole('menu', { name: 'Satır' })
    await expect(submenu).toBeVisible()
    for (let step = 0; step < 6; step++) {
      const focused = await page.evaluate(() => document.activeElement?.textContent ?? '')
      if (focused === 'Alta satır ekle') break
      await page.keyboard.press('ArrowDown')
    }
    await page.keyboard.press('Enter')

    await expect(output(page)).toContainText(
      '<tr><td><p>a</p></td><td><p>b</p></td></tr><tr><td><p></p></td><td><p></p></td></tr>',
    )
    await expect(contextMenu(page)).toBeHidden()
    await expect(surface(page)).toBeFocused()
  })

  test('leaves every right click to the browser with contextMenu false', async ({ page }) => {
    await load(
      page,
      `${TABLE}<p><a href="https://example.com">örnek</a></p>`,
      'empty&contextMenu=false',
    )

    const prevented = await surface(page)
      .locator('td')
      .first()
      .evaluate((cell) => {
        const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })
        cell.dispatchEvent(event)
        return event.defaultPrevented
      })
    await surface(page).getByText('örnek').focus()
    await page.keyboard.press('Shift+F10')

    expect(prevented).toBe(false)
    await expect(contextMenu(page)).toHaveCount(0)
  })

  test('opens the text menu on plain text with contextMenu always and hides editing items when read-only', async ({
    page,
  }) => {
    await load(page, '<p>Düz bir paragraf</p>', 'empty&contextMenu=always')

    await surface(page).getByText('Düz bir paragraf').click({ button: 'right' })
    await expect(contextMenu(page)).toBeVisible()
    const editable = await contextMenu(page).getByRole('menuitem').allTextContents()
    await page.keyboard.press('Escape')
    await readOnly(page)
    await surface(page).getByText('Düz bir paragraf').click({ button: 'right' })
    await expect(contextMenu(page)).toBeVisible()
    const locked = await contextMenu(page).locator('.ve-item:not([hidden])').allTextContents()

    expect(editable).toContain('Kes')
    expect(locked).toEqual(['Kopyala'])
  })
})

test.describe('keyboard-only toolbar', () => {
  test.skip(({ isMobile }) => isMobile, 'Alt+F10 needs a hardware keyboard')

  async function reach(page: Page, tool: string): Promise<boolean> {
    if (await toolbar(page).locator(`[data-tool="${tool}"]`).isHidden()) return false
    await page.keyboard.press('Alt+F10')
    for (let step = 0; step < 60; step++) {
      const id = await page.evaluate(
        () => document.activeElement?.closest('[data-tool]')?.getAttribute('data-tool') ?? '',
      )
      if (id === tool) return true
      await page.keyboard.press('ArrowRight')
    }
    return false
  }

  for (const { tool, choose, expected } of [
    {
      tool: 'fontFamily',
      choose: 'Georgia',
      expected: /<span style="font-family: Georgia, serif;?">/,
    },
    { tool: 'lineHeight', choose: '2', expected: /<p style="line-height: 2;?">/ },
  ]) {
    test(`operates the ${tool} menu with the keyboard and Escape returns to its button`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1600, height: 900 })
      await page.goto('/ui.html?empty')
      await surface(page).click()
      await page.keyboard.type('klavye')
      await page.keyboard.press('ControlOrMeta+a')
      test.skip(!(await reach(page, tool)), 'the tool is in the More menu at this width')
      const button = toolbar(page).locator(`[data-tool="${tool}"]`)

      await page.keyboard.press('Enter')
      await expect(button).toHaveAttribute('aria-expanded', 'true')
      await page.keyboard.press('Escape')
      await expect(button).toBeFocused()
      await page.keyboard.press('Enter')
      for (let step = 0; step < 12; step++) {
        const focused = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '')
        if (focused.startsWith(choose)) break
        await page.keyboard.press('ArrowDown')
      }
      await page.keyboard.press('Enter')

      await expect(output(page)).toHaveText(expected)
    })
  }

  for (const { tool, dialog } of [
    { tool: 'fontSize', dialog: 'Yazı boyutu' },
    { tool: 'listStyle', dialog: 'Liste stili' },
  ]) {
    test(`opens the ${dialog} panel with the keyboard and Escape returns to its button`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1600, height: 900 })
      await page.goto('/ui.html?empty')
      await surface(page).click()
      await page.keyboard.type('- madde')
      test.skip(!(await reach(page, tool)), 'the tool is in the More menu at this width')
      const button = toolbar(page).locator(`[data-tool="${tool}"]`)

      await page.keyboard.press('Enter')
      await expect(page.getByRole('dialog', { name: dialog })).toBeVisible()
      await page.keyboard.press('Escape')

      await expect(page.getByRole('dialog', { name: dialog })).toBeHidden()
      await expect(button).toBeFocused()
    })
  }

  test('sets a typed font size with the keyboard only', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await page.goto('/ui.html?empty')
    await surface(page).click()
    await page.keyboard.type('punto')
    await page.keyboard.press('ControlOrMeta+a')
    test.skip(!(await reach(page, 'fontSize')), 'the tool is in the More menu at this width')
    await expect(toolbar(page).locator('[data-tool="fontSize"]')).toBeFocused()

    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('dialog', { name: 'Yazı boyutu' }).getByLabel('Punto'),
    ).toBeFocused()
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type('20')
    await page.keyboard.press('Enter')

    await expect(output(page)).toHaveText(/^<p><span style="font-size: 20pt;?">punto<\/span><\/p>$/)
    await expect(toolbar(page).locator('[data-tool="fontSize"]')).toHaveAttribute(
      'aria-label',
      'Yazı boyutu: 20 pt',
    )
  })
})

test('keeps href and title when the new-tab option of an existing link is toggled', async ({
  page,
}) => {
  await load(page, '<p><a href="https://example.com/a" title="Örnek">bağ</a> metin</p>')

  const results = await page.evaluate(() => {
    const editor = (window as unknown as { viveEditor: TestEditor }).viveEditor
    editor.commands.setTextSelection?.(2)
    const link = editor.query.link?.() as { href: string; title: string | null }
    editor.commands.setLink?.({ ...link, newTab: true })
    const on = editor.getHTML()
    editor.commands.setTextSelection?.(2)
    const current = editor.query.link?.() as { href: string; title: string | null }
    editor.commands.setLink?.({ href: current.href, title: current.title, newTab: false })
    return { on, off: editor.getHTML(), current }
  })

  expect(results.on).toBe(
    '<p><a rel="noopener noreferrer nofollow" href="https://example.com/a" title="Örnek" target="_blank">bağ</a> metin</p>',
  )
  expect(results.current).toEqual({ href: 'https://example.com/a', title: 'Örnek', newTab: true })
  expect(results.off).toBe(
    '<p><a rel="noopener noreferrer nofollow" href="https://example.com/a" title="Örnek">bağ</a> metin</p>',
  )
})
