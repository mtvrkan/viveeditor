import type { CommandAccess } from './commands.js'
import {
  CROP_HANDLES,
  type CropBounds,
  type CropHandle,
  type CropRect,
  cropBlocker,
  croppedSize,
  cropType,
  exportCrop,
  fitAspect,
  loadCropImage,
  moveRect,
  resizeRect,
  roundRect,
} from './crop.js'
import { h, uniqueId } from './dom.js'
import { icon } from './icons.js'
import type { MessageKey, Messages } from './messages.js'
import type { Popover } from './popover.js'

export interface CropDialogOptions {
  commands: CommandAccess
  messages: Messages
  returnToEditor: () => void
  onClose: () => void
}

type Aspect = number | 'original' | null

const ASPECTS: readonly { value: Aspect; label: MessageKey | string }[] = [
  { value: null, label: 'imageCropFree' },
  { value: 1, label: '1:1' },
  { value: 4 / 3, label: '4:3' },
  { value: 16 / 9, label: '16:9' },
  { value: 'original', label: 'imageCropOriginal' },
]

const ARROWS: Readonly<Record<string, [number, number]>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

const record = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null

export function createCropDialog(options: CropDialogOptions): Popover {
  const { commands, messages } = options
  const id = uniqueId('ve-crop')
  const label = (key: MessageKey | string): string =>
    key in messages ? messages[key as MessageKey] : key
  const status = h('p', { class: 've-hint', role: 'status' })
  const live = h('span', { class: 've-sr', 'aria-live': 'polite' })
  const size = h('span', { class: 've-crop-size', 'aria-hidden': 'true' })
  const handles = CROP_HANDLES.map((handle) =>
    h('span', { class: 've-crop-handle', 'data-handle': handle }),
  )
  const frame = h(
    'div',
    {
      class: 've-crop-frame',
      role: 'group',
      tabindex: '0',
      'aria-label': messages.imageCropArea,
      'aria-describedby': `${id}-help`,
    },
    [...handles, size],
  )
  const shade = h('div', { class: 've-crop-shade', 'aria-hidden': 'true' })
  const stage = h('div', { class: 've-crop-stage', hidden: '' }, [
    h('div', { class: 've-crop-clip' }, [shade]),
    frame,
  ])
  const aspectButtons = ASPECTS.map((aspect) => {
    const button = h('button', { type: 'button', class: 've-quiet', 'aria-pressed': 'false' }, [
      label(aspect.label),
    ])
    button.addEventListener('click', () => setAspect(aspect.value))
    return { aspect, button }
  })
  const aspects = h(
    'div',
    { class: 've-crop-aspects', role: 'group', 'aria-label': messages.imageCropAspect },
    aspectButtons.map((entry) => entry.button),
  )
  const cancel = h('button', { type: 'button', class: 've-quiet' }, [messages.imageCropCancel])
  const apply = h('button', { type: 'button', class: 've-primary', disabled: '' }, [
    messages.imageApply,
  ])
  const element = h('dialog', { class: 've-crop ve-solid', 'aria-labelledby': `${id}-title` }, [
    h('h2', { id: `${id}-title`, class: 've-crop-title' }, [messages.imageCropTitle]),
    stage,
    status,
    h('p', { id: `${id}-help`, class: 've-hint ve-crop-help' }, [messages.imageCropHelp]),
    aspects,
    h('div', { class: 've-crop-actions' }, [cancel, apply]),
    live,
  ])
  let image: HTMLImageElement | null = null
  let source = ''
  let stored: Record<string, unknown> = {}
  let natural: CropBounds = { width: 1, height: 1 }
  let rect: CropRect = { x: 0, y: 0, width: 1, height: 1 }
  let aspect: number | null = null
  let token = 0
  let anchor: HTMLElement | null = null

  const isOpen = (): boolean => element.open || element.hasAttribute('open')

  const setStatus = (key: MessageKey | null, tone = 'error'): void => {
    status.replaceChildren(...(key ? [tone === 'error' ? icon('alert') : '', messages[key]] : []))
    status.dataset.tone = key ? tone : ''
  }

  const render = (): void => {
    const percent = (value: number, total: number): string => `${(value / total) * 100}%`
    for (const target of [frame, shade]) {
      target.style.left = percent(rect.x, natural.width)
      target.style.top = percent(rect.y, natural.height)
      target.style.width = percent(rect.width, natural.width)
      target.style.height = percent(rect.height, natural.height)
    }
    const region = roundRect(rect, natural)
    size.textContent = `${region.width} × ${region.height}`
  }

  const announce = (): void => {
    live.textContent = size.textContent ?? ''
  }

  const setAspect = (value: Aspect): void => {
    aspect = value === 'original' ? natural.width / natural.height : value
    for (const { aspect: option, button } of aspectButtons) {
      button.setAttribute('aria-pressed', String(option.value === value))
    }
    rect = fitAspect(aspect, natural, rect)
    render()
  }

  const close = (returnFocus: boolean): void => {
    if (!isOpen()) return
    token++
    if (element.open && typeof element.close === 'function') element.close()
    element.removeAttribute('open')
    anchor?.setAttribute('aria-expanded', 'false')
    image?.remove()
    image = null
    options.onClose()
    if (returnFocus) options.returnToEditor()
  }

  const show = (loaded: HTMLImageElement): void => {
    image = loaded
    image.className = 've-crop-image'
    image.alt = ''
    image.draggable = false
    stage.prepend(image)
    natural = { width: loaded.naturalWidth || 1, height: loaded.naturalHeight || 1 }
    rect = { x: 0, y: 0, ...natural }
    stage.hidden = false
    apply.disabled = false
    setStatus(null)
    setAspect(null)
    frame.focus()
  }

  const open = (target: HTMLElement): void => {
    const selected = record(commands.query('selectedImage'))
    if (!selected || typeof selected.src !== 'string') return
    anchor = target
    stored = selected
    source = selected.src
    const current = ++token
    stage.hidden = true
    apply.disabled = true
    image?.remove()
    image = null
    if (typeof element.showModal === 'function') element.showModal()
    else element.setAttribute('open', '')
    target.setAttribute('aria-expanded', 'true')
    const blocked = cropBlocker(commands.query('imageReplaceMode'), true)
    if (blocked) {
      setStatus(blocked)
      cancel.focus()
      return
    }
    setStatus('imageCropLoading', 'info')
    cancel.focus()
    void loadCropImage(source).then((loaded) => {
      if (current !== token) return
      if (loaded) show(loaded)
      else setStatus(cropBlocker('upload', false))
    })
  }

  const finish = async (): Promise<void> => {
    if (!image) return
    const region = roundRect(rect, natural)
    apply.disabled = true
    const blob = await exportCrop(image, region, cropType(source))
    if (!isOpen()) return
    if (!blob) {
      setStatus('imageCropBlocked')
      return
    }
    const extension = blob.type.split('/')[1] ?? 'png'
    const file = new File([blob], `crop.${extension === 'jpeg' ? 'jpg' : extension}`, {
      type: blob.type || 'image/png',
    })
    commands.run('replaceImage', file, croppedSize(region, natural, stored))
    close(true)
  }

  const drag = (event: PointerEvent): void => {
    if (!image || event.button !== 0) return
    const target = event.target instanceof HTMLElement ? event.target : null
    const handle = target?.dataset.handle as CropHandle | undefined
    if (!handle && target !== frame && target !== size) return
    event.preventDefault()
    frame.focus()
    const start = rect
    const scale = image.clientWidth / natural.width || 1
    const startX = event.clientX
    const startY = event.clientY
    const capture = target ?? frame
    const move = (moveEvent: PointerEvent): void => {
      const dx = (moveEvent.clientX - startX) / scale
      const dy = (moveEvent.clientY - startY) / scale
      rect = handle
        ? resizeRect(start, handle, dx, dy, aspect, natural)
        : moveRect(start, dx, dy, natural)
      render()
    }
    const stop = (): void => {
      capture.removeEventListener('pointermove', move)
      capture.removeEventListener('pointerup', stop)
      capture.removeEventListener('pointercancel', stop)
      announce()
    }
    capture.addEventListener('pointermove', move)
    capture.addEventListener('pointerup', stop)
    capture.addEventListener('pointercancel', stop)
    try {
      capture.setPointerCapture(event.pointerId)
    } catch {
      return
    }
  }

  frame.addEventListener('pointerdown', drag)
  frame.addEventListener('keydown', (event) => {
    const arrow = ARROWS[event.key]
    if (!arrow || !image) return
    event.preventDefault()
    event.stopPropagation()
    const step = Math.max(1, Math.round(natural.width / 100))
    const [x, y] = arrow
    rect = event.shiftKey
      ? resizeRect(rect, x === 0 ? 's' : 'e', x * step, y * step, aspect, natural)
      : moveRect(rect, x * step, y * step, natural)
    render()
    announce()
  })
  cancel.addEventListener('click', () => close(true))
  apply.addEventListener('click', () => void finish())
  element.addEventListener('cancel', (event) => {
    event.preventDefault()
    close(true)
  })
  element.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    close(true)
  })
  return { element, open, close, isOpen }
}
