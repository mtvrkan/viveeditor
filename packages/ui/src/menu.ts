import { clamp, h, moveFocus } from './dom.js'
import { type IconName, icon } from './icons.js'

export interface MenuItem {
  id: string
  label: string
  icon?: IconName
  glyph?: string
  hint?: string
  font?: string
  role: 'menuitem' | 'menuitemradio' | 'menuitemcheckbox'
  checked?: () => boolean
  disabled?: () => boolean
  hidden?: () => boolean
  group?: number
  danger?: boolean
  items?: readonly MenuItem[]
  action?: () => unknown
}

export interface Menu {
  readonly element: HTMLElement
  readonly trigger: HTMLButtonElement | null
  open(focus?: boolean): void
  close(returnFocus: boolean): void
  isOpen(): boolean
  refresh(): void
}

export interface MenuOptions {
  label: string
  trigger?: HTMLButtonElement
  items: readonly MenuItem[]
  place: (element: HTMLElement) => void
  onOpen: () => void
  onDone: () => void
  onClose?: (returnFocus: boolean) => void
  onBack?: () => void
}

const SUBMENU_DELAY = 250
const EDGE = 8

function placeSubmenu(element: HTMLElement, item: HTMLElement): void {
  const parent = element.offsetParent ?? document.documentElement
  const base = parent.getBoundingClientRect()
  const rect = item.getBoundingClientRect()
  const width = element.offsetWidth
  const height = element.offsetHeight
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight
  const flip = rect.right + width + EDGE > viewportWidth && rect.left - width >= EDGE
  element.dataset.side = flip ? 'left' : 'right'
  const left = flip ? rect.left - width + 4 : rect.right - 4
  element.style.bottom = 'auto'
  element.style.left = `${left - base.left}px`
  element.style.top = `${clamp(rect.top - 6, EDGE, viewportHeight - height - EDGE) - base.top}px`
}

export function createMenu(options: MenuOptions): Menu {
  const trigger = options.trigger ?? null
  const element = h('div', {
    class: 've-menu ve-glass ve-solid',
    role: 'menu',
    'aria-label': options.label,
    hidden: '',
  })
  const submenus = new Map<HTMLButtonElement, Menu>()
  let hoverTimer = 0
  const closeSubmenus = (except?: Menu): void => {
    for (const submenu of submenus.values()) if (submenu !== except) submenu.close(false)
  }
  const openSubmenu = (button: HTMLButtonElement, focus: boolean): void => {
    const submenu = submenus.get(button)
    if (!submenu || button.getAttribute('aria-disabled') === 'true') return
    closeSubmenus(submenu)
    if (!submenu.element.isConnected) element.after(submenu.element)
    if (submenu.isOpen()) {
      if (focus) submenu.open(true)
      return
    }
    button.setAttribute('aria-expanded', 'true')
    submenu.open(focus)
  }
  const hover = (button: HTMLButtonElement | null): void => {
    window.clearTimeout(hoverTimer)
    hoverTimer = window.setTimeout(() => {
      if (!isOpen()) return
      if (button) openSubmenu(button, false)
      else closeSubmenus()
    }, SUBMENU_DELAY)
  }
  const buttons = options.items.map((item) => {
    const visual = item.icon
      ? icon(item.icon)
      : item.glyph === undefined
        ? null
        : h('span', { class: 've-glyph', 'aria-hidden': 'true' }, [item.glyph])
    const label = h('span', { class: 've-item-label' }, [item.label])
    if (item.font) label.style.fontFamily = item.font
    const button = h(
      'button',
      {
        type: 'button',
        class: item.danger ? 've-item ve-danger' : 've-item',
        role: item.role,
        tabindex: '-1',
        'data-item': item.id,
      },
      [
        visual ? h('span', { class: 've-item-icon' }, [visual]) : null,
        label,
        item.hint ? h('span', { class: 've-item-hint' }, [item.hint]) : null,
        item.items
          ? h('span', { class: 've-item-more', 'aria-hidden': 'true' }, [icon('chevron')])
          : item.role === 'menuitem'
            ? null
            : h('span', { class: 've-item-check', 'aria-hidden': 'true' }, [icon('check')]),
      ],
    )
    const children = item.items
    if (children) {
      button.setAttribute('aria-haspopup', 'menu')
      button.setAttribute('aria-expanded', 'false')
      submenus.set(
        button,
        createMenu({
          label: item.label,
          items: children,
          place: (submenu) => placeSubmenu(submenu, button),
          onOpen: () => window.clearTimeout(hoverTimer),
          onDone: () => {
            close(false)
            options.onDone()
          },
          onClose: (returnFocus) => {
            button.setAttribute('aria-expanded', 'false')
            if (returnFocus) button.focus()
          },
          onBack: () => close(false),
        }),
      )
    }
    button.addEventListener('pointerenter', () => hover(children ? button : null))
    button.addEventListener('click', () => {
      if (item.disabled?.()) return
      if (children) {
        openSubmenu(button, true)
        return
      }
      close(false)
      if (item.action?.() !== true) options.onDone()
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
      button.hidden =
        item.hidden?.() ?? item.items?.every((child) => child.hidden?.() ?? false) ?? false
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

  const open = (focus = true): void => {
    options.onOpen()
    refresh()
    element.hidden = false
    trigger?.setAttribute('aria-expanded', 'true')
    options.place(element)
    if (!focus) return
    const shown = visible()
    const checked = shown.find((button) => button.getAttribute('aria-checked') === 'true')
    ;(checked ?? shown[0])?.focus()
  }

  function close(returnFocus: boolean): void {
    window.clearTimeout(hoverTimer)
    closeSubmenus()
    if (!isOpen()) return
    element.hidden = true
    trigger?.setAttribute('aria-expanded', 'false')
    if (returnFocus) trigger?.focus()
    options.onClose?.(returnFocus)
  }

  element.addEventListener('pointerenter', () => window.clearTimeout(hoverTimer))

  element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
      return
    }
    if (event.key === 'Tab') {
      close(false)
      options.onBack?.()
      return
    }
    const focused = document.activeElement as HTMLButtonElement
    if (event.key === 'ArrowRight' && submenus.has(focused)) {
      event.preventDefault()
      openSubmenu(focused, true)
      return
    }
    if (event.key === 'ArrowLeft' && options.onBack) {
      event.preventDefault()
      close(true)
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const shown = visible()
    const current = shown.indexOf(document.activeElement as HTMLButtonElement)
    shown[moveFocus(shown, current, event.key)]?.focus()
  })

  if (trigger) {
    trigger.setAttribute('aria-haspopup', 'menu')
    trigger.setAttribute('aria-expanded', 'false')
    trigger.addEventListener('click', () => (isOpen() ? close(true) : open()))
  }

  return { element, trigger, open, close, isOpen, refresh }
}
