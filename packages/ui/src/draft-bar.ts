import type { Autosave } from './autosave.js'
import { h } from './dom.js'
import { format, type Messages } from './messages.js'
import { displayShortcut } from './shortcut.js'

export interface DraftBar {
  readonly element: HTMLElement
  sync(): void
}

export function createDraftBar(
  autosave: Autosave,
  messages: Messages,
  locale: string,
  announce: (text: string) => void,
  returnToEditor: () => void,
): DraftBar {
  const text = h('span', { class: 've-draft-text' })
  const restore = h('button', { type: 'button', class: 've-primary' }, [messages.draftRestore])
  const discard = h('button', { type: 'button', class: 've-quiet' }, [messages.draftDiscard])
  const element = h(
    'div',
    { class: 've-draft', role: 'region', 'aria-label': messages.draftLabel, hidden: '' },
    [text, h('span', { class: 've-draft-actions' }, [restore, discard])],
  )
  const time = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })

  const sync = (): void => {
    const draft = autosave.draft()
    element.hidden = draft === null
    if (draft) text.textContent = format(messages.draftFound, { time: time.format(draft.savedAt) })
  }

  restore.addEventListener('click', () => {
    if (autosave.restore()) {
      announce(format(messages.draftRestored, { undo: displayShortcut('Mod-Z') }))
    }
    returnToEditor()
  })
  discard.addEventListener('click', () => {
    autosave.discard()
    returnToEditor()
  })
  return { element, sync }
}
