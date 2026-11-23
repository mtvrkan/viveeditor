import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { CharacterCount } from '@viveeditor/ext-character-count'
import { CodeBlock } from '@viveeditor/ext-code-block'
import { Embed } from '@viveeditor/ext-embed'
import { formatExtensions } from '@viveeditor/ext-format'
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

    open().querySelector<HTMLButtonElement>('[aria-label="Mavi"]')?.click()
    const panel = open()
    const middle = [...panel.querySelectorAll<HTMLButtonElement>('.ve-cell-align button')].find(
      (button) => button.textContent === 'Orta',
    )
    const blue = panel.querySelector('[aria-label="Mavi"]')?.getAttribute('aria-pressed')
    middle?.click()

    expect(blue).toBe('true')
    expect(editor.query.cellStyle()).toEqual({ background: '#cde8ff', verticalAlign: 'middle' })
  })

  it('hides the cell style section outside a table', async () => {
    const { root } = await mount('<p></p>', { locale: 'tr' }, [...basicExtensions, Table])

    tool(root, 'table').click()

    expect(root.querySelector<HTMLElement>('.ve-cell-style')?.hidden).toBe(true)
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

  it('sets the size, superscript and case of the selection from the text style menu', async () => {
    const { editor, root } = await mount('<p>istanbul su</p>', { locale: 'tr' }, extensions)
    editor.commands.setTextSelection(1, 9)

    tool(root, 'textStyle').click()
    const menu = menuNamed(root, 'Yazı biçimi')
    item(menu, 'Büyük').click()
    tool(root, 'textStyle').click()
    item(menu, 'BÜYÜK HARF').click()
    editor.commands.setTextSelection(11, 12)
    tool(root, 'textStyle').click()
    item(menu, 'Alt simge').click()
    tool(root, 'textStyle').click()
    const checked = [...menu.querySelectorAll('[aria-checked="true"]')].map(
      (element) => element.querySelector('.ve-item-label')?.textContent,
    )

    expect(editor.getHTML().replace(/;"/g, '"')).toBe(
      '<p><span style="font-size: 1.25em">İSTANBUL</span> s<sub>u</sub></p>',
    )
    expect(checked).toEqual(['Normal boyut', 'Alt simge'])
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
