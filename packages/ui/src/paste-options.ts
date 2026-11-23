import type { Editor } from '@viveeditor/core'
import type { CommandAccess } from './commands.js'
import { h, placeAtRect } from './dom.js'
import { type IconName, icon } from './icons.js'
import type { Listen } from './lifecycle.js'
import { createMenu, type Menu, type MenuItem } from './menu.js'
import type { Messages } from './messages.js'

type PasteMode = 'keep' | 'clean' | 'plain'

interface LastPaste {
  to: number
  mode: PasteMode
}

export interface PasteOptionsControl {
  readonly element: HTMLElement
  readonly menu: Menu
  update(show: boolean): void
}

export function createPasteOptions(
  editor: Editor,
  commands: CommandAccess,
  messages: Messages,
  root: HTMLElement,
  listen: Listen,
  returnToEditor: () => void,
): PasteOptionsControl | null {
  if (!commands.has('pasteAs')) return null
  const label = `${messages.pasteOptions} (Ctrl)`
  const trigger = h(
    'button',
    { type: 'button', class: 've-btn', 'aria-label': label, title: label },
    [icon('paste')],
  )
  const element = h('div', { class: 've-paste ve-glass', hidden: '' }, [trigger])
  const last = (): LastPaste | null =>
    (commands.query('lastPaste') as LastPaste | null | undefined) ?? null

  const item = (mode: PasteMode, text: string, visual: IconName): MenuItem => ({
    id: mode,
    label: text,
    icon: visual,
    role: 'menuitemradio',
    checked: () => last()?.mode === mode,
    disabled: () => !commands.can('pasteAs', mode),
    action: () => {
      commands.run('pasteAs', mode)
    },
  })

  const menu = createMenu({
    label: messages.pasteOptions,
    trigger,
    items: [
      item('keep', messages.pasteKeep, 'paste'),
      item('clean', messages.pasteClean, 'heading'),
      item('plain', messages.pastePlain, 'paragraph'),
    ],
    place: (panel) => placeAtRect(panel, trigger.getBoundingClientRect(), root, 'caret'),
    onOpen: () => undefined,
    onDone: returnToEditor,
  })

  let alone = false
  listen(element, 'mousedown', (event) => event.preventDefault())
  listen(menu.element, 'keydown', (event) => {
    if ((event as KeyboardEvent).key === 'Escape') returnToEditor()
  })
  listen(editor.dom, 'keydown', (event) => {
    const { key } = event as KeyboardEvent
    alone = key === 'Control' && !element.hidden
    if (key === 'Escape' && !element.hidden && !(event as KeyboardEvent).isComposing) {
      commands.run('dismissPaste')
    }
  })
  listen(editor.dom, 'keyup', (event) => {
    if ((event as KeyboardEvent).key === 'Control' && alone && !element.hidden) menu.open()
    alone = false
  })

  const update = (show: boolean): void => {
    if (menu.isOpen()) return
    const paste = last()
    const selection = editor.getSelection()
    const rect =
      show && paste && selection.empty && selection.from === paste.to
        ? editor.getSelectionRect()
        : null
    element.hidden = rect === null
    if (rect) placeAtRect(element, rect, root, 'caret')
  }

  return { element, menu, update }
}
