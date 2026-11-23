import type { CommandAccess } from './commands.js'
import { h, uniqueId } from './dom.js'
import { icon } from './icons.js'
import { format, formatPoints, type Messages } from './messages.js'
import type { Popover } from './popover.js'

export interface FontSizePanelOptions {
  commands: CommandAccess
  messages: Messages
  locale: string
  place: (element: HTMLElement, anchor: HTMLElement) => void
  returnToEditor: () => void
  onClose: () => void
}

const PRESETS: readonly number[] = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72]
const DEFAULT_POINTS = 12
const MIN_POINTS = 6
const MAX_POINTS = 96
const COLUMNS = 5
const TYPED_POINTS = /^([0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:\s*pt)?$/

export function readPoints(raw: string): number | null {
  const value = raw.trim().toLowerCase().replace(',', '.')
  const match = TYPED_POINTS.exec(value)
  return match ? Number(match[1]) : null
}

const currentPoints = (commands: CommandAccess): number | null => {
  const points = commands.query('fontSizePoints')
  return typeof points === 'number' ? points : null
}

export function createFontSizePanel(options: FontSizePanelOptions): Popover {
  const { commands, messages } = options
  const id = uniqueId('ve-font-size')
  const stepButton = (direction: 1 | -1): HTMLButtonElement => {
    const label = direction === 1 ? messages.fontSizeLarger : messages.fontSizeSmaller
    const button = h(
      'button',
      { type: 'button', class: 've-btn ve-size-step', 'aria-label': label, title: label },
      [h('span', { 'aria-hidden': 'true' }, [direction === 1 ? '+' : '−'])],
    )
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') === 'true') return
      commands.run('stepFontSize', direction)
      sync()
    })
    return button
  }
  const smaller = stepButton(-1)
  const larger = stepButton(1)
  const field = h('input', {
    id: `${id}-field`,
    class: 've-input ve-size-field',
    type: 'text',
    inputmode: 'decimal',
    autocomplete: 'off',
    spellcheck: 'false',
    maxlength: '8',
    placeholder: '12',
    'aria-describedby': `${id}-hint`,
  })
  const hint = h('p', { id: `${id}-hint`, class: 've-hint', role: 'status', hidden: '' })
  const form = h('form', { class: 've-size-form', novalidate: '' }, [
    h('label', { class: 've-eyebrow', for: `${id}-field` }, [messages.fontSizeField]),
    h('div', { class: 've-field-row' }, [smaller, field, larger]),
    hint,
  ])
  const presets = PRESETS.map((points) => {
    const button = h(
      'button',
      {
        type: 'button',
        class: 've-size-preset',
        'aria-pressed': 'false',
        'aria-label': format(messages.fontSizeCurrent, {
          size: formatPoints(points, options.locale),
        }),
        tabindex: '-1',
      },
      [formatPoints(points, options.locale)],
    )
    button.addEventListener('click', () => {
      commands.run('setFontSize', points)
      finish()
    })
    return button
  })
  const clear = h('button', { type: 'button', class: 've-item ve-clear' }, [
    h('span', { class: 've-item-icon' }, [icon('clear')]),
    h('span', { class: 've-item-label' }, [messages.fontSizeDefault]),
  ])
  const element = h(
    'div',
    {
      class: 've-panel ve-font-size ve-glass ve-solid',
      role: 'dialog',
      'aria-label': messages.fontSize,
      hidden: '',
    },
    [
      form,
      h('div', { class: 've-eyebrow', id: `${id}-presets` }, [messages.fontSizePresets]),
      h(
        'div',
        { class: 've-size-grid', role: 'group', 'aria-labelledby': `${id}-presets` },
        presets,
      ),
      clear,
    ],
  )
  let anchor: HTMLElement | null = null
  let active = 0

  const setInvalid = (invalid: boolean): void => {
    field.setAttribute('aria-invalid', String(invalid))
    hint.hidden = !invalid
    hint.textContent = invalid
      ? format(messages.fontSizeInvalid, { min: MIN_POINTS, max: MAX_POINTS })
      : ''
  }

  const setActive = (index: number): void => {
    active = index
    presets.forEach((button, position) => {
      button.tabIndex = position === active ? 0 : -1
    })
  }

  const sync = (): void => {
    const points = currentPoints(commands)
    field.value = points === null ? '' : formatPoints(points, options.locale)
    setInvalid(false)
    let selected = -1
    PRESETS.forEach((value, index) => {
      const pressed = value === points
      if (pressed) selected = index
      presets[index]?.setAttribute('aria-pressed', String(pressed))
    })
    setActive(selected >= 0 ? selected : PRESETS.indexOf(DEFAULT_POINTS))
    smaller.setAttribute('aria-disabled', String(!commands.can('stepFontSize', -1)))
    larger.setAttribute('aria-disabled', String(!commands.can('stepFontSize', 1)))
    clear.hidden = points === null
  }

  const isOpen = (): boolean => !element.hidden

  function close(returnFocus: boolean): void {
    if (!isOpen()) return
    element.hidden = true
    anchor?.setAttribute('aria-expanded', 'false')
    options.onClose()
    if (returnFocus) anchor?.focus()
  }

  function finish(): void {
    close(false)
    options.returnToEditor()
  }

  const open = (target: HTMLElement): void => {
    anchor = target
    sync()
    element.hidden = false
    target.setAttribute('aria-expanded', 'true')
    options.place(element, target)
    field.focus()
    field.select()
  }

  field.addEventListener('input', () => setInvalid(false))
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const points = readPoints(field.value)
    if (points === null || !commands.run('setFontSize', points)) {
      setInvalid(true)
      field.focus()
      return
    }
    finish()
  })
  clear.addEventListener('click', () => {
    commands.run('unsetFontSize')
    finish()
  })
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
      return
    }
    const index = presets.indexOf(document.activeElement as HTMLButtonElement)
    if (index < 0) return
    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: COLUMNS,
      ArrowUp: -COLUMNS,
    }
    const last = presets.length - 1
    const target =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? last
          : steps[event.key] === undefined
            ? null
            : Math.min(last, Math.max(0, index + (steps[event.key] ?? 0)))
    if (target === null) return
    event.preventDefault()
    setActive(target)
    presets[target]?.focus()
  })

  return { element, open, close, isOpen }
}
