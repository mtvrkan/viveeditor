import type { CommandAccess } from './commands.js'
import { h, uniqueId } from './dom.js'
import { format, type MessageKey, type Messages } from './messages.js'
import type { Popover } from './popover.js'

export interface ListStylePanelOptions {
  commands: CommandAccess
  messages: Messages
  place: (element: HTMLElement, anchor: HTMLElement) => void
  returnToEditor: () => void
  onClose: () => void
}

type CurrentListStyle =
  | { kind: 'ordered'; type: string; start: number }
  | { kind: 'bullet'; style: string | null }
  | null

const MAX_START = 99999
const TYPED_START = /^[0-9]{1,5}$/

const BULLETS: readonly { value: string; label: MessageKey; glyph: string }[] = [
  { value: 'disc', label: 'bulletDisc', glyph: '●' },
  { value: 'circle', label: 'bulletCircle', glyph: '○' },
  { value: 'square', label: 'bulletSquare', glyph: '■' },
]

const NUMBERINGS: readonly { value: string; glyph: string; label: string }[] = [
  { value: '1', glyph: '1.', label: '1, 2, 3' },
  { value: 'a', glyph: 'a.', label: 'a, b, c' },
  { value: 'A', glyph: 'A.', label: 'A, B, C' },
  { value: 'i', glyph: 'i.', label: 'i, ii, iii' },
  { value: 'I', glyph: 'I.', label: 'I, II, III' },
]

export function readListStart(raw: string): number | null {
  const value = raw.trim()
  if (!TYPED_START.test(value)) return null
  const start = Number(value)
  return start <= MAX_START ? start : null
}

const currentStyle = (commands: CommandAccess): CurrentListStyle => {
  const style = commands.query('listStyle')
  return typeof style === 'object' && style !== null ? (style as CurrentListStyle) : null
}

export function createListStylePanel(options: ListStylePanelOptions): Popover {
  const { commands, messages } = options
  const id = uniqueId('ve-list-style')
  const choice = (glyph: string, label: string, preview: string): HTMLButtonElement =>
    h(
      'button',
      {
        type: 'button',
        class: 've-list-choice',
        'aria-pressed': 'false',
        'aria-label': label,
        title: label,
        'data-preview': preview,
      },
      [h('span', { 'aria-hidden': 'true' }, [glyph])],
    )
  const bullets = BULLETS.map((spec) => {
    const button = choice(spec.glyph, messages[spec.label], spec.value)
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') === 'true') return
      commands.run('setBulletStyle', spec.value)
      finish()
    })
    return { spec, button }
  })
  const numberings = NUMBERINGS.map((spec) => {
    const button = choice(spec.glyph, spec.label, spec.value)
    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') === 'true') return
      commands.run('setListType', spec.value)
      finish()
    })
    return { spec, button }
  })
  const field = h('input', {
    id: `${id}-start`,
    class: 've-input ve-list-start',
    type: 'text',
    inputmode: 'numeric',
    autocomplete: 'off',
    spellcheck: 'false',
    maxlength: '5',
    placeholder: '1',
    'aria-describedby': `${id}-hint`,
  })
  const hint = h('p', { id: `${id}-hint`, class: 've-hint', 'aria-live': 'polite', hidden: '' })
  const form = h('form', { class: 've-list-form', novalidate: '' }, [
    h('label', { class: 've-eyebrow', for: `${id}-start` }, [messages.listStart]),
    field,
    hint,
  ])
  const section = (title: string, buttons: readonly HTMLButtonElement[], extra: string) =>
    h('div', { class: 've-list-section' }, [
      h('div', { class: 've-eyebrow', id: `${id}-${extra}` }, [title]),
      h(
        'div',
        {
          class: `ve-list-grid ve-list-${extra}`,
          role: 'group',
          'aria-labelledby': `${id}-${extra}`,
        },
        buttons,
      ),
    ])
  const element = h(
    'div',
    {
      class: 've-panel ve-list-style ve-glass ve-solid',
      role: 'dialog',
      'aria-label': messages.listStyle,
      hidden: '',
    },
    [
      section(
        messages.bulletStyle,
        bullets.map((entry) => entry.button),
        'bullets',
      ),
      section(
        messages.numberingType,
        numberings.map((entry) => entry.button),
        'numbers',
      ),
      form,
    ],
  )
  let anchor: HTMLElement | null = null

  const setInvalid = (invalid: boolean): void => {
    field.setAttribute('aria-invalid', String(invalid))
    hint.hidden = !invalid
    hint.textContent = invalid ? format(messages.listStartInvalid, { max: MAX_START }) : ''
  }

  const sync = (): void => {
    const style = currentStyle(commands)
    const bullet = style?.kind === 'bullet'
    const ordered = style?.kind === 'ordered'
    for (const { spec, button } of bullets) {
      const pressed = bullet && (style.style ?? 'disc') === spec.value
      button.setAttribute('aria-pressed', String(pressed))
      button.setAttribute('aria-disabled', String(!bullet))
    }
    for (const { spec, button } of numberings) {
      button.setAttribute('aria-pressed', String(ordered && style.type === spec.value))
      button.setAttribute('aria-disabled', String(!ordered))
    }
    field.disabled = !ordered
    field.value = ordered ? String(style.start) : ''
    setInvalid(false)
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
    const pressed = [...bullets, ...numberings].find(
      (entry) => entry.button.getAttribute('aria-pressed') === 'true',
    )
    const first = [...bullets, ...numberings].find(
      (entry) => entry.button.getAttribute('aria-disabled') !== 'true',
    )
    ;(pressed ?? first)?.button.focus()
  }

  field.addEventListener('input', () => setInvalid(false))
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const start = readListStart(field.value)
    if (start === null || !commands.run('setListStart', start)) {
      setInvalid(true)
      field.focus()
      return
    }
    finish()
  })
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    close(true)
  })

  return { element, open, close, isOpen }
}
