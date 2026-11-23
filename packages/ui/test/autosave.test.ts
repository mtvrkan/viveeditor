import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { type AutosaveOptions, createAutosave, createUI, type EditorUI } from '../src/index.js'
import * as panelKit from '../src/panel-kit.js'

const KEY = 'viveeditor:draft:post-1'
let mounted: Array<{ editor: Editor; ui: EditorUI | null }> = []

async function mount(
  content: string,
  autosave: AutosaveOptions = { key: 'post-1' },
): Promise<{ editor: Editor; ui: EditorUI; root: HTMLElement }> {
  const root = document.createElement('div')
  document.body.append(root)
  const editor = await Editor.create(root, { extensions: basicExtensions, content })
  const ui = createUI(editor, { locale: 'tr', panels: panelKit, autosave })
  mounted.push({ editor, ui })
  return { editor, ui, root }
}

const type = (editor: Editor, text: string): void => {
  editor.commands.setTextSelection(1)
  editor.commands.insertText(text)
}

beforeAll(() => {
  Range.prototype.getBoundingClientRect ??= () => new DOMRect()
  Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList
})

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
  sessionStorage.clear()
})

afterEach(() => {
  for (const { editor, ui } of mounted) {
    ui?.destroy()
    editor.destroy()
  }
  mounted = []
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('autosave drafts', () => {
  it('stores a draft after the wait and offers it the next time the editor opens', async () => {
    const first = await mount('<p>ilk</p>')
    type(first.editor, 'yeni ')
    const before = localStorage.getItem(KEY)
    vi.advanceTimersByTime(1000)
    first.ui.destroy()
    first.editor.destroy()

    const second = await mount('<p>ilk</p>')
    const bar = second.root.querySelector<HTMLElement>('.ve-draft')
    const shown = bar?.hidden
    bar?.querySelector<HTMLButtonElement>('.ve-primary')?.click()

    expect(before).toBeNull()
    expect(shown).toBe(false)
    expect(bar?.textContent).toMatch(/kaydedilmemiş bir taslağı var/)
    expect(second.editor.getHTML()).toBe('<p>yeni ilk</p>')
    expect(bar?.hidden).toBe(true)
    second.editor.commands.undo()
    expect(second.editor.getHTML()).toBe('<p>ilk</p>')
  })

  it('offers nothing when the draft matches the loaded content', async () => {
    const first = await mount('<p>aynı</p>')
    type(first.editor, 'x')
    first.editor.commands.undo()
    vi.advanceTimersByTime(1000)

    const second = await mount('<p>aynı</p>')

    expect(second.ui.autosave?.draft()).toBeNull()
    expect(second.root.querySelector<HTMLElement>('.ve-draft')?.hidden).toBe(true)
  })

  it('removes the stored draft when the text is emptied, discarded or cleared', async () => {
    const { editor, ui } = await mount('<p>metin</p>')
    editor.commands.replaceContent('<p></p>')
    vi.advanceTimersByTime(1000)
    const emptied = localStorage.getItem(KEY)

    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, savedAt: 5, content: { type: 'doc', content: [] } }),
    )
    const offered = createAutosave(editor, { key: 'post-1' })
    const draft = offered.draft()
    offered.discard()
    const discarded = localStorage.getItem(KEY)

    type(editor, 'son')
    vi.advanceTimersByTime(1000)
    const saved = localStorage.getItem(KEY) !== null
    ui.autosave?.clear()

    expect(emptied).toBeNull()
    expect(draft).toEqual({ savedAt: 5 })
    expect(discarded).toBeNull()
    expect(saved).toBe(true)
    expect(localStorage.getItem(KEY)).toBeNull()
    offered.destroy()
  })

  it('ignores damaged drafts and storage that throws', async () => {
    localStorage.setItem(KEY, '{"version":1,"savedAt":"dün","content":{}}')
    const { ui } = await mount('<p>a</p>')
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const second = await mount('<p>a</p>', { key: 'other' })

    expect(ui.autosave?.draft()).toBeNull()
    expect(second.ui.autosave?.draft()).toBeNull()
    getItem.mockRestore()
  })

  it('keeps drafts in session storage when asked', async () => {
    const { editor } = await mount('<p>a</p>', { key: 'post-1', storage: 'session' })
    type(editor, 'b')
    vi.advanceTimersByTime(1000)

    expect(sessionStorage.getItem(KEY)).not.toBeNull()
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('refuses an empty key', async () => {
    const root = document.createElement('div')
    document.body.append(root)
    const editor = await Editor.create(root, { extensions: basicExtensions })
    mounted.push({ editor, ui: null })

    expect(() => createAutosave(editor, { key: '' })).toThrow(TypeError)
  })
})

describe('autosave to a server', () => {
  it('saves once per pause, one request at a time, and reports the state', async () => {
    const calls: string[] = []
    let finish: () => void = () => {}
    const save = vi.fn(
      (editor: Editor) =>
        new Promise<void>((resolve) => {
          calls.push(editor.getHTML())
          finish = resolve
        }),
    )
    const { editor, ui } = await mount('<p>a</p>', { key: 'post-1', save, wait: 500 })
    const autosave = ui.autosave
    type(editor, '1')
    type(editor, '2')
    const pending = autosave?.status()
    await vi.advanceTimersByTimeAsync(500)
    const saving = autosave?.status()
    type(editor, '3')
    await vi.advanceTimersByTimeAsync(500)
    finish()
    await vi.runAllTimersAsync()
    finish()
    await vi.runAllTimersAsync()

    expect([pending, saving]).toEqual(['pending', 'saving'])
    expect(calls).toEqual(['<p>21a</p>', '<p>321a</p>'])
    expect(autosave?.status()).toBe('saved')
  })

  it('reports a failed save and warns before leaving while a save is pending', async () => {
    const onError = vi.fn()
    const save = vi.fn(() => Promise.reject(new Error('offline')))
    const { editor, ui } = await mount('<p>a</p>', { key: 'post-1', save, onError })
    type(editor, 'b')
    const leave = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(leave)
    await ui.autosave?.flush()

    expect(leave.defaultPrevented).toBe(true)
    expect(onError).toHaveBeenCalledWith(new Error('offline'))
    expect(ui.autosave?.status()).toBe('error')
  })
})
