import { h } from './dom.js'
import { icon } from './icons.js'
import type { Messages } from './messages.js'
import type { Popover, Swatch } from './popover.js'

export interface SwatchPanelOptions {
  messages: Messages
  title: string
  swatches: readonly Swatch[]
  tone: 'dark' | 'light'
  clearLabel: string
  current: () => string | null
  apply: (swatch: Swatch) => void
  clear: () => void
  place: (element: HTMLElement, anchor: HTMLElement) => void
  onClose: () => void
}

const COLUMNS = 5

export function createSwatchPanel(options: SwatchPanelOptions): Popover {
  const { messages } = options
  const buttons = options.swatches.map((swatch) => {
    const button = h('button', {
      type: 'button',
      class: 've-swatch',
      'aria-label': messages[swatch.name],
      title: messages[swatch.name],
      'aria-pressed': 'false',
      tabindex: '-1',
    })
    button.style.setProperty('--ve-swatch', swatch.value)
    button.append(icon('check'))
    button.addEventListener('click', () => {
      options.apply(swatch)
      close(false)
    })
    return button
  })
  const clear = h('button', { type: 'button', class: 've-item ve-clear' }, [
    h('span', { class: 've-item-icon' }, [icon('clear')]),
    h('span', { class: 've-item-label' }, [options.clearLabel]),
  ])
  const element = h(
    'div',
    {
      class: 've-panel ve-swatches ve-glass ve-solid',
      role: 'dialog',
      'aria-label': options.title,
      'data-tone': options.tone,
      hidden: '',
    },
    [
      h('div', { class: 've-eyebrow', 'aria-hidden': 'true' }, [options.title]),
      h('div', { class: 've-swatch-grid' }, buttons),
      clear,
    ],
  )
  let anchor: HTMLElement | null = null
  let active = 0

  const focusSwatch = (index: number): void => {
    active = (index + buttons.length) % buttons.length
    buttons.forEach((button, position) => {
      button.tabIndex = position === active ? 0 : -1
    })
    buttons[active]?.focus()
  }

  const isOpen = (): boolean => !element.hidden

  function close(returnFocus: boolean): void {
    if (!isOpen()) return
    element.hidden = true
    anchor?.setAttribute('aria-expanded', 'false')
    options.onClose()
    if (returnFocus) anchor?.focus()
  }

  const open = (target: HTMLElement): void => {
    anchor = target
    const current = options.current()
    let selected = -1
    options.swatches.forEach((swatch, index) => {
      const pressed = current !== null && (swatch.color ?? swatch.value) === current
      if (pressed) selected = index
      buttons[index]?.setAttribute('aria-pressed', String(pressed))
    })
    clear.hidden = current === null
    element.hidden = false
    target.setAttribute('aria-expanded', 'true')
    options.place(element, target)
    focusSwatch(Math.max(0, selected))
  }

  clear.addEventListener('click', () => {
    options.clear()
    close(false)
  })
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
      return
    }
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0) return
    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: COLUMNS,
      ArrowUp: -COLUMNS,
    }
    const step = steps[event.key]
    if (step === undefined) return
    event.preventDefault()
    const target = index + step
    focusSwatch(target < 0 || target >= buttons.length ? index + Math.sign(step) : target)
  })

  return { element, open, close, isOpen }
}
