import type { Editor } from '@viveeditor/core'
import { h, matches, placeAtRect } from './dom.js'
import type { Messages } from './messages.js'

export interface Bubble {
  readonly element: HTMLElement
  readonly buttons: readonly HTMLButtonElement[]
  update(show: boolean): void
  hide(): void
}

export function createBubble(
  editor: Editor,
  messages: Messages,
  buttons: readonly HTMLButtonElement[],
  root: HTMLElement,
): Bubble {
  const element = h(
    'div',
    { class: 've-bubble ve-glass', role: 'toolbar', 'aria-label': messages.selection, hidden: '' },
    buttons,
  )

  const update = (show: boolean): void => {
    const rect = show && buttons.length > 0 ? editor.getSelectionRect() : null
    element.hidden = rect === null
    if (rect) placeAtRect(element, rect, root, matches('(pointer: coarse)') ? 'below' : 'above')
  }

  return {
    element,
    buttons,
    update,
    hide: () => {
      element.hidden = true
    },
  }
}
