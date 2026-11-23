import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { CharacterCount } from '@viveeditor/ext-character-count'
import { CodeBlock } from '@viveeditor/ext-code-block'
import { Embed } from '@viveeditor/ext-embed'
import { FontFamily, formatExtensions } from '@viveeditor/ext-format'
import { Image } from '@viveeditor/ext-image'
import { listExtensions } from '@viveeditor/ext-list'
import { Search } from '@viveeditor/ext-search'
import { Table } from '@viveeditor/ext-table'
import { taskListExtensions } from '@viveeditor/ext-task-list'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  createUI,
  type EditorUI,
  normalizeHref,
  printableHtml,
  type UiOptions,
} from '../src/index.js'
import { format } from '../src/messages.js'
import * as panelKit from '../src/panel-kit.js'
import { formatHtml } from '../src/source-view.js'

let mounted: Array<{ editor: Editor; ui: EditorUI }> = []

async function mount(
  content = '<p>Merhaba dünya</p>',
  options: UiOptions = { locale: 'tr' },
  extensions = [...basicExtensions, ...listExtensions],
): Promise<{ editor: Editor; ui: EditorUI; root: HTMLElement }> {
  const root = document.createElement('div')
  document.body.append(root)
  const editor = await Editor.create(root, { extensions, content, label: 'Makale' })
  const ui = createUI(editor, { panels: panelKit, ...options })
  mounted.push({ editor, ui })
  return { editor, ui, root }
}

function tool(root: HTMLElement, id: string): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(`.ve-pill [data-tool="${id}"]`)
  if (!button) throw new Error(`Missing tool ${id}`)
  return button
}

afterEach(() => {
  for (const { editor, ui } of mounted) {
    ui.destroy()
    editor.destroy()
  }
  mounted = []
  document.body.innerHTML = ''
})

describe('createUI toolbar', () => {
  it('renders a labelled toolbar with Turkish names and shortcuts', async () => {
    const { ui } = await mount()

    expect(ui.toolbar.getAttribute('role')).toBe('toolbar')
    expect(ui.toolbar.getAttribute('aria-label')).toBe('Biçimlendirme')
    expect(tool(ui.root, 'bold').getAttribute('aria-label')).toMatch(/^Kalın \((⌘B|Ctrl\+B)\)$/)
  })

  it('applies bold to the selection and reflects it in aria-pressed', async () => {
    const { editor, ui, root } = await mount()
    editor.commands.selectAll()

    tool(root, 'bold').click()
    ui.refresh()

    expect(editor.getHTML()).toBe('<p><strong>Merhaba dünya</strong></p>')
    expect(tool(root, 'bold').getAttribute('aria-pressed')).toBe('true')
  })

  it('renders only tools whose commands are registered', async () => {
    const { root } = await mount('<p>a</p>', { locale: 'tr' }, [...basicExtensions])

    expect(root.querySelector('[data-tool="bulletList"]')).toBeNull()
    expect(root.querySelector('[data-tool="bold"]')).not.toBeNull()
  })

  it('keeps exactly one toolbar button in the tab order', async () => {
    const { ui } = await mount()

    const tabbable = [...ui.toolbar.querySelectorAll('button')].filter(
      (button) => button.tabIndex === 0,
    )

    expect(tabbable).toHaveLength(1)
  })

  it('switches every label to English', async () => {
    const { root } = await mount('<p>a</p>', { locale: 'en' })

    expect(tool(root, 'italic').getAttribute('aria-label')).toMatch(/^Italic/)
    expect(root.querySelector('.ve-count')?.textContent).toBe('1 words')
  })
})

describe('block menu', () => {
  it('shows the current block type and turns a paragraph into a heading', async () => {
    const { editor, ui, root } = await mount()
    const trigger = root.querySelector<HTMLButtonElement>('.ve-type')

    trigger?.click()
    const heading = [...root.querySelectorAll<HTMLButtonElement>('.ve-menu .ve-item')].find(
      (item) => item.textContent?.startsWith('Başlık 2'),
    )
    heading?.click()
    ui.refresh()

    expect(editor.getHTML()).toBe('<h2>Merhaba dünya</h2>')
    expect(trigger?.getAttribute('aria-label')).toBe('Paragraf biçimi: Başlık 2')
  })
})

describe('block menu states', () => {
  it('marks only the current block with a check and focuses it on open', async () => {
    const { root } = await mount('<h2>Merhaba</h2>')
    root.querySelector<HTMLButtonElement>('.ve-type')?.click()
    const menu = root.querySelector<HTMLElement>('.ve-menu:not([hidden])')
    const checked = menu?.querySelector<HTMLElement>('[aria-checked="true"]')

    expect(checked?.dataset.item).toBe('heading2')
    expect(checked?.querySelector('.ve-item-check .ve-icon')).not.toBeNull()
    expect(menu?.querySelectorAll('[role="menuitemradio"] .ve-item-check')).toHaveLength(
      menu?.querySelectorAll('[role="menuitemradio"]').length ?? -1,
    )
    expect(document.activeElement).toBe(checked)
  })

  it('draws a different icon for each heading level', async () => {
    const { root } = await mount()
    root.querySelector<HTMLButtonElement>('.ve-type')?.click()
    const paths = ['heading1', 'heading2', 'heading3'].map((id) =>
      root.querySelector(`.ve-menu [data-item="${id}"] .ve-item-icon path`)?.getAttribute('d'),
    )

    expect(new Set(paths).size).toBe(3)
    expect(paths.every((path) => typeof path === 'string' && path.length > 0)).toBe(true)
  })
})

describe('task list', () => {
  it('turns the paragraph into a task list from the block menu and names it', async () => {
    const { editor, ui, root } = await mount('<p>süt al</p>', { locale: 'tr' }, [
      ...basicExtensions,
      ...listExtensions,
      ...taskListExtensions,
    ])
    const trigger = root.querySelector<HTMLButtonElement>('.ve-type')

    trigger?.click()
    ;[...root.querySelectorAll<HTMLButtonElement>('.ve-menu .ve-item')]
      .find((item) => item.textContent?.startsWith('Görev listesi'))
      ?.click()
    ui.refresh()

    expect(editor.isActive('taskList')).toBe(true)
    expect(trigger?.getAttribute('aria-label')).toBe('Paragraf biçimi: Görev listesi')
  })
})

describe('code block', () => {
  const pick = (root: HTMLElement, label: string): void => {
    root.querySelector<HTMLButtonElement>('.ve-type')?.click()
    ;[...root.querySelectorAll<HTMLButtonElement>('.ve-menu .ve-item')]
      .find((item) => item.textContent?.startsWith(label))
      ?.click()
  }

  it('names the block and turns its lines back into paragraphs', async () => {
    const { editor, ui, root } = await mount('<pre><code>a\nb</code></pre>', { locale: 'tr' }, [
      ...basicExtensions,
      CodeBlock,
    ])
    const trigger = root.querySelector<HTMLButtonElement>('.ve-type')
    const label = trigger?.getAttribute('aria-label')

    pick(root, 'Paragraf')
    ui.refresh()

    expect(label).toBe('Paragraf biçimi: Kod bloğu')
    expect(editor.getHTML()).toBe('<p>a</p><p>b</p>')
  })
})

describe('table panel', () => {
  it('inserts a table of the size picked in the grid', async () => {
    const { editor, root } = await mount('<p></p>', { locale: 'tr' }, [...basicExtensions, Table])

    tool(root, 'table').click()
    root.querySelector<HTMLButtonElement>('[aria-label="2 satır, 3 sütun"]')?.click()

    expect(editor.getHTML()).toMatch(
      /^<table><tbody><tr>(<th><p><\/p><\/th>){3}<\/tr><tr>(<td><p><\/p><\/td>){3}<\/tr><\/tbody><\/table>/,
    )
  })

  it('switches to table actions inside a table and disables the ones that cannot run', async () => {
    const { editor, ui, root } = await mount('<p></p>', { locale: 'tr' }, [
      ...basicExtensions,
      Table,
    ])
    editor.commands.insertTable({ rows: 1, cols: 2 })
    ui.refresh()

    tool(root, 'table').click()
    const panel = root.querySelector<HTMLElement>('.ve-table-panel')
    const action = (label: string) =>
      [...(panel?.querySelectorAll<HTMLButtonElement>('.ve-item') ?? [])].find(
        (button) => button.textContent === label,
      )
    const merge = action('Hücreleri birleştir')?.getAttribute('aria-disabled')
    action('Alta satır ekle')?.click()

    expect(panel?.getAttribute('aria-label')).toBe('Tablo')
    expect(tool(root, 'table').getAttribute('aria-disabled')).toBe('false')
    expect(merge).toBe('true')
    expect(editor.getHTML().match(/<tr>/g)).toHaveLength(2)
  })
})

describe('table cell style', () => {
  it('colours the cell and aligns it to the middle from the table panel', async () => {
    const { editor, ui, root } = await mount('<p></p>', { locale: 'tr' }, [
      ...basicExtensions,
      Table,
    ])
    editor.commands.insertTable({ rows: 1, cols: 2, headerRow: false })
    ui.refresh()
    const open = (): HTMLElement => {
      tool(root, 'table').click()
      const panel = root.querySelector<HTMLElement>('.ve-table-panel')
      if (!panel) throw new Error('Missing table panel')
      return panel
    }

    const panel = open()
    panel.querySelector<HTMLButtonElement>('[aria-label="Mavi"]')?.click()
    const middle = [...panel.querySelectorAll<HTMLButtonElement>('.ve-cell-align button')].find(
      (button) => button.textContent === 'Orta',
    )
    const blue = panel.querySelector('[aria-label="Mavi"]')?.getAttribute('aria-pressed')
    middle?.click()

    expect(blue).toBe('true')
    expect(editor.query.cellStyle()).toEqual({
      background: '#cde8ff',
      verticalAlign: 'middle',
      textAlign: null,
    })
  })

  it('hides the cell style section outside a table', async () => {
    const { root } = await mount('<p></p>', { locale: 'tr' }, [...basicExtensions, Table])

    tool(root, 'table').click()

    expect(root.querySelector<HTMLElement>('.ve-table-edit')?.hidden).toBe(true)
  })
})

describe('table panel tabs', () => {
  const TWO_CELLS =
    '<table><tbody><tr><td style="text-align: center"><p>a</p></td><td><p>b</p></td></tr></tbody></table><p></p>'
  const toHex = (part: string): string => Number(part).toString(16).padStart(2, '0')
  const clean = (html: string): string =>
    html
      .replace(
        /rgb\((\d+), (\d+), (\d+)\)/g,
        (_match, red, green, blue) => `#${toHex(red)}${toHex(green)}${toHex(blue)}`,
      )
      .replace(/;"/g, '"')

  async function openInTable(content = TWO_CELLS, cursor = 9) {
    const mounted = await mount(content, { locale: 'tr' }, [...basicExtensions, Table])
    mounted.editor.commands.setTextSelection(cursor)
    mounted.ui.refresh()
    tool(mounted.root, 'table').click()
    const panel = mounted.root.querySelector<HTMLElement>('.ve-table-panel')
    if (!panel) throw new Error('Missing table panel')
    const tabs = [...panel.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    const tabPanels = [...panel.querySelectorAll<HTMLElement>('[role="tabpanel"]')]
    const button = (scope: HTMLElement, name: string) => {
      const found = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
        (candidate) =>
          candidate.getAttribute('aria-label') === name || candidate.textContent === name,
      )
      if (!found) throw new Error(`Missing button ${name}`)
      return found
    }
    return { ...mounted, panel, tabs, tabPanels, button }
  }

  it('switches tabs with the arrow keys and links each tab to its panel', async () => {
    const { panel, tabs, tabPanels } = await openInTable()
    const tablist = panel.querySelector<HTMLElement>('[role="tablist"]')

    tablist?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))

    expect(tabs.map((tab) => tab.textContent)).toEqual(['Hücre', 'Tablo'])
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true'])
    expect(document.activeElement).toBe(tabs[1])
    expect(tabs[1]?.getAttribute('aria-controls')).toBe(tabPanels[1]?.id)
    expect(tabPanels[1]?.getAttribute('aria-labelledby')).toBe(tabs[1]?.id)
    expect(tabPanels.map((tabPanel) => tabPanel.hidden)).toEqual([true, false])
  })

  it('wraps from the first tab to the last one with ArrowLeft', async () => {
    const { panel, tabs } = await openInTable()

    panel
      .querySelector('[role="tablist"]')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))

    expect(tabs[1]?.tabIndex).toBe(0)
  })

  it('centres the cell text horizontally and keeps the panel open', async () => {
    const { editor, panel, button } = await openInTable()
    const group = panel.querySelector<HTMLElement>('.ve-cell-text-align')
    if (!group) throw new Error('Missing text align group')

    button(group, 'Ortala').click()

    expect(editor.getHTML()).toMatch(/<td style="text-align: center;?"><p>b<\/p><\/td>/)
    expect(panel.hidden).toBe(false)
    expect(button(group, 'Ortala').getAttribute('aria-pressed')).toBe('true')
  })

  it('applies a custom cell colour typed into the colour code field', async () => {
    const { editor, tabPanels } = await openInTable()
    const code = tabPanels[0]?.querySelector<HTMLInputElement>('.ve-color-code')
    if (!code) throw new Error('Missing colour code field')

    code.value = '#123456'
    code.form?.requestSubmit()

    expect(clean(editor.getHTML())).toContain('<td style="background-color: #123456"><p>b</p></td>')
  })

  it('writes width, alignment, borders, stripes and border colour on the table', async () => {
    const { editor, panel, tabs, tabPanels, button } = await openInTable()
    const tablePanel = tabPanels[1]
    if (!tablePanel) throw new Error('Missing table tab panel')

    tabs[1]?.click()
    button(tablePanel, 'Tam genişlik').click()
    button(tablePanel, 'Ortala').click()
    button(tablePanel, 'Yalnızca satırlar').click()
    tablePanel.querySelector<HTMLInputElement>('[role="switch"]')?.click()
    button(tablePanel, 'Koyu gri').click()

    expect(clean(editor.getHTML())).toContain(
      '<table data-width="full" data-align="center" data-border="rows" data-striped="true" style="--vive-table-border-color: #475467">',
    )
    expect(panel.hidden).toBe(false)
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true')
    expect(button(tablePanel, 'Koyu gri').getAttribute('aria-pressed')).toBe('true')
  })

  it('reflects the alignment of the cell under the cursor', async () => {
    const left = await openInTable(TWO_CELLS, 9)
    const leftGroup = left.panel.querySelector<HTMLElement>('.ve-cell-text-align')
    const pressedOnB = leftGroup?.querySelector('[aria-pressed="true"]')?.getAttribute('aria-label')
    left.panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    left.editor.commands.setTextSelection(4)
    left.ui.refresh()
    tool(left.root, 'table').click()
    const pressedOnA = leftGroup?.querySelector('[aria-pressed="true"]')?.getAttribute('aria-label')

    expect([pressedOnB, pressedOnA]).toEqual(['Sola', 'Ortala'])
  })

  it('deletes the table from the Tablo tab and closes the panel', async () => {
    const { editor, panel, tabs, tabPanels, button } = await openInTable()

    tabs[1]?.click()
    const remove = button(tabPanels[1] as HTMLElement, 'Tabloyu sil')
    remove.click()

    expect(remove.className).toContain('ve-table-danger')
    expect(editor.getHTML()).not.toContain('<table')
    expect(panel.hidden).toBe(true)
  })
})

describe('document tools', () => {
  beforeAll(() => {
    Range.prototype.getBoundingClientRect ??= () => new DOMRect()
    Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList
  })

  it('lists headings in the outline and moves the cursor to the chosen one', async () => {
    const { editor, root } = await mount('<h2>Giriş</h2><p>a</p><h3>Ayrıntı</h3><p>b</p>')

    tool(root, 'outline').click()
    const items = [...root.querySelectorAll<HTMLButtonElement>('.ve-outline-item')]
    items[1]?.click()

    expect(items.map((item) => [item.textContent, item.dataset.level])).toEqual([
      ['Giriş', '2'],
      ['Ayrıntı', '3'],
    ])
    expect(editor.getSelection().from).toBe(11)
    expect(root.querySelector<HTMLElement>('.ve-outline')?.hidden).toBe(true)
  })

  it('explains an empty outline', async () => {
    const { root } = await mount('<p>başlıksız</p>')

    tool(root, 'outline').click()

    expect(root.querySelector('.ve-outline .ve-doc-empty')?.textContent).toMatch(/başlık yok/)
  })

  it('reports accessibility problems in document order and shows each one', async () => {
    const { editor, root } = await mount(
      '<h2>Bir</h2><h4>Dört</h4><p><a href="https://example.com">buraya tıklayın</a> ve <span style="color: #ffff00">sarı</span> <span style="color: #1f2937">koyu</span></p><img src="https://example.com/a.png"><table><tbody><tr><td>x</td></tr></tbody></table>',
      { locale: 'tr' },
      [...basicExtensions, ...formatExtensions, Image, Table],
    )

    tool(root, 'accessibility').click()
    const panel = root.querySelector<HTMLElement>('.ve-check')
    const texts = [...(panel?.querySelectorAll('.ve-check-text') ?? [])].map(
      (item) => item.firstChild?.textContent,
    )
    panel?.querySelectorAll<HTMLButtonElement>('.ve-check-item button')[1]?.click()

    expect(panel?.querySelector('.ve-doc-summary')?.textContent).toBe('5 sorun bulundu')
    expect(texts).toEqual([
      'Başlık düzeyi atlanmış: H2 sonrası H4',
      'Bağlantı metni nereye gittiğini anlatmıyor',
      'Yazı rengi zor okunuyor (1.0:1, en az 4.5:1 olmalı)',
      'Görselin alternatif metni yok',
      'Tabloda başlık hücresi yok',
    ])
    expect(editor.query.selectedText()).toBe('buraya tıklayın')
  })

  it('says when the document has no accessibility problems', async () => {
    const { root } = await mount(
      '<h2>Başlık</h2><p><a href="https://example.com">Fiyat listesi</a></p>',
    )

    tool(root, 'accessibility').click()

    expect(root.querySelector('.ve-check .ve-doc-summary')?.textContent).toBe(
      'Erişilebilirlik sorunu bulunamadı.',
    )
  })

  it('opens the shortcut list with Alt+0 and lists only commands the editor has', async () => {
    const { editor, root } = await mount()

    editor.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'º', code: 'Digit0', altKey: true, bubbles: true }),
    )
    const panel = root.querySelector<HTMLElement>('.ve-shortcuts')
    const labels = [...(panel?.querySelectorAll('dt') ?? [])].map((item) => item.textContent)

    expect(panel?.hidden).toBe(false)
    expect(labels).toContain('Kalın')
    expect(labels).toContain('Başlık 1–6')
    expect(labels).not.toContain('Üst simge')
  })

  it('switches full screen from the toolbar and leaves it with Escape', async () => {
    const { editor, root } = await mount()
    const button = tool(root, 'fullscreen')

    button.click()
    const opened = [root.classList.contains('ve-fullscreen'), button.getAttribute('aria-pressed')]
    const overflow = document.documentElement.style.overflow
    editor.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(opened).toEqual([true, 'true'])
    expect(overflow).toBe('hidden')
    expect(root.classList.contains('ve-fullscreen')).toBe(false)
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(document.documentElement.style.overflow).toBe('')
  })

  it('stays in full screen when Escape belongs to an open link editor', async () => {
    const { editor, root } = await mount()
    tool(root, 'fullscreen').click()
    editor.commands.setTextSelection(1, 3)
    tool(root, 'link').click()

    const link = root.querySelector<HTMLElement>('.ve-link')
    link
      ?.querySelector('input')
      ?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      )

    expect(root.classList.contains('ve-fullscreen')).toBe(true)
    expect(link?.hidden).toBe(true)
  })

  it('keeps the page locked until the last of two full-screen editors closes', async () => {
    const first = await mount()
    const second = await mount()

    tool(first.root, 'fullscreen').click()
    tool(second.root, 'fullscreen').click()
    tool(first.root, 'fullscreen').click()
    const whileOne = document.documentElement.style.overflow
    tool(second.root, 'fullscreen').click()

    expect(whileOne).toBe('hidden')
    expect(document.documentElement.style.overflow).toBe('')
  })

  it('lets a plugin keep Ctrl+0 without opening the shortcut list', async () => {
    const { editor, root } = await mount('<p>a</p>', {
      locale: 'tr',
      plugins: [() => ({ handleKey: (event) => event.code === 'Digit0' })],
    })

    editor.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: '0', code: 'Digit0', altKey: true, bubbles: true }),
    )

    expect(root.querySelector<HTMLElement>('.ve-shortcuts')?.hidden ?? true).toBe(true)
  })

  it('shows heading and link text as text, never as markup', async () => {
    const { root } = await mount(
      '<h2>&lt;img src=x onerror=alert(1)&gt;</h2><h4>&lt;b&gt;here&lt;/b&gt;</h4>',
    )

    tool(root, 'outline').click()
    const outline = root.querySelector('.ve-outline')
    tool(root, 'accessibility').click()
    const check = root.querySelector('.ve-check')

    expect(outline?.querySelector('.ve-outline-item')?.textContent).toBe(
      '<img src=x onerror=alert(1)>',
    )
    expect(outline?.querySelector('img')).toBeNull()
    expect(check?.querySelector('.ve-check-excerpt')?.textContent).toBe('<b>here</b>')
    expect(check?.querySelector('b')).toBeNull()
  })

  it('leaves out tools named in exclude', async () => {
    const { root } = await mount('<p>a</p>', { locale: 'tr', exclude: ['fullscreen', 'outline'] })

    expect(root.querySelector('[data-tool="fullscreen"]')).toBeNull()
    expect(root.querySelector('[data-tool="outline"]')).toBeNull()
    expect(root.querySelector('[data-tool="shortcuts"]')).not.toBeNull()
  })
})

describe('message templates', () => {
  it('fills only the values it was given and leaves built-in names alone', () => {
    const text = format('{count} · {constructor} · {toString} · {missing}', { count: 3 })

    expect(text).toBe('3 · {constructor} · {toString} · {missing}')
  })
})

describe('search panel', () => {
  const openSearch = (editor: { dom: HTMLElement }): void => {
    editor.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true }),
    )
  }

  it('opens with Ctrl+F, counts Turkish matches and moves with Enter', async () => {
    const { editor, root } = await mount('<p>İzmir izmir IZMIR</p>', { locale: 'tr' }, [
      ...basicExtensions,
      Search,
    ])
    editor.focus()

    openSearch(editor)
    const panel = root.querySelector<HTMLElement>('.ve-search')
    const find = panel?.querySelector<HTMLInputElement>('input')
    if (!find) throw new Error('Missing find input')
    find.value = 'izmir'
    find.dispatchEvent(new Event('input'))
    find.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    expect(panel?.hidden).toBe(false)
    expect(document.activeElement).toBe(find)
    expect(panel?.querySelector('[role="status"]')?.textContent).toBe('1 / 3')
  })

  it('replaces every match and clears the highlights on Escape', async () => {
    const { editor, root } = await mount('<p>eski eski yeni</p>', { locale: 'tr' }, [
      ...basicExtensions,
      Search,
    ])
    editor.focus()
    openSearch(editor)
    const panel = root.querySelector<HTMLElement>('.ve-search')
    const [find, replacement] = [...(panel?.querySelectorAll<HTMLInputElement>('input') ?? [])]
    if (!find || !replacement) throw new Error('Missing search inputs')
    find.value = 'eski'
    find.dispatchEvent(new Event('input'))
    replacement.value = 'yeni'
    replacement.dispatchEvent(new Event('input'))

    panel?.querySelector<HTMLButtonElement>('.ve-search-actions .ve-primary')?.click()
    find.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(editor.getText()).toBe('yeni yeni yeni')
    expect(panel?.hidden).toBe(true)
    expect(editor.dom.querySelector('.ProseMirror-search-match')).toBeNull()
  })

  it('moves focus to the find field when the clicked button turns disabled', async () => {
    const { editor, root } = await mount('<p>eski eski</p>', { locale: 'tr' }, [
      ...basicExtensions,
      Search,
    ])
    editor.focus()
    openSearch(editor)
    const panel = root.querySelector<HTMLElement>('.ve-search')
    const [find, replacement] = [...(panel?.querySelectorAll<HTMLInputElement>('input') ?? [])]
    const replaceEvery = panel?.querySelector<HTMLButtonElement>('.ve-search-actions .ve-primary')
    if (!find || !replacement || !replaceEvery) throw new Error('Missing search controls')
    find.value = 'eski'
    find.dispatchEvent(new Event('input'))
    replacement.value = 'yeni'
    replacement.dispatchEvent(new Event('input'))
    replaceEvery.focus()

    replaceEvery.click()

    expect(replaceEvery.disabled).toBe(true)
    expect(document.activeElement).toBe(find)
  })
})

describe('character limit', () => {
  it('shows used and allowed characters and announces when the limit is reached', async () => {
    const { editor, root } = await mount('<p>Merhaba</p>', { locale: 'tr' }, [
      ...basicExtensions,
      CharacterCount.configure({ limit: 8 }),
    ])
    const count = root.querySelector<HTMLElement>('.ve-count')

    expect(count?.textContent).toContain('7/8')
    expect(count?.getAttribute('aria-label')).toContain('7 / 8 karakter')
    editor.setContent('<p>Merhabaa</p>')
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(count?.dataset.limit).toBe('full')
    expect(root.querySelector('.ve-sr[role="status"]')?.textContent).toBe(
      'Karakter sınırına ulaşıldı',
    )
  })
})

describe('image panel', () => {
  const imagePanel = (root: HTMLElement): HTMLElement => {
    const panel = root.querySelector<HTMLElement>('.ve-image-panel')
    if (!panel) throw new Error('Missing image panel')
    return panel
  }
  const inputs = (panel: HTMLElement): HTMLInputElement[] => [
    ...panel.querySelectorAll<HTMLInputElement>('input:not([type="file"])'),
  ]

  it('inserts an image by address with its alt text', async () => {
    const { editor, root } = await mount('<p>Metin</p>', { locale: 'tr' }, [
      ...basicExtensions,
      Image,
    ])
    editor.focus()
    tool(root, 'image').click()
    const panel = imagePanel(root)
    const [url, alt] = inputs(panel)
    if (!url || !alt) throw new Error('Missing image inputs')
    url.value = 'https://cdn.example.com/kedi.png'
    alt.value = 'Uyuyan kedi'

    panel.querySelector<HTMLButtonElement>('.ve-image-actions .ve-primary')?.click()

    expect(panel.hidden).toBe(true)
    expect(editor.getHTML()).toContain(
      '<img src="https://cdn.example.com/kedi.png" alt="Uyuyan kedi"',
    )
  })

  it('refuses an unsafe address and explains why', async () => {
    const { editor, root } = await mount('<p>Metin</p>', { locale: 'tr' }, [
      ...basicExtensions,
      Image,
    ])
    editor.focus()
    tool(root, 'image').click()
    const panel = imagePanel(root)
    const [url] = inputs(panel)
    if (!url) throw new Error('Missing url input')
    url.value = 'javascript:alert(1)'

    url.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

    expect(panel.hidden).toBe(false)
    expect(url.getAttribute('aria-invalid')).toBe('true')
    expect(panel.querySelector('[aria-live]')?.textContent).toContain('kullanılamaz')
    expect(editor.getHTML()).not.toContain('<img')
  })

  it('edits the alt text of the selected image and marks it decorative', async () => {
    const { editor, root } = await mount(
      '<img src="https://cdn.example.com/a.png"><p>Alt</p>',
      { locale: 'tr' },
      [...basicExtensions, Image],
    )
    editor.focus()
    editor.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }),
    )
    tool(root, 'image').click()
    const panel = imagePanel(root)
    const decorative = panel.querySelector<HTMLInputElement>('input[type="checkbox"]')
    if (!decorative) throw new Error('Missing decorative checkbox')

    expect(editor.query.imagesWithoutAlt()).toBe(1)
    expect((panel.querySelector('.ve-image-url') as HTMLElement).hidden).toBe(true)
    decorative.click()
    panel.querySelector<HTMLButtonElement>('.ve-image-actions .ve-primary')?.click()

    expect(editor.query.imagesWithoutAlt()).toBe(0)
    expect(editor.getHTML()).toContain('alt=""')
  })

  it('adds a caption and floats the selected image to the right', async () => {
    const { editor, root } = await mount(
      '<img src="https://cdn.example.com/a.png" alt="Grafik"><p>Alt</p>',
      { locale: 'tr' },
      [...basicExtensions, Image],
    )
    editor.focus()
    editor.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }),
    )
    tool(root, 'image').click()
    const panel = imagePanel(root)
    const caption = panel.querySelector<HTMLInputElement>('input[id$="-caption"]')
    const right = [...panel.querySelectorAll<HTMLButtonElement>('[aria-pressed]')].find(
      (button) => button.textContent === 'Sağa',
    )
    if (!caption || !right) throw new Error('Missing caption field or alignment button')

    right.click()
    caption.value = 'Şekil 1'
    panel.querySelector<HTMLButtonElement>('.ve-image-actions .ve-primary')?.click()

    expect(right.getAttribute('aria-pressed')).toBe('true')
    expect(editor.getHTML()).toMatch(
      /^<figure data-align="right"><img [^>]*alt="Grafik"[^>]*><figcaption>Şekil 1<\/figcaption><\/figure>/,
    )
  })

  it('offers the file picker only when uploads are possible and uploads the chosen files', async () => {
    const uploaded: string[] = []
    const upload = async (file: File): Promise<string> => {
      uploaded.push(file.name)
      return 'https://cdn.example.com/u/1.png'
    }
    const plain = await mount('<p>Metin</p>', { locale: 'tr' }, [...basicExtensions, Image])
    plain.editor.focus()
    tool(plain.root, 'image').click()
    const { editor, root } = await mount('<p>Metin</p>', { locale: 'tr' }, [
      ...basicExtensions,
      Image.configure({ upload }),
    ])
    editor.focus()
    tool(root, 'image').click()
    const panel = imagePanel(root)
    const picker = panel.querySelector<HTMLInputElement>('input[type="file"]')
    if (!picker) throw new Error('Missing file input')
    const file = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
      'a.png',
      {
        type: 'image/png',
      },
    )
    Object.defineProperty(picker, 'files', { configurable: true, value: [file] })

    picker.dispatchEvent(new Event('change'))
    await new Promise((resolve) => setTimeout(resolve, 20))

    expect(
      (imagePanel(plain.root).querySelector('.ve-image-upload-row') as HTMLElement).hidden,
    ).toBe(true)
    expect(panel.hidden).toBe(true)
    expect(uploaded).toEqual(['a.png'])
    expect(editor.getHTML()).toContain('https://cdn.example.com/u/1.png')
  })
})

describe('embed panel', () => {
  function embedPanel(root: HTMLElement): HTMLElement {
    const panel = root.querySelector<HTMLElement>('.ve-embed-panel')
    if (!panel) throw new Error('Missing embed panel')
    return panel
  }

  function submit(panel: HTMLElement, value: string): HTMLInputElement {
    const input = panel.querySelector<HTMLInputElement>('input')
    if (!input) throw new Error('Missing embed input')
    input.value = value
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    return input
  }

  it('inserts a YouTube link as an embed and names the supported sites', async () => {
    const { editor, root } = await mount('<p>Metin</p>', { locale: 'tr' }, [
      ...basicExtensions,
      Embed,
    ])
    editor.focus()
    tool(root, 'embed').click()
    const panel = embedPanel(root)

    expect(panel.querySelector('[aria-live]')?.textContent).toBe(
      'Desteklenenler: YouTube, Vimeo, Spotify',
    )
    submit(panel, 'https://youtu.be/dQw4w9WgXcQ')

    expect(panel.hidden).toBe(true)
    expect(editor.getHTML()).toContain('data-embed="youtube" data-id="dQw4w9WgXcQ"')
  })

  it('keeps the panel open and explains when the link is not supported', async () => {
    const { editor, root } = await mount('<p>Metin</p>', { locale: 'tr' }, [
      ...basicExtensions,
      Embed,
    ])
    editor.focus()
    tool(root, 'embed').click()
    const panel = embedPanel(root)

    const input = submit(panel, 'https://evil.com/video')

    expect(panel.hidden).toBe(false)
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(panel.querySelector('[aria-live]')?.textContent).toContain('desteklenmiyor')
    expect(editor.getHTML()).not.toContain('data-embed')
  })

  it('edits the title of the selected embed', async () => {
    const { editor, root } = await mount(
      '<div data-embed="youtube" data-id="dQw4w9WgXcQ"></div><p>Alt</p>',
      { locale: 'tr' },
      [...basicExtensions, Embed],
    )
    editor.focus()
    editor.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }),
    )
    tool(root, 'embed').click()
    const panel = embedPanel(root)

    expect(panel.querySelector('label')?.textContent).toBe('Başlık')
    submit(panel, 'Tanıtım videosu')

    expect(editor.getHTML()).toContain('data-title="Tanıtım videosu"')
  })
})

describe('link panel', () => {
  it('refuses a javascript: address and explains why', async () => {
    const { editor, root } = await mount()
    editor.commands.selectAll()
    tool(root, 'link').click()
    const input = root.querySelector<HTMLInputElement>('.ve-link input')
    if (!input) throw new Error('Missing link input')

    input.value = 'javascript:alert(1)'
    input.dispatchEvent(new Event('input'))
    root.querySelector<HTMLButtonElement>('.ve-link .ve-primary')?.click()

    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(root.querySelector('.ve-link .ve-hint')?.textContent).toContain('kabul edilmez')
    expect(editor.getHTML()).toBe('<p>Merhaba dünya</p>')
  })

  it('adds https:// to a bare domain and links the selection', async () => {
    const { editor, root } = await mount()
    editor.commands.selectAll()
    tool(root, 'link').click()
    const input = root.querySelector<HTMLInputElement>('.ve-link input')
    if (!input) throw new Error('Missing link input')

    input.value = 'viveeditor.dev/kurulum'
    root.querySelector<HTMLButtonElement>('.ve-link .ve-primary')?.click()

    expect(editor.getHTML()).toContain('href="https://viveeditor.dev/kurulum"')
    expect(root.querySelector<HTMLElement>('.ve-link')?.hidden).toBe(true)
  })

  it('asks for a selection instead of linking nothing', async () => {
    const { root } = await mount()

    tool(root, 'link').click()

    expect(root.querySelector('.ve-link .ve-hint')?.textContent).toBe(
      'Önce bağlantı yapılacak metni seçin.',
    )
    expect(root.querySelector<HTMLInputElement>('.ve-link input')?.disabled).toBe(true)
  })
})

describe('normalizeHref', () => {
  it.each([
    ['viveeditor.dev', 'https://viveeditor.dev'],
    ['www.örnek.com.tr/a', 'https://www.örnek.com.tr/a'],
    ['ali@example.com', 'mailto:ali@example.com'],
    ['/hakkimizda', '/hakkimizda'],
    ['https://a.b', 'https://a.b'],
    ['  ', ''],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeHref(input)).toBe(expected)
  })
})

describe('measure', () => {
  it('shows the word count and opens the readability panel', async () => {
    const text = 'Bu bir deneme cümlesidir. Kısa ve anlaşılır yazmak önemlidir. Okur yorulmaz.'
    const { root } = await mount(`<p>${text}</p>`)
    const count = root.querySelector<HTMLButtonElement>('.ve-count')

    count?.click()

    expect(count?.textContent).toBe('11 kelime')
    expect(count?.getAttribute('aria-expanded')).toBe('true')
    expect(root.querySelector('.ve-numeral')?.textContent).toBe('91')
    expect(root.querySelector('.ve-chip')?.textContent).toBe('Çok kolay')
  })

  it('omits the readability score when disabled', async () => {
    const { root } = await mount('<p>a</p>', { locale: 'tr', readability: false })

    root.querySelector<HTMLButtonElement>('.ve-count')?.click()

    expect(root.querySelector('.ve-numeral')).toBeNull()
    expect(root.querySelector('.ve-stats')).not.toBeNull()
  })
})

describe('source view', () => {
  const rich = [
    ...basicExtensions,
    ...listExtensions,
    ...taskListExtensions,
    CodeBlock,
    Table,
    Image,
    Embed,
  ]
  const content = [
    '<h2>Başlık</h2>',
    '<ul><li><p>bir</p><ul><li><p>iki</p></li></ul></li></ul>',
    '<pre><code>  girintili\n    kod</code></pre>',
    '<table><tbody><tr><th><p>A</p></th><td><p>B</p></td></tr></tbody></table>',
    '<div data-embed="youtube" data-id="dQw4w9WgXcQ"></div>',
    '<p>son <strong>kalın</strong></p>',
  ].join('')

  function sourceArea(root: HTMLElement): HTMLTextAreaElement {
    const area = root.querySelector<HTMLTextAreaElement>('textarea.ve-source')
    if (!area) throw new Error('Missing source view')
    return area
  }

  it('shows indented HTML that loads back into the same document', async () => {
    const { editor, root } = await mount(content, { locale: 'tr' }, rich)
    const before = editor.getHTML()

    tool(root, 'source').click()
    const area = sourceArea(root)

    expect(area.value).toContain('<ul>\n  <li>\n    <p>bir</p>\n    <ul>')
    expect(area.value).toContain('<pre><code>  girintili\n    kod</code></pre>')
    expect(document.activeElement).toBe(area)
    expect(tool(root, 'source').getAttribute('aria-pressed')).toBe('true')
    expect(tool(root, 'bold').getAttribute('aria-disabled')).toBe('true')
    editor.commands.replaceContent(area.value)
    expect(editor.getHTML()).toBe(before)
  })

  it('applies edited source when closed and drops unsafe markup', async () => {
    const { editor, root } = await mount('<p>ilk</p>', { locale: 'tr' }, rich)
    tool(root, 'source').click()
    const area = sourceArea(root)

    area.value = '<p onclick="x()">yeni</p><script>alert(1)</script><img src="javascript:x">'
    tool(root, 'source').click()

    expect(area.hidden).toBe(true)
    expect(root.dataset.source).toBeUndefined()
    expect(editor.getHTML()).toBe('<p>yeni</p>')
    expect(tool(root, 'bold').getAttribute('aria-disabled')).toBe('false')
  })

  it('applies the source when the field loses focus so a form submit gets it', async () => {
    const { editor, root } = await mount('<p>ilk</p>', { locale: 'tr' }, rich)
    tool(root, 'source').click()
    const area = sourceArea(root)

    area.value = '<p>kaydedilecek</p>'
    area.dispatchEvent(new Event('change'))

    expect(area.hidden).toBe(false)
    expect(editor.getHTML()).toBe('<p>kaydedilecek</p>')
  })

  it('leaves out the source tool when turned off', async () => {
    const { root } = await mount('<p>metin</p>', { locale: 'tr', source: false }, rich)

    expect(root.querySelector('[data-tool="source"]')).toBeNull()
  })

  it('keeps unexpected top-level text as it is', () => {
    expect(formatHtml('metin<p>a</p>')).toBe('metin<p>a</p>')
  })
})

describe('printableHtml', () => {
  it('wraps the content in a page that loads nothing but images and styles', async () => {
    const { editor } = await mount('<p>Rapor <strong>özeti</strong></p>')

    const page = printableHtml(editor, { title: 'Rapor <1>', css: 'h1{color:red}' })

    expect(page.startsWith('<!DOCTYPE html><html>')).toBe(true)
    expect(page).toContain(
      `content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https: data:"`,
    )
    expect(page).toContain('<meta name="referrer" content="no-referrer">')
    expect(page).toContain('<title>Rapor &lt;1&gt;</title>')
    expect(page).toContain('h1{color:red}</style>')
    expect(page).toContain('<body><p>Rapor <strong>özeti</strong></p></body>')
  })

  it('prints players as links and never carries an iframe', async () => {
    const { editor } = await mount(
      '<div data-embed="youtube" data-id="dQw4w9WgXcQ" data-title="Tanıtım"></div>',
      { locale: 'tr' },
      [...basicExtensions, Embed],
    )

    const page = printableHtml(editor)

    expect(page).not.toContain('<iframe')
    expect(page).toContain(
      '<a href="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ">Tanıtım</a>',
    )
  })
})

describe('lifecycle', () => {
  it('removes everything it added on destroy', async () => {
    const { ui, root } = await mount()

    ui.destroy()

    expect(root.classList.contains('ve-root')).toBe(false)
    expect(root.querySelector('.ve-dock, .ve-bubble, .ve-slash, .ve-link')).toBeNull()
    expect(root.querySelector('.vive-content')).not.toBeNull()
  })

  it('tears itself down when the editor is destroyed', async () => {
    const { editor, root } = await mount()

    editor.destroy()

    expect(root.querySelector('.ve-dock')).toBeNull()
  })

  it('hides the toolbar for a read-only editor', async () => {
    const { editor, ui, root } = await mount()

    editor.setEditable(false)
    ui.refresh()

    expect(root.querySelector<HTMLElement>('.ve-dock')?.hidden).toBe(true)
  })
})

describe('format tools', () => {
  const extensions = [...basicExtensions, ...listExtensions, ...formatExtensions]

  it('colours the selection from the text colour panel', async () => {
    const { editor, root } = await mount('<p>renk</p>', { locale: 'tr' }, extensions)
    editor.commands.selectAll()

    tool(root, 'textColor').click()
    root.querySelector<HTMLButtonElement>('.ve-swatch[aria-label="Mavi"]')?.click()

    expect(editor.getAttributes('textColor').color).toBe('#1565c0')
    expect(tool(root, 'textColor').getAttribute('aria-expanded')).toBe('false')
  })

  it('applies a typed colour code and lists it under recent colours next time', async () => {
    const { editor, root } = await mount('<p>renk</p>', { locale: 'tr' }, extensions)
    editor.commands.selectAll()
    tool(root, 'textColor').click()
    const code = root.querySelector<HTMLInputElement>(
      '.ve-swatches[aria-label="Yazı rengi"] .ve-color-code',
    )
    if (!code) throw new Error('Missing colour code field')

    code.value = '1A73E8'
    code.form?.requestSubmit()
    tool(root, 'textColor').click()

    expect(editor.getAttributes('textColor').color).toBe('#1a73e8')
    expect(
      root
        .querySelector(
          '.ve-swatches[aria-label="Yazı rengi"] .ve-recent-colors [aria-label="#1a73e8"]',
        )
        ?.getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('keeps the panel open and flags an invalid colour code', async () => {
    const { editor, root } = await mount('<p>renk</p>', { locale: 'tr' }, extensions)
    editor.commands.selectAll()
    tool(root, 'highlight').click()
    const code = root.querySelector<HTMLInputElement>(
      '.ve-swatches[aria-label="Vurgu"] .ve-color-code',
    )
    if (!code) throw new Error('Missing colour code field')

    code.value = 'url(x)'
    code.form?.requestSubmit()

    expect(code.getAttribute('aria-invalid')).toBe('true')
    expect(tool(root, 'highlight').getAttribute('aria-expanded')).toBe('true')
    expect(editor.getHTML()).toBe('<p>renk</p>')
  })

  describe('custom colour picker', () => {
    const openPicker = async (html = '<p><span style="color: #1a73e8">renk</span></p>') => {
      const { editor, root } = await mount(html, { locale: 'tr' }, extensions)
      editor.commands.selectAll()
      tool(root, 'textColor').click()
      const panel = root.querySelector<HTMLElement>('.ve-swatches[aria-label="Yazı rengi"]')
      if (!panel) throw new Error('Missing text colour panel')
      const toggle = panel.querySelector<HTMLButtonElement>('.ve-color-toggle')
      const form = panel.querySelector<HTMLFormElement>('.ve-color-form')
      const area = panel.querySelector<HTMLElement>('.ve-color-area')
      const hue = panel.querySelector<HTMLInputElement>('.ve-color-hue')
      const code = panel.querySelector<HTMLInputElement>('.ve-color-code')
      if (!toggle || !form || !area || !hue || !code) throw new Error('Missing picker part')
      return { editor, root, panel, toggle, form, area, hue, code }
    }
    const preview = (form: HTMLElement): string => form.style.getPropertyValue('--ve-swatch')

    it('renders no native colour input and starts from the current colour', async () => {
      const { root, code, area } = await openPicker()

      expect(root.querySelector('input[type="color"]')).toBeNull()
      expect(code.value).toBe('#1a73e8')
      expect(area.getAttribute('aria-valuetext')).toBe('#1a73e8')
    })

    it('starts from a meaningful colour instead of black when nothing is set', async () => {
      const { code } = await openPicker('<p>renk</p>')

      expect(code.value).toMatch(/^#[\da-f]{6}$/)
      expect(code.value).not.toBe('#000000')
    })

    it('toggles the disclosure and its aria-expanded state', async () => {
      const { toggle, form } = await openPicker()

      expect(toggle.getAttribute('aria-expanded')).toBe('false')
      expect(form.hidden).toBe(true)
      toggle.click()
      expect(toggle.getAttribute('aria-expanded')).toBe('true')
      expect(form.hidden).toBe(false)
      expect(toggle.getAttribute('aria-controls')).toBe(form.id)
      toggle.click()
      expect(form.hidden).toBe(true)
    })

    it('moves saturation and brightness with the arrow keys', async () => {
      const { area, code } = await openPicker()
      const key = (name: string, shiftKey = false) =>
        area.dispatchEvent(new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true }))
      const before = area.getAttribute('aria-valuetext')

      key('ArrowDown', true)
      key('ArrowLeft')

      expect(area.getAttribute('aria-valuetext')).not.toBe(before)
      expect(area.getAttribute('aria-valuetext')).toBe(code.value)
      expect(Number(area.getAttribute('aria-valuenow'))).toBeLessThan(90)
    })

    it('changes the preview from the hue slider', async () => {
      const { form, hue, code } = await openPicker()
      const before = preview(form)

      hue.value = '120'
      hue.dispatchEvent(new Event('input', { bubbles: true }))

      expect(preview(form)).not.toBe(before)
      expect(preview(form)).toBe(code.value)
    })

    it('applies the typed hex on Enter and closes the panel', async () => {
      const { editor, root, toggle, code } = await openPicker()
      toggle.click()

      code.value = '#0f766e'
      code.dispatchEvent(new Event('input', { bubbles: true }))
      code.form?.requestSubmit()

      expect(editor.getAttributes('textColor').color).toBe('#0f766e')
      expect(tool(root, 'textColor').getAttribute('aria-expanded')).toBe('false')
    })

    it('applies the colour picked on the area with Enter', async () => {
      const { editor, area, code } = await openPicker()

      area.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
      const picked = code.value
      area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))

      expect(editor.getAttributes('textColor').color).toBe(picked)
    })
  })

  it('marks the current highlight and removes it', async () => {
    const { editor, root } = await mount('<p><mark>vurgu</mark></p>', { locale: 'tr' }, extensions)
    editor.commands.selectAll()

    tool(root, 'highlight').click()
    const pressed = root.querySelector('.ve-swatches[aria-label="Vurgu"] [aria-pressed="true"]')
    root.querySelector<HTMLButtonElement>('.ve-swatches[aria-label="Vurgu"] .ve-clear')?.click()

    expect(pressed?.getAttribute('aria-label')).toBe('Sarı')
    expect(editor.getHTML()).toBe('<p>vurgu</p>')
  })

  it('centers the paragraph from the alignment menu and shows its icon', async () => {
    const { editor, ui, root } = await mount('<p>orta</p>', { locale: 'tr' }, extensions)

    tool(root, 'align').click()
    ;[...root.querySelectorAll<HTMLButtonElement>('.ve-menu .ve-item')]
      .find((item) => item.textContent?.startsWith('Ortala'))
      ?.click()
    ui.refresh()

    expect(editor.query.textAlign()).toBe('center')
    expect(tool(root, 'align').dataset.icon).toBe('alignCenter')
  })

  it('closes the colour panel with Escape and returns focus to its button', async () => {
    const { root } = await mount('<p>a</p>', { locale: 'tr' }, extensions)
    const button = tool(root, 'textColor')

    button.click()
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )

    expect(root.querySelector<HTMLElement>('.ve-swatches')?.hidden).toBe(true)
    expect(document.activeElement).toBe(button)
  })

  it('clears formatting from the toolbar button and keeps the link', async () => {
    const { editor, ui, root } = await mount(
      '<p style="text-align: center"><strong>kalın</strong> <a href="https://example.com">bağ</a></p>',
      { locale: 'tr' },
      extensions,
    )
    editor.commands.selectAll()
    ui.refresh()
    const button = tool(root, 'clearFormatting')

    button.click()
    ui.refresh()

    expect(button.getAttribute('aria-label')).toMatch(/^Biçimi temizle \(/)
    expect(editor.getHTML()).toBe(
      '<p>kalın <a rel="noopener noreferrer nofollow" href="https://example.com">bağ</a></p>',
    )
    expect(button.getAttribute('aria-disabled')).toBe('true')
  })

  it('shows clear formatting in the selection bubble', async () => {
    const { root } = await mount('<p>a</p>', { locale: 'en' }, extensions)

    const bubbleButton = root.querySelector('.ve-bubble [data-tool="clearFormatting"]')

    expect(bubbleButton?.getAttribute('aria-label')).toMatch(/^Clear formatting \(/)
  })

  it('leaves the clear formatting button out when the command is missing', async () => {
    const { root } = await mount('<p>a</p>', { locale: 'tr' }, [...basicExtensions])

    const button = root.querySelector('[data-tool="clearFormatting"]')

    expect(button).toBeNull()
  })

  it('arms the format painter from the toolbar and shows it as pressed', async () => {
    const { editor, ui, root } = await mount(
      '<p><strong>kalın</strong> düz</p>',
      { locale: 'tr' },
      extensions,
    )
    editor.commands.setTextSelection(2)
    const button = tool(root, 'formatPainter')

    button.click()
    ui.refresh()
    const armed = [button.getAttribute('aria-pressed'), editor.query.isPaintingFormat()]
    editor.commands.setTextSelection(7, 10)
    editor.commands.applyFormat()
    ui.refresh()

    expect(button.getAttribute('aria-label')).toBe('Biçim boyacısı')
    expect(armed).toEqual(['true', true])
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(editor.getHTML()).toBe('<p><strong>kalın</strong> <strong>düz</strong></p>')
  })
})

describe('text style and indent menus', () => {
  const extensions = [...basicExtensions, ...listExtensions, ...formatExtensions]

  beforeAll(() => {
    Range.prototype.getBoundingClientRect ??= () => new DOMRect()
    Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList
  })

  function menuNamed(root: HTMLElement, name: string): HTMLElement {
    const menu = root.querySelector<HTMLElement>(`[role="menu"][aria-label="${name}"]`)
    if (!menu) throw new Error(`Missing menu ${name}`)
    return menu
  }

  function item(menu: HTMLElement, label: string): HTMLButtonElement {
    const found = [...menu.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.querySelector('.ve-item-label')?.textContent?.startsWith(label),
    )
    if (!found) throw new Error(`Missing item ${label}`)
    return found
  }

  it('sets the size, superscript and case of the selection from the size control and text style menu', async () => {
    const { editor, root } = await mount('<p>istanbul su</p>', { locale: 'tr' }, extensions)
    editor.commands.setTextSelection(1, 9)

    tool(root, 'fontSize').click()
    root
      .querySelector<HTMLButtonElement>('.ve-font-size [aria-label="Yazı boyutu: 18 pt"]')
      ?.click()
    tool(root, 'textStyle').click()
    const menu = menuNamed(root, 'Yazı biçimi')
    item(menu, 'BÜYÜK HARF').click()
    editor.commands.setTextSelection(11, 12)
    tool(root, 'textStyle').click()
    item(menu, 'Alt simge').click()
    tool(root, 'textStyle').click()
    const checked = [...menu.querySelectorAll('[aria-checked="true"]')].map(
      (element) => element.querySelector('.ve-item-label')?.textContent,
    )

    expect(editor.getHTML().replace(/;"/g, '"')).toBe(
      '<p><span style="font-size: 18pt">İSTANBUL</span> s<sub>u</sub></p>',
    )
    expect(checked).toEqual(['Alt simge'])
  })

  it('indents and outdents from the alignment menu', async () => {
    const { editor, root } = await mount('<p>girinti</p>', { locale: 'tr' }, extensions)
    editor.commands.setTextSelection(2)

    tool(root, 'align').click()
    const menu = menuNamed(root, 'Hizalama')
    item(menu, 'Girintiyi artır').click()
    const indented = editor.getHTML().replace(/;"/g, '"')
    tool(root, 'align').click()
    const outdentDisabled = item(menu, 'Girintiyi azalt').getAttribute('aria-disabled')
    item(menu, 'Girintiyi azalt').click()

    expect(indented).toBe('<p style="margin-inline-start: 2em">girinti</p>')
    expect(outdentDisabled).not.toBe('true')
    expect(editor.getHTML()).toBe('<p>girinti</p>')
  })

  it('inserts a special character from the chosen category', async () => {
    const { editor, root } = await mount('<p>fiyat</p>', { locale: 'tr' }, extensions)
    editor.commands.setTextSelection(6)
    const button =
      root.querySelector<HTMLButtonElement>('.ve-pill [data-tool="specialCharacters"]') ?? null
    if (!button) throw new Error('Missing special characters tool')

    button.click()
    const panel = root.querySelector<HTMLElement>('[role="dialog"][aria-label="Özel karakter"]')
    const select = panel?.querySelector('select')
    if (!panel || !select) throw new Error('Missing panel')
    select.value = '1'
    select.dispatchEvent(new Event('change'))
    const first = panel.querySelector<HTMLButtonElement>('.ve-char')
    first?.focus()
    first?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    const focused = document.activeElement?.textContent
    first?.click()

    expect(focused).toBe('€')
    expect(editor.getHTML()).toBe('<p>fiyat₺</p>')
    expect(panel.hidden).toBe(true)
  })

  it('leaves the text style button out without the extensions', async () => {
    const { root } = await mount('<p>a</p>', { locale: 'tr' })

    expect(root.querySelector('[data-tool="textStyle"]')).toBeNull()
  })
})

describe('font size control', () => {
  const extensions = [...basicExtensions, ...listExtensions, ...formatExtensions]
  const panel = (root: HTMLElement): HTMLElement => {
    const found = root.querySelector<HTMLElement>('[role="dialog"][aria-label="Yazı boyutu"]')
    if (!found) throw new Error('Missing font size panel')
    return found
  }
  const field = (root: HTMLElement): HTMLInputElement => {
    const found = panel(root).querySelector<HTMLInputElement>('.ve-size-field')
    if (!found) throw new Error('Missing font size field')
    return found
  }
  const submit = (root: HTMLElement, value: string): void => {
    field(root).value = value
    field(root).form?.requestSubmit()
  }
  const html = (editor: Editor): string => editor.getHTML().replace(/;"/g, '"')

  it('shows the current size in points on its button', async () => {
    const { editor, ui, root } = await mount(
      '<p>düz <span style="font-size: 10.5pt">küçük</span></p>',
      { locale: 'tr' },
      extensions,
    )
    const plain = [tool(root, 'fontSize').textContent, tool(root, 'fontSize').ariaLabel]
    editor.commands.setTextSelection(7)

    ui.refresh()

    expect(plain).toEqual(['12', 'Yazı boyutu: 12 pt'])
    expect(tool(root, 'fontSize').textContent).toBe('10,5')
    expect(tool(root, 'fontSize').getAttribute('aria-label')).toBe('Yazı boyutu: 10,5 pt')
  })

  it('applies a typed size, closes and returns to the editor', async () => {
    const { editor, root } = await mount('<p>boyut</p>', { locale: 'tr' }, extensions)
    editor.commands.selectAll()
    tool(root, 'fontSize').click()
    const focused = document.activeElement

    submit(root, '18')

    expect(focused).toBe(field(root))
    expect(html(editor)).toBe('<p><span style="font-size: 18pt">boyut</span></p>')
    expect(panel(root).hidden).toBe(true)
    expect(tool(root, 'fontSize').getAttribute('aria-expanded')).toBe('false')
  })

  it.each([
    ['12,5', '12.5pt'],
    ['12.5', '12.5pt'],
    ['12pt', '12pt'],
    ['13,3', '13.5pt'],
  ])('reads %s as %s', async (typed, size) => {
    const { editor, root } = await mount('<p>boyut</p>', { locale: 'tr' }, extensions)
    editor.commands.selectAll()
    tool(root, 'fontSize').click()

    submit(root, typed)

    expect(html(editor)).toBe(`<p><span style="font-size: ${size}">boyut</span></p>`)
  })

  it.each(['abc', '120', '5', ''])('flags %j and keeps the panel open', async (typed) => {
    const { editor, root } = await mount('<p>boyut</p>', { locale: 'tr' }, extensions)
    editor.commands.selectAll()
    tool(root, 'fontSize').click()

    submit(root, typed)

    expect(field(root).getAttribute('aria-invalid')).toBe('true')
    expect(panel(root).querySelector('.ve-hint')?.textContent).toContain('6 ile 96 arasında')
    expect(panel(root).hidden).toBe(false)
    expect(html(editor)).toBe('<p>boyut</p>')
  })

  it('steps through the presets with − and + and keeps the panel open', async () => {
    const { editor, root } = await mount('<p>boyut</p>', { locale: 'tr' }, extensions)
    editor.commands.selectAll()
    tool(root, 'fontSize').click()
    const larger = panel(root).querySelector<HTMLButtonElement>('[aria-label="Yazıyı büyüt"]')
    const smaller = panel(root).querySelector<HTMLButtonElement>('[aria-label="Yazıyı küçült"]')

    larger?.click()
    larger?.click()
    const grown = [editor.query.fontSize(), field(root).value]
    smaller?.click()

    expect(grown).toEqual(['16pt', '16'])
    expect(editor.query.fontSize()).toBe('14pt')
    expect(panel(root).querySelector('.ve-size-preset[aria-pressed="true"]')?.textContent).toBe(
      '14',
    )
    expect(panel(root).hidden).toBe(false)
  })

  it('goes back to the default size', async () => {
    const { editor, root } = await mount(
      '<p><span style="font-size: 20pt">boyut</span></p>',
      { locale: 'tr' },
      extensions,
    )
    editor.commands.selectAll()
    tool(root, 'fontSize').click()

    panel(root).querySelector<HTMLButtonElement>('.ve-clear')?.click()

    expect(html(editor)).toBe('<p>boyut</p>')
    expect(panel(root).hidden).toBe(true)
  })

  it('moves through the presets with the arrow keys and closes with Escape', async () => {
    const { root } = await mount('<p>boyut</p>', { locale: 'tr' }, extensions)
    const button = tool(root, 'fontSize')
    button.click()
    const pressed = panel(root).querySelector<HTMLButtonElement>('.ve-size-preset[tabindex="0"]')
    pressed?.focus()

    pressed?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    const right = document.activeElement?.textContent
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
    )
    const down = document.activeElement?.textContent
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )

    expect([pressed?.textContent, right, down]).toEqual(['12', '14', '28'])
    expect(panel(root).hidden).toBe(true)
    expect(document.activeElement).toBe(button)
  })

  it('opens from the overflow menu when the toolbar is narrow', async () => {
    const { editor, root } = await mount('<p>boyut</p>', { locale: 'tr' }, extensions)
    editor.commands.selectAll()
    tool(root, 'fontSize').hidden = true
    root.querySelector<HTMLButtonElement>('.ve-more')?.click()

    ;[...root.querySelectorAll<HTMLButtonElement>('[role="menu"] .ve-item')]
      .find((entry) => entry.textContent?.includes('Yazı boyutu'))
      ?.click()
    submit(root, '24')

    expect(html(editor)).toBe('<p><span style="font-size: 24pt">boyut</span></p>')
  })

  it('leaves the size control out without the extension', async () => {
    const { root } = await mount('<p>a</p>', { locale: 'tr' })

    expect(root.querySelector('[data-tool="fontSize"]')).toBeNull()
  })
})

describe('paste options', () => {
  const extensions = [...basicExtensions, ...listExtensions, ...formatExtensions]

  function paste(editor: Editor, data: Record<string, string>): void {
    const entries = new Map(Object.entries(data))
    const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', {
      value: {
        getData: (type: string) => entries.get(type) ?? '',
        files: [],
        types: [...entries.keys()],
      },
    })
    editor.dom.dispatchEvent(event)
  }

  it('offers the three paste modes and switches to text only', async () => {
    const { editor, root } = await mount('<p></p>', { locale: 'tr' }, extensions)
    paste(editor, {
      'text/html': '<p><strong>kalın</strong> metin</p>',
      'text/plain': 'kalın metin',
    })
    const trigger = root.querySelector<HTMLButtonElement>('.ve-paste button')

    trigger?.click()
    const menu = root.querySelector<HTMLElement>(
      '[role="menu"][aria-label="Yapıştırma seçenekleri"]',
    )
    const items = [...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [])]
    const states = items.map((item) => [item.textContent, item.getAttribute('aria-checked')])
    items[2]?.click()

    expect(trigger?.getAttribute('aria-label')).toBe('Yapıştırma seçenekleri (Ctrl)')
    expect(states).toEqual([
      ['Biçimi koru', 'true'],
      ['Yalnızca başlık, liste ve bağlantıları koru', 'false'],
      ['Yalnızca metin', 'false'],
    ])
    expect(menu?.hidden).toBe(true)
    expect(editor.getHTML()).toBe('<p>kalın metin</p>')
  })

  it('leaves the paste options out without the extension', async () => {
    const { root } = await mount('<p></p>', { locale: 'tr' })

    expect(root.querySelector('.ve-paste')).toBeNull()
  })
})

describe('panels loaded on first use', () => {
  const extensions = [...basicExtensions, ...listExtensions, ...formatExtensions]
  const panel = (root: HTMLElement): HTMLElement | null =>
    root.querySelector<HTMLElement>('.ve-swatches[aria-label="Yazı rengi"]')
  const placeholder = (root: HTMLElement): HTMLElement | null =>
    root.querySelector<HTMLElement>('.ve-loading:not([hidden])')

  it('shows a loading state, then opens the panel once it has loaded', async () => {
    const pending: { finish?: (kit: typeof panelKit) => void } = {}
    const panels = () =>
      new Promise<typeof panelKit>((resolve) => {
        pending.finish = resolve
      })
    const { editor, root } = await mount('<p>renk</p>', { locale: 'tr', panels }, extensions)
    editor.commands.selectAll()

    tool(root, 'textColor').click()
    const loading = placeholder(root)
    await vi.waitFor(() => expect(pending.finish).toBeDefined())
    pending.finish?.(panelKit)
    await vi.waitFor(() => expect(panel(root)?.hidden).toBe(false))

    expect(loading?.textContent).toContain('Yükleniyor…')
    expect(loading?.getAttribute('role')).toBe('status')
    expect(loading?.isConnected).toBe(false)
    expect(tool(root, 'textColor').getAttribute('aria-expanded')).toBe('true')
  })

  it('reports a failed load and opens the panel after a retry', async () => {
    const onError = vi.fn()
    const panels = vi
      .fn<() => Promise<typeof panelKit>>()
      .mockRejectedValueOnce(new Error('ağ yok'))
      .mockResolvedValue(panelKit)
    const { editor, root } = await mount(
      '<p>renk</p>',
      { locale: 'tr', panels, onError },
      extensions,
    )
    editor.commands.selectAll()

    tool(root, 'textColor').click()
    await vi.waitFor(() => expect(placeholder(root)?.textContent).toContain('yüklenemedi'))
    root.querySelector<HTMLButtonElement>('.ve-loading .ve-retry')?.click()
    await vi.waitFor(() => expect(panel(root)?.hidden).toBe(false))

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'ağ yok' }))
    expect(panels).toHaveBeenCalledTimes(2)
  })

  it('closes the loading state with Escape and returns focus to the tool', async () => {
    const panels = () => new Promise<typeof panelKit>(() => {})
    const { editor, root } = await mount('<p>renk</p>', { locale: 'tr', panels }, extensions)
    editor.commands.selectAll()
    tool(root, 'textColor').click()

    const loading = placeholder(root)

    loading?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(loading?.hidden).toBe(true)
    expect(tool(root, 'textColor').getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(tool(root, 'textColor'))
  })
})

describe('font family menu', () => {
  const extensions = [...basicExtensions, ...listExtensions, ...formatExtensions]
  const menuOf = (root: HTMLElement): HTMLElement => {
    const menu = root.querySelector<HTMLElement>('.ve-menu[aria-label="Yazı tipi"]')
    if (!menu) throw new Error('Missing font family menu')
    return menu
  }
  const labels = (menu: HTMLElement): string[] =>
    [...menu.querySelectorAll('.ve-item-label')].map((label) => label.textContent ?? '')

  it('applies a family from the menu and shows its name on the button', async () => {
    const { editor, ui, root } = await mount('<p>yazı</p>', { locale: 'tr' }, extensions)
    editor.commands.selectAll()

    tool(root, 'fontFamily').click()
    const arial = menuOf(root).querySelector<HTMLButtonElement>('[data-item="fontFamily-3"]')
    arial?.click()
    ui.refresh()

    expect(arial?.querySelector<HTMLElement>('.ve-item-label')?.style.fontFamily).toContain('Arial')
    expect(editor.getHTML()).toMatch(
      /^<p><span style="font-family: Arial, Helvetica, sans-serif;?">yazı<\/span><\/p>$/,
    )
    expect(tool(root, 'fontFamily').textContent).toBe('Arial')
    expect(tool(root, 'fontFamily').getAttribute('aria-label')).toBe('Yazı tipi: Arial')
  })

  it('translates generic names, checks the current one and unsets it with the default item', async () => {
    const { editor, ui, root } = await mount(
      '<p><span style="font-family: serif">yazı</span></p>',
      { locale: 'tr' },
      extensions,
    )
    editor.commands.selectAll()
    ui.refresh()
    const shown = tool(root, 'fontFamily').textContent

    tool(root, 'fontFamily').click()
    const menu = menuOf(root)
    const checked = menu.querySelector('[aria-checked="true"]')?.textContent
    menu.querySelector<HTMLButtonElement>('[data-item="fontFamily-default"]')?.click()
    ui.refresh()

    expect(shown).toBe('Tırnaklı')
    expect(checked).toBe('Tırnaklı')
    expect(labels(menu).slice(0, 4)).toEqual([
      'Varsayılan yazı tipi',
      'Tırnaklı',
      'Tırnaksız',
      'Eş aralıklı',
    ])
    expect(editor.getHTML()).toBe('<p>yazı</p>')
    expect(tool(root, 'fontFamily').textContent).toBe('Varsayılan')
  })

  it('lists only the families the host configured', async () => {
    const { root } = await mount('<p>yazı</p>', { locale: 'en' }, [
      ...basicExtensions,
      ...formatExtensions.filter((extension) => extension.name !== 'fontFamily'),
      FontFamily.configure({ fontFamilies: ["'Open Sans', sans-serif", 'monospace'] }),
    ])

    tool(root, 'fontFamily').click()

    expect(labels(root.querySelector<HTMLElement>('.ve-menu[aria-label="Font"]') ?? root)).toEqual([
      'Default font',
      'Open Sans',
      'Monospace',
    ])
  })
})

describe('line height menu', () => {
  const extensions = [...basicExtensions, ...formatExtensions]
  const menuOf = (root: HTMLElement): HTMLElement => {
    const menu = root.querySelector<HTMLElement>('.ve-menu[aria-label="Satır aralığı"]')
    if (!menu) throw new Error('Missing line height menu')
    return menu
  }

  it('sets the spacing and checks it the next time the menu opens', async () => {
    const { editor, ui, root } = await mount('<p>satır</p>', { locale: 'tr' }, extensions)
    editor.commands.selectAll()

    tool(root, 'lineHeight').click()
    menuOf(root).querySelector<HTMLButtonElement>('[data-item="lineHeight-1.5"]')?.click()
    ui.refresh()
    tool(root, 'lineHeight').click()

    expect(editor.getHTML()).toMatch(/^<p style="line-height: 1\.5;?">satır<\/p>$/)
    expect(
      menuOf(root).querySelector('[data-item="lineHeight-1.5"]')?.getAttribute('aria-checked'),
    ).toBe('true')
  })

  it('writes the values with the locale decimal separator', async () => {
    const { root } = await mount('<p>satır</p>', { locale: 'tr' }, extensions)

    tool(root, 'lineHeight').click()

    expect(
      [...menuOf(root).querySelectorAll('.ve-item-label')].map((label) => label.textContent),
    ).toEqual(['Tek (1)', '1,15', '1,5', 'Çift (2)', 'Varsayılan'])
  })

  it('removes the spacing with the default item', async () => {
    const { editor, root } = await mount(
      '<p style="line-height: 2">satır</p>',
      { locale: 'tr' },
      extensions,
    )
    editor.commands.selectAll()

    tool(root, 'lineHeight').click()
    menuOf(root).querySelector<HTMLButtonElement>('[data-item="lineHeight-default"]')?.click()

    expect(editor.getHTML()).toBe('<p>satır</p>')
  })
})

describe('list style panel', () => {
  const panelOf = (root: HTMLElement): HTMLElement => {
    const panel = root.querySelector<HTMLElement>('.ve-list-style')
    if (!panel) throw new Error('Missing list style panel')
    return panel
  }
  const choice = (root: HTMLElement, label: string): HTMLButtonElement => {
    const button = panelOf(root).querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)
    if (!button) throw new Error(`Missing choice ${label}`)
    return button
  }
  const startField = (root: HTMLElement): HTMLInputElement => {
    const field = panelOf(root).querySelector<HTMLInputElement>('.ve-list-start')
    if (!field) throw new Error('Missing start field')
    return field
  }

  it('gives a bulleted list square bullets and keeps numbering choices disabled', async () => {
    const { editor, ui, root } = await mount('<ul><li><p>a</p></li></ul>')
    editor.commands.setTextSelection(3)
    ui.refresh()

    tool(root, 'listStyle').click()
    const numbering = choice(root, 'A, B, C').getAttribute('aria-disabled')
    const start = startField(root).disabled
    choice(root, 'Kare').click()

    expect(numbering).toBe('true')
    expect(start).toBe(true)
    expect(editor.getHTML()).toMatch(
      /^<ul style="list-style-type: square;?"><li><p>a<\/p><\/li><\/ul>$/,
    )
  })

  it('sets the numbering type and the start number of a numbered list', async () => {
    const { editor, ui, root } = await mount('<ol><li><p>a</p></li></ol>')
    editor.commands.setTextSelection(3)
    ui.refresh()

    tool(root, 'listStyle').click()
    choice(root, 'A, B, C').click()
    ui.refresh()
    tool(root, 'listStyle').click()
    const pressed = choice(root, 'A, B, C').getAttribute('aria-pressed')
    startField(root).value = '3'
    startField(root).form?.requestSubmit()

    expect(pressed).toBe('true')
    expect(editor.getHTML()).toBe('<ol start="3" type="A"><li><p>a</p></li></ol>')
  })

  it('keeps an invalid start number flagged and the list unchanged', async () => {
    const { editor, ui, root } = await mount('<ol><li><p>a</p></li></ol>')
    editor.commands.setTextSelection(3)
    ui.refresh()

    tool(root, 'listStyle').click()
    startField(root).value = '-2'
    startField(root).form?.requestSubmit()

    expect(startField(root).getAttribute('aria-invalid')).toBe('true')
    expect(panelOf(root).querySelector<HTMLElement>('.ve-hint')?.hidden).toBe(false)
    expect(panelOf(root).hidden).toBe(false)
    expect(editor.getHTML()).toBe('<ol><li><p>a</p></li></ol>')
  })

  it('is disabled outside a list', async () => {
    const { ui, root } = await mount('<p>a</p>')
    ui.refresh()

    expect(tool(root, 'listStyle').getAttribute('aria-disabled')).toBe('true')
  })
})

describe('link panel new tab option', () => {
  const checkbox = (root: HTMLElement): HTMLInputElement => {
    const box = root.querySelector<HTMLInputElement>('.ve-link input[type="checkbox"]')
    if (!box) throw new Error('Missing new tab checkbox')
    return box
  }

  it('opens the link in a new tab and drops the target when unchecked', async () => {
    const { editor, root } = await mount()
    editor.commands.selectAll()
    tool(root, 'link').click()
    const input = root.querySelector<HTMLInputElement>('.ve-link input[type="text"]')
    if (!input) throw new Error('Missing link input')

    input.value = 'https://viveeditor.dev'
    checkbox(root).checked = true
    root.querySelector<HTMLButtonElement>('.ve-link .ve-primary')?.click()
    const opened = editor.getHTML()
    tool(root, 'link').click()
    const reflected = checkbox(root).checked
    checkbox(root).checked = false
    root.querySelector<HTMLButtonElement>('.ve-link .ve-primary')?.click()

    expect(opened).toContain('target="_blank"')
    expect(reflected).toBe(true)
    expect(editor.getHTML()).not.toContain('target=')
    expect(editor.getHTML()).toContain('href="https://viveeditor.dev"')
  })

  it('starts unchecked for a new link', async () => {
    const { editor, root } = await mount()
    editor.commands.selectAll()

    tool(root, 'link').click()

    expect(checkbox(root).checked).toBe(false)
    expect(root.querySelector('.ve-link .ve-checkbox')?.textContent).toBe('Yeni sekmede aç')
  })
})

describe('image link field', () => {
  const selectImage = async (content: string) => {
    const mounted = await mount(content, { locale: 'tr' }, [...basicExtensions, Image])
    mounted.editor.focus()
    mounted.editor.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }),
    )
    tool(mounted.root, 'image').click()
    const panel = mounted.root.querySelector<HTMLElement>('.ve-image-panel')
    const link = panel?.querySelector<HTMLInputElement>('input[id$="-link"]')
    if (!panel || !link) throw new Error('Missing image link field')
    return { ...mounted, panel, link }
  }
  const apply = (panel: HTMLElement): void => {
    panel.querySelector<HTMLButtonElement>('.ve-image-actions .ve-primary')?.click()
  }

  it('links the selected image', async () => {
    const { editor, panel, link } = await selectImage(
      '<img src="https://cdn.example.com/a.png" alt="Grafik"><p>Alt</p>',
    )

    link.value = 'example.com/sayfa'
    apply(panel)

    expect(editor.getHTML()).toMatch(/^<a [^>]*href="https:\/\/example\.com\/sayfa"[^>]*><img /)
  })

  it('removes the link when the field is emptied', async () => {
    const { editor, panel, link } = await selectImage(
      '<a href="https://example.com/"><img src="https://cdn.example.com/a.png" alt="Grafik"></a><p>Alt</p>',
    )
    const shown = link.value

    link.value = ''
    apply(panel)

    expect(shown).toBe('https://example.com/')
    expect(editor.getHTML()).not.toContain('<a ')
  })

  it('refuses an unsafe address and keeps the panel open', async () => {
    const { editor, panel, link } = await selectImage(
      '<img src="https://cdn.example.com/a.png" alt="Grafik"><p>Alt</p>',
    )

    link.value = 'javascript:alert(1)'
    link.dispatchEvent(new Event('input'))
    apply(panel)

    expect(link.getAttribute('aria-invalid')).toBe('true')
    expect(panel.querySelector('.ve-image-link .ve-hint')?.textContent).toContain('kabul edilmez')
    expect(panel.hidden).toBe(false)
    expect(editor.getHTML()).not.toContain('<a ')
  })
})
