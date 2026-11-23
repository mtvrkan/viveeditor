import { isAllowedUrl } from '@viveeditor/core'
import type { CommandAccess } from './commands.js'
import { cropBlocker } from './crop.js'
import { h, uniqueId } from './dom.js'
import { icon } from './icons.js'
import { normalizeHref } from './link-panel.js'
import type { MessageKey, Messages } from './messages.js'
import type { Popover } from './popover.js'

export interface ImagePanelOptions {
  commands: CommandAccess
  messages: Messages
  place: (element: HTMLElement, anchor: HTMLElement) => void
  returnToEditor: () => void
  onClose: () => void
  openCrop?: (anchor: HTMLElement) => void
}

interface SelectedImage {
  alt: string | null
  width?: number | null
  height?: number | null
  caption?: string | null
  align?: string | null
  href?: string | null
}

const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/avif'
const SCALES = [25, 50, 75, 100] as const
const ALIGNS: readonly { value: string | null; label: MessageKey }[] = [
  { value: null, label: 'imageAlignNone' },
  { value: 'left', label: 'imageAlignLeft' },
  { value: 'center', label: 'imageAlignCenter' },
  { value: 'right', label: 'imageAlignRight' },
]

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
  const caption = h('input', {
    id: `${id}-caption`,
    class: 've-input',
    type: 'text',
    autocomplete: 'off',
  })
  const linkHintId = `${id}-link-hint`
  const link = h('input', {
    id: `${id}-link`,
    class: 've-input',
    type: 'text',
    inputmode: 'url',
    autocomplete: 'url',
    spellcheck: 'false',
    placeholder: 'https://',
    'aria-describedby': linkHintId,
  })
  const linkHint = h('p', { id: linkHintId, class: 've-hint' })
  const linkBlock = h('div', { class: 've-image-link' }, [
    h('label', { class: 've-eyebrow', for: `${id}-link` }, [messages.imageLink]),
    link,
    linkHint,
  ])
  const alignButtons = ALIGNS.map((option) => {
    const button = h('button', { type: 'button', class: 've-quiet', 'aria-pressed': 'false' }, [
      messages[option.label],
    ])
    button.addEventListener('click', () => {
      commands.run('setImageAttributes', { align: option.value })
      markAlign(option.value)
      keepFocus()
    })
    return { option, button }
  })
  const aligns = h(
    'div',
    { class: 've-image-sizes', role: 'group', 'aria-label': messages.imageAlign },
    [
      h('span', { class: 've-eyebrow', 'aria-hidden': 'true' }, [messages.imageAlign]),
      h(
        'div',
        { class: 've-image-scale' },
        alignButtons.map((entry) => entry.button),
      ),
    ],
  )
  const dimension = (name: 'width' | 'height'): HTMLInputElement =>
    h('input', {
      id: `${id}-${name}`,
      class: 've-input',
      type: 'number',
      inputmode: 'numeric',
      min: '16',
      step: '1',
      autocomplete: 'off',
      placeholder: messages.imageSizeAuto,
    })
  const width = dimension('width')
  const height = dimension('height')
  const keepRatio = h('input', { id: `${id}-ratio`, type: 'checkbox', checked: '' })
  const resetSize = h('button', { type: 'button', class: 've-quiet' }, [messages.imageResetSize])
  const cropHintId = `${id}-crop-hint`
  const crop = h('button', { type: 'button', class: 've-quiet', 'aria-describedby': cropHintId }, [
    messages.imageCrop,
  ])
  const cropHint = h('p', { id: cropHintId, class: 've-hint' })
  const dimensions = h('div', { class: 've-image-dimensions' }, [
    h('div', { class: 've-field-row' }, [
      h('label', { class: 've-image-dimension' }, [
        h('span', { class: 've-eyebrow' }, [messages.imageWidth]),
        width,
      ]),
      h('label', { class: 've-image-dimension' }, [
        h('span', { class: 've-eyebrow' }, [messages.imageHeight]),
        height,
      ]),
    ]),
    h('label', { class: 've-checkbox', for: `${id}-ratio` }, [keepRatio, messages.imageKeepRatio]),
    h('div', { class: 've-image-edit-row' }, [resetSize, crop]),
    cropHint,
  ])
  const scaleButtons = SCALES.map((percent) => {
    const button = h('button', { type: 'button', class: 've-quiet' }, [`${percent}%`])
    button.addEventListener('click', () => {
      commands.run('scaleImage', percent)
      syncSize()
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
      dimensions,
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
      h('label', { class: 've-eyebrow', for: `${id}-caption` }, [messages.imageCaption]),
      caption,
      linkBlock,
      aligns,
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

  const syncSize = (): void => {
    const selected = commands.query('selectedImage')
    const current = isSelectedImage(selected) ? selected : null
    width.value = current?.width ? String(current.width) : ''
    height.value = current?.height ? String(current.height) : ''
  }

  const fieldValue = (input: HTMLInputElement): number | null => {
    const value = Number(input.value)
    return input.value.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null
  }

  const previewRatio = (from: HTMLInputElement, to: HTMLInputElement): void => {
    const selected = commands.query('selectedImage')
    const value = fieldValue(from)
    if (!keepRatio.checked || !isSelectedImage(selected) || value === null) return
    if (!selected.width || !selected.height) return
    const ratio =
      from === width ? selected.height / selected.width : selected.width / selected.height
    to.value = String(Math.round(value * ratio))
  }

  const applySize = (from: HTMLInputElement): void => {
    const value = fieldValue(from)
    if (value === null) {
      syncSize()
      return
    }
    const change = keepRatio.checked
      ? { [from === width ? 'width' : 'height']: value }
      : { width: fieldValue(width), height: fieldValue(height) }
    commands.run('resizeImage', change, keepRatio.checked)
    syncSize()
  }

  const syncCrop = (): void => {
    const blocked = cropBlocker(commands.query('imageReplaceMode'), true)
    crop.disabled = blocked !== null
    cropHint.textContent = blocked ? messages[blocked] : ''
  }

  const markAlign = (value: string | null): void => {
    for (const { option, button } of alignButtons) {
      button.setAttribute('aria-pressed', String(option.value === value))
    }
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

  const validateLink = (): boolean => {
    linkHint.replaceChildren()
    const href = normalizeHref(link.value)
    if (href === '') {
      link.removeAttribute('aria-invalid')
      linkHint.dataset.tone = ''
      return true
    }
    const allowed = isAllowedUrl(href)
    if (allowed) link.removeAttribute('aria-invalid')
    else link.setAttribute('aria-invalid', 'true')
    linkHint.append(
      icon(allowed ? 'check' : 'alert'),
      allowed ? messages.linkSafe : messages.linkUnsafe,
    )
    linkHint.dataset.tone = allowed ? 'ok' : 'error'
    return allowed
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
      if (!validateLink()) {
        link.focus()
        return
      }
      commands.run('setImageAttributes', { alt: altValue(), caption: caption.value })
      const href = normalizeHref(link.value)
      commands.run('setImageLink', href === '' ? null : href)
      finish()
      return
    }
    const attributes = { src: url.value.trim(), alt: altValue(), caption: caption.value }
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
    dimensions.hidden = !editing || !commands.has('resizeImage')
    crop.hidden = !options.openCrop || !commands.has('replaceImage')
    keepRatio.checked = true
    syncSize()
    syncCrop()
    aligns.hidden = !editing
    linkBlock.hidden = !editing || !commands.has('setImageLink')
    link.value = (isSelectedImage(selected) ? selected.href : null) ?? ''
    validateLink()
    submit.textContent = editing ? messages.imageApply : messages.imageAdd
    url.value = ''
    const current = isSelectedImage(selected) ? selected.alt : null
    caption.value = (isSelectedImage(selected) ? selected.caption : null) ?? ''
    markAlign((isSelectedImage(selected) ? selected.align : null) ?? null)
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
  for (const [from, to] of [
    [width, height],
    [height, width],
  ] as const) {
    from.addEventListener('input', () => previewRatio(from, to))
    from.addEventListener('change', () => applySize(from))
  }
  resetSize.addEventListener('click', () => {
    commands.run('resetImageSize')
    syncSize()
    keepFocus()
  })
  crop.addEventListener('click', () => {
    const target = anchor
    if (!target || !options.openCrop) return
    close(false)
    options.openCrop(target)
  })
  decorative.addEventListener('change', syncDecorative)
  url.addEventListener('input', () => setHint(''))
  link.addEventListener('input', validateLink)
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
      if (event.target === width || event.target === height) {
        applySize(event.target)
        return
      }
      apply()
    }
  })

  return { element, open, close, isOpen }
}
