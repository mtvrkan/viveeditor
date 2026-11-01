import type { CommandAccess } from './commands.js'
import { h, uniqueId } from './dom.js'
import { icon } from './icons.js'
import { format, type Messages } from './messages.js'
import type { Popover } from './popover.js'

export interface EmbedPanelOptions {
  commands: CommandAccess
  messages: Messages
  place: (element: HTMLElement, anchor: HTMLElement) => void
  returnToEditor: () => void
  onClose: () => void
}

const titleOf = (value: unknown): string | null =>
  typeof value === 'object' && value !== null && 'title' in value
    ? typeof value.title === 'string'
      ? value.title
      : ''
    : null

export function createEmbedPanel(options: EmbedPanelOptions): Popover {
  const { commands, messages } = options
  const id = uniqueId('ve-embed')
  const hintId = `${id}-hint`
  const input = h('input', {
    id,
    class: 've-input',
    type: 'text',
    autocomplete: 'off',
    spellcheck: 'false',
    'aria-describedby': hintId,
  })
  const label = h('label', { class: 've-eyebrow', for: id })
  const hint = h('p', { id: hintId, class: 've-hint', 'aria-live': 'polite' })
  const submit = h('button', { type: 'button', class: 've-primary' })
  const title = h('div', { class: 've-eyebrow ve-image-title', 'aria-hidden': 'true' })
  const element = h(
    'div',
    {
      class: 've-panel ve-image-panel ve-embed-panel ve-glass ve-solid',
      role: 'dialog',
      hidden: '',
    },
    [title, label, input, hint, h('div', { class: 've-image-actions' }, [submit])],
  )
  let editing = false
  let anchor: HTMLElement | null = null

  const providers = (): string => {
    const names = commands.query('embedProviders')
    return Array.isArray(names) ? names.join(', ') : ''
  }

  const setHint = (text: string, error: boolean): void => {
    hint.replaceChildren(...(error ? [icon('alert')] : []), text)
    hint.dataset.tone = error ? 'error' : ''
    if (error) input.setAttribute('aria-invalid', 'true')
    else input.removeAttribute('aria-invalid')
  }

  const isOpen = (): boolean => !element.hidden

  const close = (returnFocus: boolean): void => {
    if (!isOpen()) return
    element.hidden = true
    anchor?.setAttribute('aria-expanded', 'false')
    options.onClose()
    if (returnFocus) anchor?.focus()
  }

  const apply = (): void => {
    const value = input.value.trim()
    const command = editing ? 'setEmbedTitle' : 'insertEmbed'
    if (!commands.run(command, value)) {
      setHint(format(messages.embedUnsupported, { providers: providers() }), true)
      input.focus()
      return
    }
    close(false)
    options.returnToEditor()
  }

  const open = (target: HTMLElement): void => {
    anchor = target
    const current = titleOf(commands.query('selectedEmbed'))
    editing = current !== null
    const heading = editing ? messages.embed : messages.embedInsert
    title.textContent = heading
    element.setAttribute('aria-label', heading)
    label.textContent = editing ? messages.embedTitle : messages.embedUrl
    input.value = current ?? ''
    input.inputMode = editing ? 'text' : 'url'
    input.placeholder = editing ? '' : 'https://'
    setHint(
      editing
        ? messages.embedTitleHint
        : format(messages.embedSupported, { providers: providers() }),
      false,
    )
    submit.textContent = editing ? messages.imageApply : messages.imageAdd
    element.hidden = false
    target.setAttribute('aria-expanded', 'true')
    options.place(element, target)
    input.focus()
    input.select()
  }

  input.addEventListener('input', () => {
    if (input.hasAttribute('aria-invalid')) {
      setHint(format(messages.embedSupported, { providers: providers() }), false)
    }
  })
  submit.addEventListener('click', apply)
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
      return
    }
    if (event.key === 'Enter' && event.target === input) {
      event.preventDefault()
      apply()
    }
  })

  return { element, open, close, isOpen }
}
