import type { Editor } from '@viveeditor/core'
import type { Bubble } from './bubble.js'
import type { Listen } from './lifecycle.js'
import type { SlashMenu } from './slash-menu.js'
import type { Toolbar } from './toolbar.js'

export interface EditorKeysOptions {
  root: HTMLElement
  editor: Editor
  toolbar: Toolbar
  bubble: Bubble
  slash: SlashMenu
  listen: Listen
  hasTool: (id: string) => boolean
  pluginKey: (event: KeyboardEvent) => boolean
  openLink: () => void
  openSearch: () => void
  openShortcuts: () => void
  schedule: () => void
}

export function bindToolbarShortcut(element: HTMLElement, toolbar: Toolbar, listen: Listen): void {
  listen(element, 'keydown', (event) => {
    const keyEvent = event as KeyboardEvent
    const target = toolbar.focusTarget()
    if (!keyEvent.altKey || keyEvent.key !== 'F10' || !target) return
    keyEvent.preventDefault()
    target.focus()
  })
}

type KeyAction = 'schedule' | 'toolbar' | 'shortcuts' | 'link' | 'search'

export function bindEditorKeys(options: EditorKeysOptions): void {
  const { editor, toolbar, bubble, slash, hasTool } = options
  const keyAction = (event: KeyboardEvent): KeyAction | null => {
    if (slash.handleKey(event) || options.pluginKey(event)) return 'schedule'
    const key = event.key.toLowerCase()
    if (event.altKey && event.key === 'F10' && toolbar.focusTarget()) return 'toolbar'
    if (event.altKey && !event.metaKey && !event.ctrlKey && event.code === 'Digit0') {
      return hasTool('shortcuts') ? 'shortcuts' : null
    }
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return null
    if (key === 'k' && hasTool('link')) return 'link'
    if (key === 'f' && hasTool('search')) return 'search'
    return null
  }
  options.listen(
    options.root,
    'keydown',
    (event) => {
      const keyEvent = event as KeyboardEvent
      if (keyEvent.target !== editor.dom) return
      const action = keyAction(keyEvent)
      if (!action) {
        if (keyEvent.key === 'Escape' && !bubble.element.hidden) bubble.hide()
        return
      }
      keyEvent.preventDefault()
      keyEvent.stopPropagation()
      if (action === 'toolbar') toolbar.focusTarget()?.focus()
      else if (action === 'shortcuts') options.openShortcuts()
      else if (action === 'link') options.openLink()
      else if (action === 'search') options.openSearch()
      else options.schedule()
    },
    true,
  )
}

export function bindKeyboardInset(root: HTMLElement, listen: Listen): void {
  const viewport = typeof window === 'undefined' ? undefined : window.visualViewport
  if (!viewport) return
  const syncKeyboard = (): void => {
    const covered = window.innerHeight - viewport.height - viewport.offsetTop
    root.style.setProperty('--ve-keyboard', `${Math.max(0, Math.round(covered))}px`)
  }
  listen(viewport, 'resize', syncKeyboard)
  listen(viewport, 'scroll', syncKeyboard)
}
