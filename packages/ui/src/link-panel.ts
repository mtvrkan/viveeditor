import { type Editor, isAllowedUrl } from '@viveeditor/core'
import type { CommandAccess } from './commands.js'
import { h, uniqueId } from './dom.js'
import { icon } from './icons.js'
import type { Messages } from './messages.js'

export interface LinkPanel {
  readonly element: HTMLElement
  open(returnTo: HTMLElement | null): void
  close(returnFocus: boolean): void
  isOpen(): boolean
}

export interface LinkPanelOptions {
  editor: Editor
  commands: CommandAccess
  messages: Messages
  place: (element: HTMLElement) => void
  onClose: () => void
}

const SCHEME = /^[a-z][a-z\d+.-]*:/i
const EMAIL = /^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]+$/u
const DOMAIN = /^(?:www\.)?[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+(?:[/?#:]|$)/u

export function normalizeHref(value: string): string {
  const trimmed = value.trim()
  if (trimmed === '' || SCHEME.test(trimmed)) return trimmed
  if (EMAIL.test(trimmed)) return `mailto:${trimmed}`
  if (DOMAIN.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

export function createLinkPanel(options: LinkPanelOptions): LinkPanel {
  const { editor, commands, messages } = options
  const inputId = uniqueId('ve-link')
  const hintId = `${inputId}-hint`
  const input = h('input', {
    id: inputId,
    class: 've-input',
    type: 'text',
    inputmode: 'url',
    autocomplete: 'url',
    spellcheck: 'false',
    placeholder: 'https://',
    'aria-describedby': hintId,
  })
  const apply = h('button', { type: 'button', class: 've-primary' }, [messages.linkApply])
  const remove = h(
    'button',
    { type: 'button', class: 've-btn ve-unlink', 'aria-label': messages.linkRemove },
    [icon('unlink')],
  )
  const hint = h('p', { id: hintId, class: 've-hint', 'aria-live': 'polite' })
  const element = h(
    'div',
    {
      class: 've-panel ve-link ve-glass ve-solid',
      role: 'dialog',
      'aria-label': messages.linkDialog,
      hidden: '',
    },
    [
      h('label', { class: 've-eyebrow', for: inputId }, [messages.linkLabel]),
      h('div', { class: 've-field-row' }, [input, apply, remove]),
      hint,
    ],
  )
  let returnTarget: HTMLElement | null = null

  const setHint = (text: string, tone: 'ok' | 'error' | 'info' | ''): void => {
    hint.replaceChildren()
    if (tone === 'ok') hint.append(icon('check'))
    if (tone === 'error') hint.append(icon('alert'))
    if (text) hint.append(text)
    hint.dataset.tone = tone
  }

  const validate = (): boolean => {
    const href = normalizeHref(input.value)
    if (href === '') {
      input.removeAttribute('aria-invalid')
      setHint('', '')
      return false
    }
    const allowed = isAllowedUrl(href)
    if (allowed) input.removeAttribute('aria-invalid')
    else input.setAttribute('aria-invalid', 'true')
    setHint(allowed ? messages.linkSafe : messages.linkUnsafe, allowed ? 'ok' : 'error')
    return allowed
  }

  const isOpen = (): boolean => !element.hidden

  const close = (returnFocus: boolean): void => {
    if (!isOpen()) return
    element.hidden = true
    options.onClose()
    if (!returnFocus) return
    if (returnTarget && returnTarget !== editor.dom) returnTarget.focus()
    else editor.focus()
  }

  const submit = (): void => {
    if (!validate()) {
      input.focus()
      return
    }
    commands.run('setLink', { href: normalizeHref(input.value) })
    close(false)
    editor.focus()
  }

  const open = (returnTo: HTMLElement | null): void => {
    returnTarget = returnTo
    const current = editor.getAttributes('link').href
    const linked = editor.isActive('link')
    const canLink = linked || commands.can('setLink', { href: 'https://example.com' })
    input.value = typeof current === 'string' ? current : ''
    input.disabled = !canLink
    apply.disabled = !canLink
    remove.hidden = !linked
    element.hidden = false
    options.place(element)
    if (canLink) {
      validate()
      input.focus()
      input.select()
    } else {
      setHint(messages.linkNeedsSelection, 'info')
      element.tabIndex = -1
      element.focus()
    }
  }

  input.addEventListener('input', validate)
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      submit()
    }
  })
  apply.addEventListener('click', submit)
  remove.addEventListener('click', () => {
    commands.run('unsetLink')
    close(false)
    editor.focus()
  })
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    close(true)
  })

  return { element, open, close, isOpen }
}
