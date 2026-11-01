import type { CommandAccess } from './commands.js'
import { h, uniqueId } from './dom.js'
import { icon } from './icons.js'
import type { Messages } from './messages.js'
import type { Popover } from './popover.js'

export interface ImagePanelOptions {
  commands: CommandAccess
  messages: Messages
  place: (element: HTMLElement, anchor: HTMLElement) => void
  returnToEditor: () => void
  onClose: () => void
}

interface SelectedImage {
  alt: string | null
}

const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/avif'
const SCALES = [25, 50, 75, 100] as const

const isSelectedImage = (value: unknown): value is SelectedImage =>
  typeof value === 'object' && value !== null && 'alt' in value

export function createImagePanel(options: ImagePanelOptions): Popover {
  const { commands, messages } = options
  const id = uniqueId('ve-image')
  const hintId = `${id}-hint`
  const altHintId = `${id}-alt-hint`
  const file = h('input', { type: 'file', accept: ACCEPT, multiple: '', hidden: '' })
  const choose = h('button', { type: 'button', class: 've-primary ve-image-choose' }, [
    icon('upload'),
    messages.imageUpload,
  ])
  const upload = h('div', { class: 've-image-upload-row' }, [
    choose,
    h('p', { class: 've-hint' }, [messages.imageDropHint]),
    file,
  ])
  const url = h('input', {
    id: `${id}-url`,
    class: 've-input',
    type: 'text',
    inputmode: 'url',
    autocomplete: 'url',
    spellcheck: 'false',
    placeholder: 'https://',
    'aria-describedby': hintId,
  })
  const urlBlock = h('div', { class: 've-image-url' }, [
    h('label', { class: 've-eyebrow', for: `${id}-url` }, [messages.imageUrl]),
    url,
  ])
  const alt = h('input', {
    id: `${id}-alt`,
    class: 've-input',
    type: 'text',
    autocomplete: 'off',
    'aria-describedby': altHintId,
  })
  const decorative = h('input', { id: `${id}-decorative`, type: 'checkbox' })
  const scaleButtons = SCALES.map((percent) => {
    const button = h('button', { type: 'button', class: 've-quiet' }, [`${percent}%`])
    button.addEventListener('click', () => {
      commands.run('scaleImage', percent)
      keepFocus()
    })
    return button
  })
  const sizes = h(
    'div',
    { class: 've-image-sizes', role: 'group', 'aria-label': messages.imageSize },
    [
      h('span', { class: 've-eyebrow', 'aria-hidden': 'true' }, [messages.imageSize]),
      h('div', { class: 've-image-scale' }, scaleButtons),
    ],
  )
  const submit = h('button', { type: 'button', class: 've-primary' }, [messages.imageAdd])
  const hint = h('p', { id: hintId, class: 've-hint', 'aria-live': 'polite' })
  const title = h('div', { class: 've-eyebrow ve-image-title', 'aria-hidden': 'true' })
  const element = h(
    'div',
    { class: 've-panel ve-image-panel ve-glass ve-solid', role: 'dialog', hidden: '' },
    [
      title,
      upload,
      urlBlock,
      h('label', { class: 've-eyebrow', for: `${id}-alt` }, [messages.imageAlt]),
      alt,
      h('p', { id: altHintId, class: 've-hint' }, [messages.imageAltHint]),
      h('label', { class: 've-checkbox', for: `${id}-decorative` }, [
        decorative,
        messages.imageDecorative,
      ]),
      sizes,
      hint,
      h('div', { class: 've-image-actions' }, [submit]),
    ],
  )
  let editing = false
  let anchor: HTMLElement | null = null

  const keepFocus = (): void => {
    if (!element.contains(document.activeElement)) alt.focus()
  }

  const altValue = (): string | null =>
    decorative.checked ? '' : alt.value.trim() === '' ? null : alt.value

  const syncDecorative = (): void => {
    alt.disabled = decorative.checked
    if (decorative.checked) alt.value = ''
  }

  const setHint = (text: string): void => {
    hint.replaceChildren(...(text ? [icon('alert'), text] : []))
    hint.dataset.tone = text ? 'error' : ''
    if (text) url.setAttribute('aria-invalid', 'true')
    else url.removeAttribute('aria-invalid')
  }

  const isOpen = (): boolean => !element.hidden

  const close = (returnFocus: boolean): void => {
    if (!isOpen()) return
    element.hidden = true
    anchor?.setAttribute('aria-expanded', 'false')
    options.onClose()
    if (returnFocus) anchor?.focus()
  }

  const finish = (): void => {
    close(false)
    options.returnToEditor()
  }

  const apply = (): void => {
    if (editing) {
      commands.run('setImageAttributes', { alt: altValue() })
      finish()
      return
    }
    const attributes = { src: url.value.trim(), alt: altValue() }
    if (!commands.can('insertImage', attributes)) {
      setHint(url.value.trim() === '' ? messages.imageNeedsUrl : messages.imageUnsafe)
      url.focus()
      return
    }
    commands.run('insertImage', attributes)
    finish()
  }

  const open = (target: HTMLElement): void => {
    anchor = target
    const selected = commands.query('selectedImage')
    editing = isSelectedImage(selected)
    const label = editing ? messages.image : messages.imageInsert
    title.textContent = label
    element.setAttribute('aria-label', label)
    upload.hidden = editing || !commands.can('uploadImages', [])
    urlBlock.hidden = editing
    sizes.hidden = !editing || !commands.can('scaleImage', 100)
    submit.textContent = editing ? messages.imageApply : messages.imageAdd
    url.value = ''
    const current = isSelectedImage(selected) ? selected.alt : null
    decorative.checked = current === ''
    alt.value = current ?? ''
    syncDecorative()
    setHint('')
    element.hidden = false
    target.setAttribute('aria-expanded', 'true')
    options.place(element, target)
    if (editing) (alt.disabled ? decorative : alt).focus()
    else if (!upload.hidden) choose.focus()
    else url.focus()
  }

  choose.addEventListener('click', () => file.click())
  file.addEventListener('change', () => {
    const files = Array.from(file.files ?? [])
    file.value = ''
    if (files.length === 0) return
    finish()
    commands.run('uploadImages', files)
  })
  decorative.addEventListener('change', syncDecorative)
  url.addEventListener('input', () => setHint(''))
  submit.addEventListener('click', apply)
  element.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
      return
    }
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
      if (event.target.type === 'checkbox') return
      event.preventDefault()
      apply()
    }
  })

  return { element, open, close, isOpen }
}
