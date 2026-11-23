import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { NodeSelection } from 'prosemirror-state'
import type { EditorView, NodeView, ViewMutationRecord } from 'prosemirror-view'
import { clampSize, fitNatural, ratioOf } from './size.js'
import type { ImageSize } from './sniff.js'
import { cleanImage, type ImageSourcePolicy } from './source.js'

export interface ImageViewSettings {
  policy: ImageSourcePolicy
  requireAlt: 'off' | 'warn' | 'block'
  missingAltLabel: string
  resizable: boolean
}

const CORNERS = ['nw', 'ne', 'sw', 'se'] as const

export function contentWidth(view: EditorView): number {
  const style = getComputedStyle(view.dom)
  const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight)
  return Math.max(0, view.dom.clientWidth - (Number.isFinite(padding) ? padding : 0))
}

export function maxImageWidth(view: EditorView, element: Element | null): number {
  const available = contentWidth(view)
  const limit = element ? getComputedStyle(element).maxWidth : ''
  const share = limit.endsWith('%') ? Number.parseFloat(limit) / 100 : 1
  return Math.floor(available * (share > 0 && share < 1 ? share : 1))
}

export function capturePointer(element: Element, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId)
  } catch {
    return
  }
}

export function naturalSize(image: HTMLImageElement | null | undefined): ImageSize | null {
  return image?.naturalWidth ? { width: image.naturalWidth, height: image.naturalHeight } : null
}

export function scaledHeight(
  width: number,
  attrs: { width: number | null; height: number | null },
): number | null {
  return attrs.width && attrs.height ? Math.round((width * attrs.height) / attrs.width) : null
}

export function imageAttributes(
  attrs: Record<string, unknown>,
  policy: ImageSourcePolicy,
): Record<string, string> {
  const clean = cleanImage(attrs, policy)
  const values: Record<string, string | number | null> = {
    src: clean.src,
    alt: clean.alt,
    title: clean.title,
    width: clean.width,
    height: clean.height,
    loading: 'lazy',
    decoding: 'async',
    referrerpolicy: 'no-referrer',
  }
  const result: Record<string, string> = {}
  for (const [name, value] of Object.entries(values)) {
    if (value !== null) result[name] = String(value)
  }
  return result
}

function setImageElement(image: HTMLImageElement, attrs: Record<string, string>): void {
  for (const { name } of [...image.attributes]) {
    if (!(name in attrs)) image.removeAttribute(name)
  }
  for (const [name, value] of Object.entries(attrs)) {
    if (image.getAttribute(name) !== value) image.setAttribute(name, value)
  }
}

export class ImageView implements NodeView {
  readonly dom: HTMLElement
  private readonly image: HTMLImageElement
  private readonly handles: HTMLElement
  private readonly size: HTMLElement
  private readonly badge: HTMLElement
  private readonly caption: HTMLElement
  private release: (() => void) | null = null

  constructor(
    private node: ProseMirrorNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
    private readonly settings: ImageViewSettings,
  ) {
    this.dom = document.createElement('div')
    this.dom.className = 'vive-image'
    this.image = document.createElement('img')
    this.handles = document.createElement('span')
    this.handles.className = 'vive-image-handles'
    this.handles.setAttribute('aria-hidden', 'true')
    for (const corner of CORNERS) {
      const handle = document.createElement('span')
      handle.className =
        corner === 'se' ? 'vive-image-handle vive-image-resize' : 'vive-image-handle'
      handle.dataset.corner = corner
      this.handles.append(handle)
    }
    this.size = document.createElement('span')
    this.size.className = 'vive-image-size'
    this.handles.append(this.size)
    this.badge = document.createElement('span')
    this.badge.className = 'vive-image-alt'
    this.badge.textContent = settings.missingAltLabel
    this.caption = document.createElement('div')
    this.caption.className = 'vive-image-caption'
    const frame = document.createElement('div')
    frame.className = 'vive-image-frame'
    frame.append(this.image, this.badge)
    if (settings.resizable) frame.append(this.handles)
    this.dom.append(frame, this.caption)
    this.handles.addEventListener('pointerdown', this.startResize)
    this.handles.addEventListener('dblclick', this.reset)
    this.image.addEventListener('load', this.showSize)
    this.render()
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    this.render()
    return true
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode')
    this.showSize()
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode')
  }

  stopEvent(event: Event): boolean {
    return event.target instanceof Node && this.handles.contains(event.target)
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return mutation.type !== 'selection'
  }

  destroy(): void {
    this.release?.()
    this.handles.removeEventListener('pointerdown', this.startResize)
    this.handles.removeEventListener('dblclick', this.reset)
    this.image.removeEventListener('load', this.showSize)
  }

  private render(): void {
    setImageElement(this.image, imageAttributes(this.node.attrs, this.settings.policy))
    const { caption, align } = cleanImage(this.node.attrs, this.settings.policy)
    this.caption.textContent = caption
    this.caption.hidden = !caption
    if (align) this.dom.dataset.align = align
    else delete this.dom.dataset.align
    const missing = this.settings.requireAlt !== 'off' && this.node.attrs.alt === null
    this.badge.hidden = !missing
    this.dom.classList.toggle('is-missing-alt', missing)
    this.showSize()
  }

  private readonly showSize = (): void => {
    const rect = this.image.getBoundingClientRect()
    const attrs = this.node.attrs as { width: number | null; height: number | null }
    const size =
      rect.width > 0
        ? { width: rect.width, height: rect.height }
        : attrs.width && attrs.height
          ? attrs
          : naturalSize(this.image)
    this.setSizeLabel(size ? { width: Number(size.width), height: Number(size.height) } : null)
  }

  private setSizeLabel(size: ImageSize | null): void {
    this.size.textContent = size
      ? `${Math.round(size.width)} \u00d7 ${Math.round(size.height)}`
      : ''
  }

  private ratio(rect: DOMRect): number {
    return (
      ratioOf(this.node.attrs as { width: number | null; height: number | null }) ??
      ratioOf(naturalSize(this.image)) ??
      (rect.height > 0 ? rect.width / rect.height : 1)
    )
  }

  private readonly startResize = (event: PointerEvent): void => {
    const handle =
      event.target instanceof HTMLElement ? event.target.closest('[data-corner]') : null
    if (!(handle instanceof HTMLElement) || !this.view.editable || event.button !== 0) return
    event.preventDefault()
    const corner = handle.dataset.corner ?? 'se'
    const spread = this.dom.dataset.align === 'center' ? 2 : 1
    const signX = (corner.endsWith('e') ? 1 : -1) * spread
    const signY = (corner.startsWith('s') ? 1 : -1) * spread
    const rect = this.image.getBoundingClientRect()
    const ratio = this.ratio(rect)
    const limit = maxImageWidth(this.view, this.dom)
    const startX = event.clientX
    const startY = event.clientY
    let size: ImageSize | null = null
    const move = (moveEvent: PointerEvent): void => {
      const dx = (moveEvent.clientX - startX) * signX
      const dy = (moveEvent.clientY - startY) * signY * ratio
      size = clampSize(rect.width + (Math.abs(dx) >= Math.abs(dy) ? dx : dy), ratio, limit)
      this.image.style.width = `${size.width}px`
      this.image.style.height = `${size.height}px`
      this.setSizeLabel(size)
    }
    const finish = (commit: boolean): void => {
      const result = size
      this.release?.()
      if (commit && result && result.width !== Math.round(rect.width)) this.commit(result)
      else this.showSize()
    }
    const up = (): void => finish(true)
    const cancel = (): void => finish(false)
    capturePointer(handle, event.pointerId)
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', cancel)
    this.dom.classList.add('is-resizing')
    this.release = () => {
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', cancel)
      this.dom.classList.remove('is-resizing')
      this.image.style.removeProperty('width')
      this.image.style.removeProperty('height')
      this.release = null
    }
  }

  private readonly reset = (event: MouseEvent): void => {
    event.preventDefault()
    if (!this.view.editable) return
    const natural = naturalSize(this.image)
    this.commit(
      natural
        ? fitNatural(natural, maxImageWidth(this.view, this.dom))
        : { width: null, height: null },
    )
  }

  private commit(size: { width: number | null; height: number | null }): void {
    const pos = this.getPos()
    if (pos === undefined) return
    const transaction = this.view.state.tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      width: size.width,
      height: size.height,
    })
    this.view.dispatch(transaction.setSelection(NodeSelection.create(transaction.doc, pos)))
  }
}
