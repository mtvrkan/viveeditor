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

export function bindEditorKeys(options: EditorKeysOptions): void {
  const { editor, toolbar, bubble, slash, hasTool } = options
  options.listen(
    options.root,
    'keydown',
    (event) => {
      const keyEvent = event as KeyboardEvent
      if (keyEvent.target !== editor.dom) return
      const handled =
        slash.handleKey(keyEvent) ||
        options.pluginKey(keyEvent) ||
        (keyEvent.altKey && keyEvent.key === 'F10' && Boolean(toolbar.focusTarget())) ||
        ((keyEvent.metaKey || keyEvent.ctrlKey) &&
          !keyEvent.altKey &&
          ((keyEvent.key.toLowerCase() === 'k' && hasTool('link')) ||
            (keyEvent.key.toLowerCase() === 'f' && hasTool('search'))))
      if (!handled) {
        if (keyEvent.key === 'Escape' && !bubble.element.hidden) bubble.hide()
        return
      }
      keyEvent.preventDefault()
      keyEvent.stopPropagation()
      if (keyEvent.key === 'F10') toolbar.focusTarget()?.focus()
      else if (keyEvent.key.toLowerCase() === 'k') options.openLink()
      else if (keyEvent.key.toLowerCase() === 'f') options.openSearch()
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
