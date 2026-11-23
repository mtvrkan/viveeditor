import { normalizeColor } from '@viveeditor/core'
import { h, uniqueId } from './dom.js'
import { icon } from './icons.js'
import type { Messages } from './messages.js'

export interface ColorFieldOptions {
  messages: Messages
  recentKey: string
  current: () => string | null
  documentColors?: () => readonly string[]
  exclude?: readonly string[]
  apply: (color: string) => void
}

export interface ColorField {
  readonly element: HTMLElement
  readonly controls: readonly HTMLElement[]
  sync(): void
}

const RECENT_LIMIT = 8
const recentByKey = new Map<string, string[]>()
const SIX_DIGITS = /^#[\da-f]{6}$/
const BARE_HEX = /^[\da-f]{3,8}$/i

export function readColor(raw: string): string | null {
  const value = raw.trim()
  const candidate = BARE_HEX.test(value) ? `#${value}` : value
  const color = normalizeColor(candidate)
  if (color === null) return null
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', color) ? color : null
  }
  return color
}

export function rememberColor(key: string, color: string): void {
  const list = (recentByKey.get(key) ?? []).filter((entry) => entry !== color)
  recentByKey.set(key, [color, ...list].slice(0, RECENT_LIMIT))
}

export function createColorField(options: ColorFieldOptions): ColorField {
  const { messages } = options
  const id = uniqueId('ve-color')
  const picker = h('input', {
    type: 'color',
    class: 've-color-picker',
    'aria-label': messages.colorPicker,
    title: messages.colorPicker,
  })
  const code = h('input', {
    id: `${id}-code`,
    class: 've-input ve-color-code',
    type: 'text',
    inputmode: 'text',
    spellcheck: 'false',
    autocomplete: 'off',
    autocapitalize: 'off',
    maxlength: '32',
    placeholder: '#1a73e8',
    'aria-label': messages.colorCode,
    'aria-describedby': `${id}-hint`,
  })
  const submit = h('button', { type: 'submit', class: 've-primary' }, [messages.colorApply])
  const hint = h('p', { id: `${id}-hint`, class: 've-hint', role: 'status', hidden: '' })
  const recentLabel = h('div', { class: 've-eyebrow', id: `${id}-recent` }, [messages.recentColors])
  const recentGrid = h('div', {
    class: 've-swatch-grid ve-recent-colors',
    role: 'group',
    'aria-labelledby': `${id}-recent`,
  })
  const form = h('form', { class: 've-color-form', novalidate: '' }, [
    h('label', { class: 've-eyebrow', for: `${id}-code` }, [messages.customColor]),
    h('div', { class: 've-field-row' }, [picker, code, submit]),
    hint,
  ])
  const recentSection = h('div', { class: 've-color-recent' }, [recentLabel, recentGrid])
  const element = h('div', { class: 've-color-field' }, [recentSection, form])
  let recentButtons: HTMLButtonElement[] = []

  const choose = (color: string): void => {
    rememberColor(options.recentKey, color)
    options.apply(color)
  }

  const setInvalid = (invalid: boolean): void => {
    code.setAttribute('aria-invalid', String(invalid))
    hint.hidden = !invalid
    hint.textContent = invalid ? messages.colorInvalid : ''
  }

  const renderRecent = (current: string | null): void => {
    const excluded = new Set(options.exclude ?? [])
    const seen = new Set<string>()
    const colors = [
      ...(recentByKey.get(options.recentKey) ?? []),
      ...(options.documentColors?.() ?? []),
    ]
      .map((color) => normalizeColor(color))
      .filter((color): color is string => {
        if (color === null || excluded.has(color) || seen.has(color)) return false
        seen.add(color)
        return true
      })
      .slice(0, RECENT_LIMIT)
    recentButtons = colors.map((color) => {
      const button = h('button', {
        type: 'button',
        class: 've-swatch',
        'aria-label': color,
        title: color,
        'aria-pressed': String(color === current),
      })
      button.style.setProperty('--ve-swatch', color)
      button.append(icon('check'))
      button.addEventListener('click', () => choose(color))
      return button
    })
    recentGrid.replaceChildren(...recentButtons)
    recentSection.hidden = recentButtons.length === 0
  }

  picker.addEventListener('input', () => {
    code.value = picker.value
    setInvalid(false)
  })
  picker.addEventListener('change', () => choose(picker.value))
  code.addEventListener('input', () => {
    setInvalid(false)
    const color = readColor(code.value)
    if (color !== null && SIX_DIGITS.test(color)) picker.value = color
  })
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const color = readColor(code.value)
    if (color === null) {
      setInvalid(true)
      code.focus()
      return
    }
    choose(color)
  })

  return {
    element,
    get controls() {
      return [...recentButtons, picker, code, submit]
    },
    sync: () => {
      const current = options.current()
      const normalized = current === null ? null : normalizeColor(current)
      code.value = normalized ?? ''
      picker.value = normalized !== null && SIX_DIGITS.test(normalized) ? normalized : '#000000'
      setInvalid(false)
      renderRecent(normalized)
    },
  }
}
