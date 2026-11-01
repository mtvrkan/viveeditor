import type { CommandAccess } from './commands.js'
import { h, uniqueId } from './dom.js'
import { type IconName, icon } from './icons.js'
import { format, type MessageKey, type Messages } from './messages.js'
import type { Popover } from './popover.js'

export interface SearchPanelOptions {
  commands: CommandAccess
  messages: Messages
  place: (element: HTMLElement, anchor: HTMLElement) => void
  returnToEditor: () => void
  onClose: () => void
}

interface SearchStatus {
  total: number
  current: number
}

const isStatus = (value: unknown): value is SearchStatus =>
  typeof value === 'object' && value !== null && 'total' in value && 'current' in value

export function createSearchPanel(options: SearchPanelOptions): Popover {
  const { commands, messages } = options
  const findId = uniqueId('ve-find')
  const replaceId = `${findId}-replace`
  const field = (id: string): HTMLInputElement =>
    h('input', { id, class: 've-input', type: 'text', spellcheck: 'false', autocomplete: 'off' })
  const find = field(findId)
  const replacement = field(replaceId)
  const iconButton = (name: IconName, label: MessageKey): HTMLButtonElement =>
    h(
      'button',
      { type: 'button', class: 've-btn', 'aria-label': messages[label], title: messages[label] },
      [icon(name)],
    )
  const toggle = (text: string, label: MessageKey): HTMLButtonElement =>
    h(
      'button',
      {
        type: 'button',
        class: 've-btn ve-toggle',
        'aria-label': messages[label],
        title: messages[label],
        'aria-pressed': 'false',
        'data-glyph': text,
      },
      [],
    )
  const previous = iconButton('arrowUp', 'findPrevious')
  const next = iconButton('arrowDown', 'findNext')
  const matchCase = toggle('Aa', 'matchCase')
  const wholeWord = toggle('ab|', 'wholeWord')
  const count = h('span', { class: 've-search-count', role: 'status' })
  const replaceOne = h('button', { type: 'button', class: 've-quiet' }, [messages.replaceOne])
  const replaceEvery = h('button', { type: 'button', class: 've-primary' }, [messages.replaceEvery])
  const element = h(
    'div',
    {
      class: 've-panel ve-search ve-glass ve-solid',
      role: 'dialog',
      'aria-label': messages.search,
      hidden: '',
    },
    [
      h('label', { class: 've-eyebrow', for: findId }, [messages.findLabel]),
      h('div', { class: 've-field-row' }, [find, previous, next]),
      h('div', { class: 've-search-options' }, [matchCase, wholeWord, count]),
      h('label', { class: 've-eyebrow', for: replaceId }, [messages.replaceLabel]),
      h('div', { class: 've-field-row' }, [replacement]),
      h('div', { class: 've-search-actions' }, [replaceOne, replaceEvery]),
    ],
  )

  const pressed = (button: HTMLButtonElement): boolean =>
    button.getAttribute('aria-pressed') === 'true'

  const sync = (): void => {
    const value = commands.query('searchStatus')
    const status = isStatus(value) ? value : { total: 0, current: 0 }
    const empty = find.value === ''
    count.textContent = empty
      ? ''
      : status.total === 0
        ? messages.searchNone
        : format(messages.searchCount, { current: status.current, total: status.total })
    for (const button of [previous, next, replaceOne, replaceEvery]) {
      button.disabled = status.total === 0
    }
  }

  const update = (): void => {
    commands.run('setSearch', {
      query: find.value,
      replace: replacement.value,
      caseSensitive: pressed(matchCase),
      wholeWord: pressed(wholeWord),
    })
    sync()
  }

  const keepFocus = (): void => {
    if (!element.contains(document.activeElement)) find.focus()
  }

  const step = (command: string): void => {
    commands.run(command)
    sync()
    keepFocus()
  }

  const isOpen = (): boolean => !element.hidden

  const close = (returnFocus: boolean): void => {
    if (!isOpen()) return
    element.hidden = true
    commands.run('clearSearch')
    options.onClose()
    if (returnFocus) options.returnToEditor()
  }

  const open = (anchor: HTMLElement): void => {
    const selected = commands.query('selectedText')
    if (typeof selected === 'string' && selected && !selected.includes('\n')) find.value = selected
    element.hidden = false
    options.place(element, anchor)
    update()
    find.focus()
    find.select()
  }

  for (const button of [matchCase, wholeWord]) {
    button.addEventListener('click', () => {
      button.setAttribute('aria-pressed', String(!pressed(button)))
      update()
      keepFocus()
    })
  }
  find.addEventListener('input', update)
  replacement.addEventListener('input', update)
  previous.addEventListener('click', () => step('findPrevious'))
  next.addEventListener('click', () => step('findNext'))
  replaceOne.addEventListener('click', () => step('replaceNext'))
  replaceEvery.addEventListener('click', () => step('replaceAll'))
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
      return
    }
    if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return
    event.preventDefault()
    if (event.target === replacement) step('replaceNext')
    else step(event.shiftKey ? 'findPrevious' : 'findNext')
  })

  return { element, open, close, isOpen }
}
