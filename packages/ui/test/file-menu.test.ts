import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { listExtensions } from '@viveeditor/ext-list'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createUI,
  type EditorUI,
  type MarkdownModule,
  safeFileName,
  type UiOptions,
} from '../src/index.js'
import * as panelKit from '../src/panel-kit.js'

let mounted: Array<{ editor: Editor; ui: EditorUI }> = []

async function mount(
  options: UiOptions,
  content = '',
): Promise<{ editor: Editor; ui: EditorUI; root: HTMLElement }> {
  const root = document.createElement('div')
  document.body.append(root)
  const editor = await Editor.create(root, {
    extensions: [...basicExtensions, ...listExtensions],
    content,
  })
  const ui = createUI(editor, { locale: 'tr', panels: panelKit, ...options })
  mounted.push({ editor, ui })
  return { editor, ui, root }
}

function menuItems(root: HTMLElement): HTMLButtonElement[] {
  const menu = root.querySelector('[role="menu"][aria-label="Dosya"]')
  return [...(menu?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
}

function item(root: HTMLElement, label: string): HTMLButtonElement {
  const button = menuItems(root).find((candidate) => candidate.textContent?.includes(label))
  if (!button) throw new Error(`Missing item ${label}`)
  return button
}

async function choose(root: HTMLElement, file: File): Promise<void> {
  item(root, 'Dosya aç').click()
  const input = root.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('Missing file input')
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  input.dispatchEvent(new Event('change'))
  await vi.waitFor(() => {
    if (root.querySelector('[role="status"]')?.textContent === 'Dosya açılıyor…') {
      throw new Error('still opening')
    }
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const notice = (root: HTMLElement): HTMLElement | null =>
  root.querySelector<HTMLElement>('.ve-notice:not([hidden])')

const markdown: MarkdownModule = {
  markdownToHtml: (source) => `<p><strong>${source.replace(/\*/g, '')}</strong></p>`,
  toMarkdown: () => '**md**',
}

afterEach(() => {
  for (const { editor, ui } of mounted) {
    ui.destroy()
    editor.destroy()
  }
  mounted = []
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('safeFileName', () => {
  it('removes path, bidi and reserved characters and adds the extension once', () => {
    expect(safeFileName('rapor\u202Excod.exe', 'docx', 'belge')).toBe('raporxcod.exe.docx')
    expect(safeFileName('../a<b>:c', 'md', 'belge')).toBe('-a-b--c.md')
    expect(safeFileName('Rapor.DOCX', 'docx', 'belge')).toBe('Rapor.docx')
  })

  it('falls back for empty or reserved names and caps the length', () => {
    expect(safeFileName(' . ', 'html', 'belge')).toBe('belge.html')
    expect(safeFileName('CON', 'html', 'belge')).toBe('belge.html')
    expect(safeFileName('a'.repeat(300), 'md', 'belge')).toHaveLength(103)
  })
})

describe('file menu', () => {
  it('offers open, HTML and print without converters, and every format with them', async () => {
    const plain = await mount({})
    const labels = menuItems(plain.root).map((button) => button.textContent)

    const rich = await mount({ files: { markdown: async () => markdown, docx: vi.fn() } })

    expect(labels).toEqual(['Dosya aç…', 'HTML olarak kaydet (.html)', 'Yazdır veya PDF'])
    expect(menuItems(rich.root)).toHaveLength(5)
  })

  it('is left out when files is false', async () => {
    const { root } = await mount({ files: false })

    expect(root.querySelector('[data-tool="file"]')).toBeNull()
  })

  it('replaces an empty document with an opened Markdown file', async () => {
    const { editor, root } = await mount({ files: { markdown: async () => markdown } })

    await choose(root, new File(['**kalın**'], 'not.md'))

    expect(editor.getHTML()).toBe('<p><strong>kalın</strong></p>')
    expect(root.querySelector('[role="status"]')?.textContent).toBe('Dosya açıldı.')
  })

  it('inserts a text file into a filled document at the cursor', async () => {
    const { editor, root } = await mount({}, '<p>var</p>')

    await choose(root, new File(['bir\n\niki'], 'not.txt'))

    expect(editor.getHTML()).toBe('<p>bir</p><p>iki</p><p>var</p>')
  })

  it('shows a visible message for an unsupported file and keeps the document', async () => {
    const { editor, root } = await mount({}, '<p>var</p>')

    await choose(root, new File(['x'], 'tablo.xlsx'))

    expect(notice(root)?.textContent).toContain('Bu dosya türü açılamıyor')
    expect(editor.getHTML()).toBe('<p>var</p>')
  })

  it('reports a converter that fails to load', async () => {
    const { root } = await mount({
      files: { docx: () => Promise.reject(new Error('offline')) },
    })

    await choose(root, new File(['x'], 'rapor.docx'))

    expect(notice(root)?.textContent).toContain('Dönüştürücü yüklenemedi')
  })

  it('maps converter errors to plain messages', async () => {
    const error = Object.assign(new Error('locked'), { code: 'ENCRYPTED' })
    const docx = { importDocx: vi.fn().mockRejectedValue(error), exportDocx: vi.fn() }
    const { root } = await mount({ files: { docx: async () => docx } })

    await choose(root, new File(['x'], 'rapor.docx'))

    expect(notice(root)?.textContent).toContain('Parola korumalı')
  })

  it('downloads the HTML under a safe name and frees the address later', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const create = vi.fn(() => 'blob:test')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { root } = await mount({ files: { fileName: 'Rapor/Ekim' } }, '<p>a</p>')

    item(root, 'HTML olarak kaydet').click()
    const anchor = click.mock.contexts[0] as HTMLAnchorElement
    vi.runAllTimers()
    vi.useRealTimers()

    expect(anchor.download).toBe('Rapor-Ekim.html')
    expect(create).toHaveBeenCalledTimes(1)
    expect(revoke).toHaveBeenCalledWith('blob:test')
    expect(root.querySelector('[role="status"]')?.textContent).toBe('Dosya kaydedildi.')
  })
})
