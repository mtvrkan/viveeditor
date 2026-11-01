import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { Footnote } from '@viveeditor/ext-footnote'
import { listExtensions } from '@viveeditor/ext-list'
import { MathExtension } from '@viveeditor/ext-math'
import { Mention } from '@viveeditor/ext-mention'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  type AiProvider,
  aiAssistant,
  emojiMenu,
  footnoteTools,
  mathTools,
  mentionMenu,
  suggestionMenu,
  templateMenu,
} from '../src/extras/index.js'
import {
  createUI,
  type EditorUI,
  printableHtml,
  type UiOptions,
  type UiPlugin,
} from '../src/index.js'
import * as panelKit from '../src/panel-kit.js'

let mounted: Array<{ editor: Editor; ui: EditorUI }> = []

beforeAll(() => {
  const empty = (): DOMRect => new DOMRect()
  Range.prototype.getBoundingClientRect ??= empty
  Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList
})

async function mount(
  options: UiOptions,
  extensions = [...basicExtensions, ...listExtensions],
): Promise<{ editor: Editor; ui: EditorUI }> {
  const root = document.createElement('div')
  document.body.append(root)
  const editor = await Editor.create(root, {
    extensions,
    content: '<p></p>',
    label: 'Makale',
  })
  const ui = createUI(editor, { locale: 'tr', panels: panelKit, ...options })
  mounted.push({ editor, ui })
  return { editor, ui }
}

function type(editor: Editor, ui: EditorUI, text: string): void {
  editor.focus()
  editor.commands.insertText(text)
  ui.refresh()
}

function press(editor: Editor, key: string): void {
  editor.dom.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
}

const menu = (ui: EditorUI): HTMLElement | null =>
  ui.root.querySelector<HTMLElement>('.ve-suggest:not([hidden])')

const options = (ui: EditorUI): string[] =>
  Array.from(ui.root.querySelectorAll('.ve-suggest [role="option"] .ve-item-label')).map(
    (option) => option.textContent ?? '',
  )

const people = [
  { id: 'u1', label: 'Melis', description: 'Editör' },
  { id: 'u2', label: 'Merve' },
  { id: 'u3', label: 'Ali' },
]

const peopleMenu = (onSelect = vi.fn()): UiPlugin =>
  suggestionMenu({
    char: '@',
    query: '[\\p{L}]{0,32}',
    title: 'Kişiler',
    loading: 'Yükleniyor…',
    empty: 'Sonuç yok',
    delay: 0,
    items: (query) => people.filter((person) => person.label.toLowerCase().startsWith(query)),
    select: (item, host) => {
      onSelect(item)
      host.commands.run('insertText', `[${item.label}]`)
    },
  })

afterEach(() => {
  for (const { editor, ui } of mounted) {
    ui.destroy()
    editor.destroy()
  }
  mounted = []
  document.body.innerHTML = ''
})

describe('UI plugin hook', () => {
  it('adds plugin slash entries to the block menu and runs them', async () => {
    const run = vi.fn()
    const plugin: UiPlugin = () => ({
      slash: [{ id: 'custom', label: 'Özel blok', keywords: 'ozel custom', run }],
    })
    const { editor, ui } = await mount({ plugins: [plugin] })

    type(editor, ui, '/ozel')
    const option = Array.from(
      ui.root.querySelectorAll<HTMLElement>('.ve-slash [role="option"]'),
    ).find((element) => element.textContent?.includes('Özel blok'))
    option?.click()

    expect(run).toHaveBeenCalledOnce()
    expect(editor.getHTML()).toBe('<p></p>')
  })

  it('appends plugin bubble buttons and destroys plugins with the UI', async () => {
    const destroy = vi.fn()
    const button = document.createElement('button')
    button.dataset.tool = 'plugin'
    const { ui } = await mount({ plugins: [() => ({ bubble: [button], destroy })] })

    expect(ui.root.querySelector('.ve-bubble [data-tool="plugin"]')).toBe(button)
    ui.destroy()
    expect(destroy).toHaveBeenCalledOnce()
  })

  it('reports a throwing plugin through onError and keeps the UI working', async () => {
    const onError = vi.fn()
    const broken: UiPlugin = () => {
      throw new Error('boom')
    }
    const noisy: UiPlugin = () => ({
      update: () => {
        throw new Error('update')
      },
    })
    const { editor, ui } = await mount({ plugins: [broken, noisy], onError })

    type(editor, ui, 'abc')

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'boom' }))
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'update' }))
    expect(editor.getHTML()).toBe('<p>abc</p>')
  })
})

describe('suggestionMenu', () => {
  it('opens on the trigger, filters and inserts the chosen item with the keyboard', async () => {
    const onSelect = vi.fn()
    const { editor, ui } = await mount({ plugins: [peopleMenu(onSelect)] })

    type(editor, ui, 'Merhaba @me')
    await vi.waitFor(() => expect(options(ui)).toEqual(['Melis', 'Merve']))
    expect(editor.dom.getAttribute('aria-controls')).toBe(
      menu(ui)?.querySelector('[role="listbox"]')?.id,
    )

    press(editor, 'ArrowDown')
    expect(editor.dom.getAttribute('aria-activedescendant')).toMatch(/-1$/)
    press(editor, 'Enter')

    expect(onSelect).toHaveBeenCalledWith(people[1])
    expect(editor.getHTML()).toBe('<p>Merhaba [Merve]</p>')
    expect(menu(ui)).toBeNull()
    expect(editor.dom.hasAttribute('aria-activedescendant')).toBe(false)
  })

  it('does not trigger inside a word and stays closed after Escape', async () => {
    const { editor, ui } = await mount({ plugins: [peopleMenu()] })

    type(editor, ui, 'mail@me')
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(menu(ui)).toBeNull()

    type(editor, ui, ' @m')
    await vi.waitFor(() => expect(menu(ui)).not.toBeNull())
    press(editor, 'Escape')
    ui.refresh()
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(menu(ui)).toBeNull()
  })

  it('shows plain text only, strips bidi controls and caps the list at eight items', async () => {
    const many = Array.from({ length: 12 }, (_, index) => ({
      label: `<img src=x onerror=alert(1)>‮${index}`,
    }))
    const plugin = suggestionMenu({
      char: '@',
      query: '[a-z]{0,8}',
      title: 'Kişiler',
      loading: '…',
      empty: 'Yok',
      delay: 0,
      items: () => many,
      select: () => {},
    })
    const { editor, ui } = await mount({ plugins: [plugin] })

    type(editor, ui, '@a')
    await vi.waitFor(() => expect(options(ui)).toHaveLength(8))
    expect(options(ui)[0]).toBe('<img src=x onerror=alert(1)>0')
    expect(ui.root.querySelector('.ve-suggest img')).toBeNull()
  })

  it('reports a failing source and shows the empty message', async () => {
    const onError = vi.fn()
    const plugin = suggestionMenu({
      char: '@',
      query: '[a-z]{0,8}',
      title: 'Kişiler',
      loading: 'Yükleniyor',
      empty: 'Sonuç yok',
      delay: 0,
      items: () => Promise.reject(new Error('offline')),
      select: () => {},
    })
    const { editor, ui } = await mount({ plugins: [plugin], onError })

    type(editor, ui, '@a')
    await vi.waitFor(() => expect(menu(ui)?.textContent).toContain('Sonuç yok'))
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'offline' }))
  })
})

describe('extras menus', () => {
  it('mentionMenu does nothing without the mention extension', async () => {
    const items = vi.fn(() => people)
    const { editor, ui } = await mount({ plugins: [mentionMenu({ items })] })

    type(editor, ui, '@me')
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(items).not.toHaveBeenCalled()
    expect(menu(ui)).toBeNull()
  })

  it('mentionMenu inserts a mention node for the chosen person', async () => {
    const { editor, ui } = await mount({ plugins: [mentionMenu({ items: () => people })] }, [
      ...basicExtensions,
      Mention,
    ])

    type(editor, ui, 'Selam @meh')
    await vi.waitFor(() => expect(options(ui)).toEqual(['Melis', 'Merve', 'Ali']))
    press(editor, 'Enter')

    expect(editor.getHTML()).toBe(
      '<p>Selam <span class="vive-mention" data-mention="u1">@Melis</span>&nbsp;</p>',
    )
  })

  it('emojiMenu needs two letters, loads data once and inserts the character', async () => {
    const load = vi.fn(async () => ({
      default: [
        ['😀', 'grinning face', ['gülümseme', 'smile']],
        ['🎉', 'party popper', ['kutlama', 'party']],
      ] as const,
    }))
    const { editor, ui } = await mount({ plugins: [emojiMenu({ load })] })

    type(editor, ui, 'Saat 10:30 :k')
    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(menu(ui)).toBeNull()

    type(editor, ui, 'u')
    await vi.waitFor(() => expect(options(ui)).toEqual(['party popper']))
    press(editor, 'Enter')

    expect(editor.getHTML()).toBe('<p>Saat 10:30 🎉</p>')
    expect(load).toHaveBeenCalledOnce()
  })

  it('emojiMenu lists emoji whose name matches before keyword matches', async () => {
    const load = async () =>
      [
        ['🧑‍🚀', 'astronaut', ['rocket', 'space']],
        ['🚀', 'rocket', ['space']],
      ] as const
    const { editor, ui } = await mount({ plugins: [emojiMenu({ load })] })

    type(editor, ui, ':rock')

    await vi.waitFor(() => expect(options(ui)).toEqual(['rocket', 'astronaut']))
  })

  it('emojiMenu rejects malformed data through onError', async () => {
    const onError = vi.fn()
    const load = async () => [['<b>x</b>'.repeat(10), 'bad', 'not-a-list']] as never
    const { editor, ui } = await mount({ plugins: [emojiMenu({ load })], onError })

    type(editor, ui, ':ba')
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(expect.any(TypeError)))
  })

  it('templateMenu inserts the template through the schema', async () => {
    const { editor, ui } = await mount({
      plugins: [
        templateMenu([
          {
            id: 'memo',
            label: 'Not',
            content: '<h2>Konu</h2><p>Metin</p><script>alert(1)</script>',
          },
        ]),
      ],
    })

    type(editor, ui, '/not')
    const option = Array.from(
      ui.root.querySelectorAll<HTMLElement>('.ve-slash [role="option"]'),
    ).find((element) => element.textContent?.includes('Şablon: Not'))
    option?.click()

    expect(editor.getHTML()).toBe('<h2>Konu</h2><p>Metin</p>')
  })

  it('mathTools and footnoteTools add slash entries only when their extensions are present', async () => {
    const plain = await mount({ plugins: [mathTools(), footnoteTools()] })
    const full = await mount({ plugins: [mathTools(), footnoteTools()] }, [
      ...basicExtensions,
      MathExtension,
      Footnote,
    ])
    const labels = (ui: EditorUI): string[] =>
      Array.from(ui.root.querySelectorAll('.ve-slash [role="option"]')).map(
        (option) => option.textContent ?? '',
      )

    type(plain.editor, plain.ui, '/dipnot')
    type(full.editor, full.ui, '/dipnot')

    expect(labels(plain.ui).some((label) => label.includes('Dipnot'))).toBe(false)
    expect(labels(full.ui).some((label) => label.includes('Dipnot'))).toBe(true)
  })

  it('printableHtml numbers footnotes and lists them at the end', async () => {
    const { editor } = await mount({}, [...basicExtensions, Footnote])
    editor.setContent('<p>A<sup data-footnote="">Kaynak</sup> B</p>')

    const page = printableHtml(editor)

    expect(page).toContain('<p>A<sup data-footnote="">1</sup> B</p><ol><li>Kaynak</li></ol>')
  })
})

describe('aiAssistant', () => {
  async function mountAi(
    provider: AiProvider,
    extra: Partial<Parameters<typeof aiAssistant>[0]> = {},
  ) {
    const onError = vi.fn()
    const mounted = await mount({ plugins: [aiAssistant({ provider, ...extra })], onError })
    mounted.editor.setContent('<p>Önce. Bu cümle düzelecek. Sonra.</p>')
    mounted.editor.focus()
    mounted.editor.commands.setTextSelection(7, 26)
    return { ...mounted, onError }
  }

  const panel = (ui: EditorUI): HTMLElement => {
    const element = ui.root.querySelector<HTMLElement>('.ve-ai')
    if (!element) throw new Error('panel missing')
    return element
  }

  const buttonNamed = (ui: EditorUI, name: string): HTMLButtonElement => {
    const found = Array.from(panel(ui).querySelectorAll('button')).find(
      (element) => element.textContent === name,
    )
    if (!found) throw new Error(`button ${name} missing`)
    return found
  }

  it('streams a suggestion and replaces the selection as one undo step', async () => {
    const seen: unknown[] = []
    const provider: AiProvider = {
      async *generate(request) {
        seen.push({ ...request, signal: undefined })
        yield 'Bu cümle '
        yield 'düzeldi.'
      },
    }
    const { editor, ui } = await mountAi(provider)

    press(editor, 'j')
    editor.dom.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true, cancelable: true }),
    )
    buttonNamed(ui, 'Yazım ve dil bilgisini düzelt').click()
    await vi.waitFor(() => expect(panel(ui).textContent).toContain('Öneri hazır'))
    buttonNamed(ui, 'Seçimin yerine koy').click()
    await vi.waitFor(() => expect(panel(ui).hidden).toBe(true))

    expect(seen[0]).toMatchObject({
      action: 'fix',
      text: 'Bu cümle düzelecek.',
      context: { before: 'Önce. ', after: ' Sonra.' },
      locale: 'tr',
    })
    expect(editor.getHTML()).toBe('<p>Önce. Bu cümle düzeldi. Sonra.</p>')
    editor.commands.undo()
    expect(editor.getHTML()).toBe('<p>Önce. Bu cümle düzelecek. Sonra.</p>')
  })

  it('shows hostile output as text and inserts it without html, images or links', async () => {
    const hostile =
      '<img src=x onerror=alert(1)> ![x](https://tracker.example/p.png)\n\n[tıkla](javascript:alert(1)) **kalın**'
    const provider: AiProvider = { generate: async () => hostile }
    const markdown = async () => (source: string) =>
      source
        .replace('![x](https://tracker.example/p.png)', '<img src="https://tracker.example/p.png">')
        .replace('[tıkla](javascript:alert(1))', '<a href="javascript:alert(1)">tıkla</a>')
        .replace('**kalın**', '<strong>kalın</strong>')
    const { editor, ui } = await mountAi(provider, { markdown })
    ui.root.querySelector<HTMLButtonElement>('[data-tool="ai"]')?.click()

    buttonNamed(ui, 'Daha iyi yaz').click()
    await vi.waitFor(() => expect(panel(ui).textContent).toContain('Öneri hazır'))
    const preview = panel(ui).querySelector('.ve-ai-preview')
    expect(preview?.querySelector('img')).toBeNull()
    expect(preview?.textContent).toContain('<img src=x onerror=alert(1)>')
    buttonNamed(ui, 'Altına ekle').click()
    await vi.waitFor(() => expect(panel(ui).hidden).toBe(true))

    expect(editor.getHTML()).not.toMatch(/<img|<a |javascript:/)
    expect(editor.getHTML()).toContain('<strong>kalın</strong>')
  })

  it('stops a stream, ignores late chunks and reports provider errors', async () => {
    let release: () => void = () => {}
    const provider: AiProvider = {
      async *generate() {
        yield 'ilk'
        await new Promise<void>((resolve) => {
          release = resolve
        })
        yield 'geç'
      },
    }
    const { editor, ui, onError } = await mountAi(provider)
    ui.root.querySelector<HTMLButtonElement>('[data-tool="ai"]')?.click()
    buttonNamed(ui, 'Kısalt').click()
    await vi.waitFor(() =>
      expect(panel(ui).querySelector('.ve-ai-preview')?.textContent).toBe('ilk'),
    )

    buttonNamed(ui, 'Durdur').click()
    release()
    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(panel(ui).querySelector('.ve-ai-preview')?.textContent).toBe('ilk')
    expect(onError).not.toHaveBeenCalled()

    const failing: AiProvider = { generate: async () => Promise.reject(new Error('quota')) }
    const second = await mountAi(failing)
    second.ui.root.querySelector<HTMLButtonElement>('[data-tool="ai"]')?.click()
    buttonNamed(second.ui, 'Uzat').click()
    await vi.waitFor(() => expect(panel(second.ui).textContent).toContain('Öneri alınamadı'))
    expect(second.onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'quota' }))
    expect(panel(second.ui).textContent).not.toContain('quota')
    expect(editor.getHTML()).toBe('<p>Önce. Bu cümle düzelecek. Sonra.</p>')
  })

  it('gives up on a provider that ignores the abort signal after the time limit', async () => {
    const provider: AiProvider = {
      async *generate() {
        yield 'yarım'
        await new Promise<void>(() => {})
      },
    }
    const { ui, onError } = await mountAi(provider)
    ui.root.querySelector<HTMLButtonElement>('[data-tool="ai"]')?.click()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    try {
      buttonNamed(ui, 'Kısalt').click()
      await vi.waitFor(() =>
        expect(panel(ui).querySelector('.ve-ai-preview')?.textContent).toBe('yarım'),
      )
      await vi.advanceTimersByTimeAsync(120_000)
    } finally {
      vi.useRealTimers()
    }

    await vi.waitFor(() => expect(buttonNamed(ui, 'Durdur').hidden).toBe(true))
    expect(onError).toHaveBeenCalled()
  })

  it('disables replace once the selection changes', async () => {
    const provider: AiProvider = { generate: async () => 'yeni' }
    const { editor, ui } = await mountAi(provider)
    ui.root.querySelector<HTMLButtonElement>('[data-tool="ai"]')?.click()
    buttonNamed(ui, 'Özetle').click()
    await vi.waitFor(() => expect(panel(ui).textContent).toContain('Öneri hazır'))

    editor.commands.setTextSelection(2)
    ui.refresh()

    expect(buttonNamed(ui, 'Seçimin yerine koy').disabled).toBe(true)
    expect(buttonNamed(ui, 'Altına ekle').disabled).toBe(false)
  })
})
