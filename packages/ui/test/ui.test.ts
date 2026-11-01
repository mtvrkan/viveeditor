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
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createUI,
  type EditorUI,
  normalizeHref,
  printableHtml,
  type UiOptions,
} from '../src/index.js'
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
