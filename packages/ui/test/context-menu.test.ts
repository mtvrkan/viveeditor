import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { Image } from '@viveeditor/ext-image'
import { Table } from '@viveeditor/ext-table'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUI, type EditorUI, type UiOptions } from '../src/index.js'
import { createMenu, type MenuItem } from '../src/menu.js'
import * as panelKit from '../src/panel-kit.js'

let mounted: Array<{ editor: Editor; ui: EditorUI }> = []

async function mount(
  content: string,
  options: UiOptions = {},
  extensions = [...basicExtensions, Table, Image],
): Promise<{ editor: Editor; root: HTMLElement }> {
  const root = document.createElement('div')
  document.body.append(root)
  const editor = await Editor.create(root, { extensions, content })
  const ui = createUI(editor, { locale: 'tr', panels: panelKit, ...options })
  mounted.push({ editor, ui })
  return { editor, root }
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

function rightClick(target: Element, init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: 40,
    clientY: 40,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

function contextMenu(root: HTMLElement): HTMLElement | null {
  const menu = root.querySelector<HTMLElement>('.ve-context-menu')
  return menu && !menu.hidden ? menu : null
}

function shownLabels(menu: HTMLElement | null): string[] {
  return [...(menu?.querySelectorAll<HTMLElement>(':scope > .ve-item:not([hidden])') ?? [])].map(
    (item) => item.querySelector('.ve-item-label')?.textContent ?? '',
  )
}

function item(scope: ParentNode, label: string): HTMLButtonElement {
  const found = [...scope.querySelectorAll<HTMLButtonElement>('.ve-item')].find(
    (button) => button.querySelector('.ve-item-label')?.textContent === label,
  )
  if (!found) throw new Error(`Missing item ${label}`)
  return found
}

function press(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

const TABLE =
  '<table><tr><td><p>a</p></td><td><p>b</p></td></tr><tr><td><p>c</p></td><td><p>d</p></td></tr></table>'

afterEach(() => {
  for (const { editor, ui } of mounted) {
    ui.destroy()
    editor.destroy()
  }
  mounted = []
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('menu submenus', () => {
  const setup = () => {
    const done = vi.fn()
    const run = vi.fn()
    const items: MenuItem[] = [
      { id: 'first', label: 'Birinci', role: 'menuitem', action: () => undefined },
      {
        id: 'more',
        label: 'Daha',
        role: 'menuitem',
        items: [
          { id: 'inner-a', label: 'İç A', role: 'menuitem', action: run },
          { id: 'inner-b', label: 'İç B', role: 'menuitem', action: () => undefined },
        ],
      },
    ]
    const trigger = document.createElement('button')
    const container = document.createElement('div')
    document.body.append(trigger, container)
    const menu = createMenu({
      label: 'Menü',
      trigger,
      items,
      place: () => undefined,
      onOpen: () => undefined,
      onDone: done,
    })
    container.append(menu.element)
    menu.open()
    const parent = item(menu.element, 'Daha')
    return { menu, parent, container, done, run }
  }

  it('opens with ArrowRight, marks the parent expanded and focuses the first child', () => {
    const { parent, container } = setup()
    parent.focus()

    press(parent, 'ArrowRight')
    const submenu = container.querySelectorAll<HTMLElement>('.ve-menu')[1]

    expect(parent.getAttribute('aria-haspopup')).toBe('menu')
    expect(parent.getAttribute('aria-expanded')).toBe('true')
    expect(submenu?.hidden).toBe(false)
    expect(document.activeElement?.textContent).toBe('İç A')
  })

  it('closes back to the parent item with ArrowLeft', () => {
    const { menu, parent, container } = setup()
    parent.focus()
    press(parent, 'ArrowRight')

    press(document.activeElement as Element, 'ArrowLeft')

    expect(container.querySelectorAll<HTMLElement>('.ve-menu')[1]?.hidden).toBe(true)
    expect(parent.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(parent)
    expect(menu.isOpen()).toBe(true)
  })

  it('returns to the parent on Escape and closes the whole menu on a second Escape', () => {
    const { menu, parent } = setup()
    parent.click()

    press(document.activeElement as Element, 'Escape')
    const afterFirst = { open: menu.isOpen(), focus: document.activeElement }
    press(parent, 'Escape')

    expect(afterFirst).toEqual({ open: true, focus: parent })
    expect(menu.isOpen()).toBe(false)
  })

  it('runs a child action and closes every level', () => {
    const { menu, parent, container, done, run } = setup()
    parent.click()

    item(container, 'İç A').click()

    expect(run).toHaveBeenCalledOnce()
    expect(done).toHaveBeenCalledOnce()
    expect(menu.isOpen()).toBe(false)
  })
})

describe('context menu', () => {
  it('opens the table items on a cell and keeps a multi-cell selection', async () => {
    const { editor, root } = await mount(TABLE)
    editor.commands.setTextSelection(3)
    editor.commands.selectRow()
    const before = editor.getSelection()

    const event = rightClick(root.querySelectorAll('td')[1] as Element)
    await settle()
    const menu = contextMenu(root)

    expect(event.defaultPrevented).toBe(true)
    expect(menu?.dataset.kind).toBe('table')
    expect(shownLabels(menu)).toEqual([
      'Hücre',
      'Satır',
      'Sütun',
      'Tablo özellikleri…',
      'Tabloyu sil',
    ])
    expect(editor.getSelection()).toEqual(before)
    expect(root.querySelectorAll('.selectedCell')).toHaveLength(2)
  })

  it('adds a row below from the Satır submenu', async () => {
    const { editor, root } = await mount(TABLE)

    rightClick(root.querySelector('td') as Element)
    await settle()
    item(contextMenu(root) as HTMLElement, 'Satır').click()
    item(root, 'Alta satır ekle').click()

    expect(editor.getHTML().match(/<tr>/g)).toHaveLength(3)
  })

  it('changes the row height from the Satır submenu', async () => {
    const { editor, root } = await mount(TABLE)
    const openRow = async () => {
      rightClick(root.querySelector('td') as Element)
      await settle()
      item(contextMenu(root) as HTMLElement, 'Satır').click()
    }

    await openRow()
    item(root, 'Satırı yükselt').click()
    const taller = editor.getHTML()
    await openRow()
    item(root, 'Satır yüksekliğini sıfırla').click()

    expect(taller).toMatch(/^<table><tbody><tr style="height: 48px;?"><td>/)
    expect(editor.getHTML()).not.toContain('<tr style')
  })

  it('leaves plain text to the browser in objects mode', async () => {
    const { root } = await mount('<p>Düz metin</p>')

    const event = rightClick(root.querySelector('p') as Element)
    await settle()

    expect(event.defaultPrevented).toBe(false)
    expect(contextMenu(root)).toBeNull()
  })

  it('shows the text menu on plain text in always mode', async () => {
    const { root } = await mount('<p>Düz metin</p>', { contextMenu: 'always' })

    const event = rightClick(root.querySelector('p') as Element)
    await settle()

    expect(event.defaultPrevented).toBe(true)
    expect(shownLabels(contextMenu(root))).toEqual([
      'Kes',
      'Kopyala',
      'Kalın',
      'İtalik',
      'Bağlantı',
    ])
  })

  it('never opens when the option is false', async () => {
    const { root } = await mount(TABLE, { contextMenu: false })

    const event = rightClick(root.querySelector('td') as Element)
    await settle()

    expect(event.defaultPrevented).toBe(false)
    expect(contextMenu(root)).toBeNull()
  })

  it('keeps the native menu on Shift+right-click', async () => {
    const { root } = await mount(TABLE)

    const event = rightClick(root.querySelector('td') as Element, { shiftKey: true })
    await settle()

    expect(event.defaultPrevented).toBe(false)
    expect(contextMenu(root)).toBeNull()
  })

  it('ignores a context menu that follows a touch press', async () => {
    const { root } = await mount(TABLE)
    const cell = root.querySelector('td') as Element
    const down = new Event('pointerdown', { bubbles: true })
    Object.defineProperty(down, 'pointerType', { value: 'touch' })
    cell.dispatchEvent(down)

    const event = rightClick(cell)
    await settle()

    expect(event.defaultPrevented).toBe(false)
    expect(contextMenu(root)).toBeNull()
  })

  it('opens the image items with Shift+F10 on a selected image', async () => {
    const { editor, root } = await mount(
      '<p>a</p><img src="https://cdn.example.com/kedi.png" alt="Kedi">',
    )
    editor.commands.selectAt(root.querySelector('.vive-image') as Element)

    const event = press(editor.dom, 'F10', { shiftKey: true })
    await settle()
    const menu = contextMenu(root)

    expect(editor.query.selectedImage()?.src).toBe('https://cdn.example.com/kedi.png')
    expect(event.defaultPrevented).toBe(true)
    expect(menu?.dataset.kind).toBe('image')
    expect(shownLabels(menu)).toEqual([
      'Görseli düzenle…',
      'Sola hizala',
      'Ortala',
      'Sağa hizala',
      'Görsel adresini kopyala',
      'Görseli sil',
    ])
  })

  it('copies the link address to the clipboard and announces it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { root } = await mount('<p><a href="https://example.com/yol">site</a></p>')

    rightClick(root.querySelector('a') as Element)
    await settle()
    item(contextMenu(root) as HTMLElement, 'Bağlantı adresini kopyala').click()
    await settle()

    expect(writeText).toHaveBeenCalledWith('https://example.com/yol')
    expect(root.querySelector('.ve-sr[role="status"]')?.textContent).toBe('Kopyalandı')
  })

  it('shows only the items that do not change a read-only document', async () => {
    const { editor, root } = await mount('<p><a href="https://example.com">site</a></p>')
    editor.setEditable(false)

    rightClick(root.querySelector('a') as Element)
    await settle()

    expect(shownLabels(contextMenu(root))).toEqual(['Bağlantıyı aç', 'Bağlantı adresini kopyala'])
  })
})
