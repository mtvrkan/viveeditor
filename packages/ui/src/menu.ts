import { h, moveFocus } from './dom.js'
import { type IconName, icon } from './icons.js'

export interface MenuItem {
  id: string
  label: string
  icon?: IconName
  glyph?: string
  hint?: string
  role: 'menuitem' | 'menuitemradio' | 'menuitemcheckbox'
  checked?: () => boolean
  disabled?: () => boolean
  hidden?: () => boolean
  group?: number
  action: () => unknown
}

export interface Menu {
  readonly element: HTMLElement
  readonly trigger: HTMLButtonElement
  open(): void
  close(returnFocus: boolean): void
  isOpen(): boolean
  refresh(): void
}

export interface MenuOptions {
  label: string
  trigger: HTMLButtonElement
  items: readonly MenuItem[]
  place: (element: HTMLElement) => void
  onOpen: () => void
  onDone: () => void
}

export function createMenu(options: MenuOptions): Menu {
  const element = h('div', {
    class: 've-menu ve-glass ve-solid',
    role: 'menu',
    'aria-label': options.label,
    hidden: '',
  })
  const buttons = options.items.map((item) => {
    const visual = item.icon ? icon(item.icon) : h('span', { class: 've-glyph' }, [item.glyph])
    const button = h(
      'button',
      { type: 'button', class: 've-item', role: item.role, tabindex: '-1' },
      [
        h('span', { class: 've-item-icon' }, [visual]),
        h('span', { class: 've-item-label' }, [item.label]),
        item.hint ? h('span', { class: 've-item-hint' }, [item.hint]) : null,
      ],
    )
    button.addEventListener('click', () => {
      if (item.disabled?.()) return
      close(false)
      if (item.action() !== true) options.onDone()
    })
    return button
  })
  options.items.forEach((item, index) => {
    const previous = options.items[index - 1]
    if (previous && previous.group !== item.group) {
      element.append(h('div', { class: 've-sep', role: 'separator' }))
    }
    const button = buttons[index]
    if (button) element.append(button)
  })

  const refresh = (): void => {
    options.items.forEach((item, index) => {
      const button = buttons[index]
      if (!button) return
      if (item.role !== 'menuitem')
        button.setAttribute('aria-checked', String(item.checked?.() ?? false))
      button.setAttribute('aria-disabled', String(item.disabled?.() ?? false))
      button.hidden = item.hidden?.() ?? false
    })
    tidySeparators()
  }

  const tidySeparators = (): void => {
    let previous: HTMLElement | null = null
    for (const child of element.children as HTMLCollectionOf<HTMLElement>) {
      if (child.classList.contains('ve-sep')) {
        child.hidden = !previous || previous.classList.contains('ve-sep')
        if (!child.hidden) previous = child
      } else if (!child.hidden) {
        previous = child
      }
    }
    if (previous?.classList.contains('ve-sep')) previous.hidden = true
  }

  const visible = (): HTMLButtonElement[] => buttons.filter((button) => !button.hidden)

  const isOpen = (): boolean => !element.hidden

  const open = (): void => {
    options.onOpen()
    refresh()
    element.hidden = false
    options.trigger.setAttribute('aria-expanded', 'true')
    options.place(element)
    const shown = visible()
    const checked = shown.find((button) => button.getAttribute('aria-checked') === 'true')
    ;(checked ?? shown[0])?.focus()
  }

  function close(returnFocus: boolean): void {
    if (!isOpen()) return
    element.hidden = true
    options.trigger.setAttribute('aria-expanded', 'false')
    if (returnFocus) options.trigger.focus()
  }

  element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
      return
    }
    if (event.key === 'Tab') {
      close(false)
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const shown = visible()
    const current = shown.indexOf(document.activeElement as HTMLButtonElement)
    shown[moveFocus(shown, current, event.key)]?.focus()
  })

  options.trigger.setAttribute('aria-haspopup', 'menu')
  options.trigger.setAttribute('aria-expanded', 'false')
  options.trigger.addEventListener('click', () => (isOpen() ? close(true) : open()))

  return { element, trigger: options.trigger, open, close, isOpen, refresh }
}
