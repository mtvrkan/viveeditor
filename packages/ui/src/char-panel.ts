import type { CommandAccess } from './commands.js'
import { h, uniqueId } from './dom.js'
import type { MessageKey, Messages } from './messages.js'
import type { Popover } from './popover.js'

export interface CharPanelOptions {
  commands: CommandAccess
  messages: Messages
  place: (element: HTMLElement, anchor: HTMLElement) => void
  returnToEditor: () => void
  onClose: () => void
}

const GROUPS: readonly { label: MessageKey; chars: string }[] = [
  { label: 'charsPunctuation', chars: '– — … « » “ ” ‘ ’ „ ‹ › · • ¶ § † ‡ ′ ″ ¡ ¿' },
  { label: 'charsCurrency', chars: '₺ € $ £ ¥ ¢ ₽ ₹ ₩ ₪ ₿ ¤' },
  { label: 'charsMath', chars: '± × ÷ ≠ ≈ ≤ ≥ ∞ √ ∑ ∏ ∫ ∂ ∆ ° ‰ ½ ⅓ ¼ ¾ ¹ ² ³ µ' },
  { label: 'charsArrows', chars: '← → ↑ ↓ ↔ ↕ ⇐ ⇒ ⇔ ↵ ↺ ↻' },
  {
    label: 'charsLetters',
    chars: 'Â â Î î Û û Ä ä Ë ë Ï ï ß Æ æ Œ œ Ø ø Å å Ñ ñ É é È è Ç ç Ğ ğ İ ı Ş ş Ö ö Ü ü',
  },
  { label: 'charsGreek', chars: 'α β γ δ ε ζ η θ λ μ ξ π ρ σ τ φ χ ψ ω Γ Δ Θ Λ Π Σ Φ Ψ Ω' },
  { label: 'charsSymbols', chars: '© ® ™ ℃ № ✓ ✗ ★ ☆ ♥ ♦ ♣ ♠ ☐ ☑ ♪' },
]

const COLUMNS = 8

const codePoint = (char: string): string =>
  `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`

export function createCharPanel(options: CharPanelOptions): Popover {
  const { commands, messages } = options
  const selectId = uniqueId('ve-chars')
  const select = h(
    'select',
    { id: selectId, class: 've-input ve-char-group' },
    GROUPS.map((group, index) => h('option', { value: String(index) }, [messages[group.label]])),
  )
  const grid = h('div', { class: 've-char-grid', role: 'group', 'aria-labelledby': selectId })
  const element = h(
    'div',
    {
      class: 've-panel ve-chars ve-glass ve-solid',
      role: 'dialog',
      'aria-label': messages.specialCharacters,
      hidden: '',
    },
    [h('label', { class: 've-eyebrow', for: selectId }, [messages.charCategory]), select, grid],
  )
  let anchor: HTMLElement | null = null
  let buttons: HTMLButtonElement[] = []

  const focusChar = (index: number): void => {
    const active = Math.max(0, Math.min(buttons.length - 1, index))
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

  const render = (): void => {
    const group = GROUPS[Number(select.value)] ?? GROUPS[0]
    buttons = (group?.chars.split(' ') ?? []).map((char, index) =>
      h(
        'button',
        {
          type: 'button',
          class: 've-char',
          title: codePoint(char),
          tabindex: index === 0 ? '0' : '-1',
        },
        [char],
      ),
    )
    grid.replaceChildren(...buttons)
  }

  const open = (target: HTMLElement): void => {
    anchor = target
    element.hidden = false
    target.setAttribute('aria-expanded', 'true')
    options.place(element, target)
    focusChar(0)
  }

  select.addEventListener('change', render)
  grid.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('.ve-char')
    if (!button?.textContent) return
    commands.run('insertText', button.textContent)
    close(false)
    options.returnToEditor()
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
    focusChar(index + step)
  })
  render()

  return { element, open, close, isOpen }
}
