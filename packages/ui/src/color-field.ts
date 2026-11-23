import { normalizeColor } from '@viveeditor/core'
import { clamp, h, uniqueId } from './dom.js'
import { icon } from './icons.js'
import type { Messages } from './messages.js'

export interface ColorFieldOptions {
  messages: Messages
  recentKey: string
  current: () => string | null
  documentColors?: () => readonly string[]
  exclude?: readonly string[]
  apply: (color: string) => void
  onResize?: () => void
}

export interface ColorField {
  readonly element: HTMLElement
  readonly controls: readonly HTMLElement[]
  sync(): void
}

type EyeDropperConstructor = new () => { open(): Promise<{ sRGBHex: string }> }

const RECENT_LIMIT = 8
const FALLBACK = '#1a73e8'
const recentByKey = new Map<string, string[]>()
const HEX_PREFIX = /^#[\da-f]{6}/
const BARE_HEX = /^[\da-f]{3,8}$/i
const MOVES: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
}

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

const hexOf = (color: string | null | undefined): string | null =>
  HEX_PREFIX.exec(color ?? '')?.[0] ?? null

export function createColorField(options: ColorFieldOptions): ColorField {
  const { messages } = options
  const id = uniqueId('ve-color')
  const Dropper = (globalThis as { EyeDropper?: EyeDropperConstructor }).EyeDropper
  let hue = 0
  let saturation = 0
  let brightness = 0
  let dragging = false

  const area = h(
    'div',
    { class: 've-color-area', role: 'slider', tabindex: '0', 'aria-label': messages.colorPicker },
    [h('span', { class: 've-color-thumb' })],
  )
  const slider = h('input', {
    type: 'range',
    class: 've-color-hue',
    max: '360',
    'aria-label': messages.colorHue,
  })
  const code = h('input', {
    class: 've-input ve-color-code',
    type: 'text',
    spellcheck: 'false',
    autocomplete: 'off',
    autocapitalize: 'off',
    maxlength: '32',
    'aria-label': messages.colorCode,
    'aria-describedby': `${id}-hint`,
  })
  const dropper =
    Dropper &&
    h(
      'button',
      {
        type: 'button',
        class: 've-btn ve-color-dropper',
        'aria-label': messages.colorEyedropper,
        title: messages.colorEyedropper,
      },
      [icon('eyedropper')],
    )
  const submit = h('button', { type: 'submit', class: 've-primary' }, [messages.colorApply])
  const hint = h('p', { id: `${id}-hint`, class: 've-hint', role: 'status', hidden: '' })
  const toggle = h(
    'button',
    {
      type: 'button',
      class: 've-item ve-color-toggle',
      'aria-expanded': 'false',
      'aria-controls': `${id}-custom`,
    },
    [
      h('span', { class: 've-item-icon ve-color-any' }),
      h('span', { class: 've-item-label' }, [messages.customColor]),
      h('span', { class: 've-item-more' }, [icon('chevron')]),
    ],
  )
  const form = h(
    'form',
    { id: `${id}-custom`, class: 've-color-form', novalidate: '', hidden: '' },
    [
      area,
      slider,
      h('div', { class: 've-field-row ve-color-row' }, [
        h('span', { class: 've-color-preview' }),
        code,
        dropper,
        submit,
      ]),
      hint,
    ],
  )
  const recentGrid = h('div', {
    class: 've-swatch-grid ve-recent-colors',
    role: 'group',
    'aria-labelledby': `${id}-recent`,
  })
  const recentSection = h('div', { class: 've-color-recent' }, [
    h('div', { class: 've-eyebrow', id: `${id}-recent` }, [messages.recentColors]),
    recentGrid,
  ])
  const element = h('div', { class: 've-color-field' }, [recentSection, toggle, form])
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

  const paint = (color: string): void => form.style.setProperty('--ve-swatch', color)

  const render = (writeCode: boolean): void => {
    const channel = (offset: number): string => {
      const k = (offset + hue / 60) % 6
      const level = brightness * (1 - saturation * clamp(Math.min(k, 4 - k), 0, 1))
      return Math.round(level * 255)
        .toString(16)
        .padStart(2, '0')
    }
    const hex = `#${channel(5)}${channel(3)}${channel(1)}`
    const style = form.style
    style.setProperty('--ve-hue', String(hue))
    style.setProperty('--ve-x', `${saturation * 100}%`)
    style.setProperty('--ve-y', `${100 - brightness * 100}%`)
    area.setAttribute('aria-valuenow', String(Math.round(saturation * 100)))
    area.setAttribute('aria-valuetext', hex)
    slider.value = String(hue)
    paint(hex)
    if (writeCode) {
      code.value = hex
      setInvalid(false)
    }
  }

  const show = (raw: string, writeCode: boolean): void => {
    const color = readColor(raw)
    const hex = hexOf(color)
    if (hex) {
      const [red = 0, green = 0, blue = 0] = [1, 3, 5].map(
        (start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255,
      )
      const max = Math.max(red, green, blue)
      const range = max - Math.min(red, green, blue)
      if (range > 0) {
        const sector =
          max === red
            ? (green - blue) / range
            : max === green
              ? (blue - red) / range + 2
              : (red - green) / range + 4
        hue = Math.round((sector * 60 + 360) % 360)
      }
      saturation = max && range / max
      brightness = max
      render(writeCode)
    }
    if (color) paint(color)
  }

  const pick = (event: PointerEvent): void => {
    const rect = area.getBoundingClientRect()
    if (!rect.width) return
    saturation = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    brightness = 1 - clamp((event.clientY - rect.top) / rect.height, 0, 1)
    render(true)
  }

  const renderRecent = (current: string | null): string[] => {
    const excluded = new Set(options.exclude)
    const colors = [
      ...new Set(
        [...(recentByKey.get(options.recentKey) ?? []), ...(options.documentColors?.() ?? [])].map(
          normalizeColor,
        ),
      ),
    ]
      .filter((color): color is string => color !== null && !excluded.has(color))
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
    return colors
  }

  toggle.addEventListener('click', () => {
    const expanded = form.hidden === true
    toggle.setAttribute('aria-expanded', String(expanded))
    form.hidden = !expanded
    options.onResize?.()
    if (expanded) form.scrollIntoView?.({ block: 'nearest' })
  })
  area.addEventListener('pointerdown', (event) => {
    if (event.button) return
    event.preventDefault()
    dragging = true
    area.setPointerCapture?.(event.pointerId)
    area.focus({ preventScroll: true })
    pick(event)
  })
  area.addEventListener('pointermove', (event) => {
    if (dragging) pick(event)
  })
  for (const type of ['pointerup', 'pointercancel']) {
    area.addEventListener(type, () => {
      dragging = false
    })
  }
  area.addEventListener('keydown', (event) => {
    const move = MOVES[event.key]
    if (!move) return
    event.preventDefault()
    const size = event.shiftKey ? 0.1 : 0.01
    saturation = clamp(saturation + move[0] * size, 0, 1)
    brightness = clamp(brightness + move[1] * size, 0, 1)
    render(true)
  })
  form.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || (event.target !== area && event.target !== slider)) return
    event.preventDefault()
    form.requestSubmit()
  })
  slider.addEventListener('input', () => {
    hue = Number(slider.value)
    render(true)
  })
  dropper?.addEventListener('click', async () => {
    try {
      show((await new (Dropper as EyeDropperConstructor)().open()).sRGBHex, true)
    } catch {
      return
    }
  })
  code.addEventListener('input', () => {
    setInvalid(false)
    show(code.value, false)
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
      return [...recentButtons, toggle, area, slider, code, ...(dropper ? [dropper] : []), submit]
    },
    sync: () => {
      const current = options.current()
      const normalized = current === null ? null : normalizeColor(current)
      const recent = renderRecent(normalized)
      hue = 0
      show(hexOf(normalized) ?? hexOf(recent[0]) ?? FALLBACK, true)
      if (normalized && normalized !== hexOf(normalized)) {
        code.value = normalized
        paint(normalized)
      }
    },
  }
}
