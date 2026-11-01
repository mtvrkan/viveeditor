import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { EditorView, NodeView, ViewMutationRecord } from 'prosemirror-view'
import { cleanImage, type ImageSourcePolicy } from './source.js'

export interface ImageViewSettings {
  policy: ImageSourcePolicy
  requireAlt: 'off' | 'warn' | 'block'
  missingAltLabel: string
}

const MIN_WIDTH = 24

export function contentWidth(view: EditorView): number {
  const style = getComputedStyle(view.dom)
  const padding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight)
  return Math.max(0, view.dom.clientWidth - (Number.isFinite(padding) ? padding : 0))
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
  private readonly handle: HTMLElement
  private readonly badge: HTMLElement
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
    this.handle = document.createElement('span')
    this.handle.className = 'vive-image-resize'
    this.handle.setAttribute('aria-hidden', 'true')
    this.badge = document.createElement('span')
    this.badge.className = 'vive-image-alt'
    this.badge.textContent = settings.missingAltLabel
    this.dom.append(this.image, this.handle, this.badge)
    this.handle.addEventListener('pointerdown', this.startResize)
    this.render()
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    this.render()
    return true
  }

  stopEvent(event: Event): boolean {
    return event.target === this.handle
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return mutation.type !== 'selection'
  }

  destroy(): void {
    this.release?.()
    this.handle.removeEventListener('pointerdown', this.startResize)
  }

  private render(): void {
    setImageElement(this.image, imageAttributes(this.node.attrs, this.settings.policy))
    const missing = this.settings.requireAlt !== 'off' && this.node.attrs.alt === null
    this.badge.hidden = !missing
    this.dom.classList.toggle('is-missing-alt', missing)
  }

  private readonly startResize = (event: PointerEvent): void => {
    if (!this.view.editable || event.button !== 0) return
    event.preventDefault()
    const direction = getComputedStyle(this.dom).direction === 'rtl' ? -1 : 1
    const startX = event.clientX
    const initial = this.image.getBoundingClientRect().width
    const limit = contentWidth(this.view) || Number.POSITIVE_INFINITY
    let width = initial
    const move = (moveEvent: PointerEvent): void => {
      width = Math.round(
        Math.min(limit, Math.max(MIN_WIDTH, initial + (moveEvent.clientX - startX) * direction)),
      )
      this.image.style.width = `${width}px`
    }
    const finish = (commit: boolean): void => {
      this.release?.()
      if (commit && width !== initial) this.commit(width)
    }
    const up = (): void => finish(true)
    const cancel = (): void => finish(false)
    this.handle.setPointerCapture?.(event.pointerId)
    this.handle.addEventListener('pointermove', move)
    this.handle.addEventListener('pointerup', up)
    this.handle.addEventListener('pointercancel', cancel)
    this.dom.classList.add('is-resizing')
    this.release = () => {
      this.handle.removeEventListener('pointermove', move)
      this.handle.removeEventListener('pointerup', up)
      this.handle.removeEventListener('pointercancel', cancel)
      this.dom.classList.remove('is-resizing')
      this.image.style.removeProperty('width')
      this.release = null
    }
  }

  private commit(width: number): void {
    const pos = this.getPos()
    if (pos === undefined) return
    const attrs = this.node.attrs as { width: number | null; height: number | null }
    const natural = this.image.naturalWidth
      ? { width: this.image.naturalWidth, height: this.image.naturalHeight }
      : attrs
    const height = scaledHeight(width, attrs.width && attrs.height ? attrs : natural)
    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(pos, undefined, { ...this.node.attrs, width, height }),
    )
  }
}
