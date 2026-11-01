import type { EditorRect } from '@viveeditor/core'

type Child = Node | string | null | undefined | false

export function h<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  attributes: Record<string, string> = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[Tag] {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
  for (const child of children) if (child) element.append(child)
  return element
}

let sequence = 0

export function uniqueId(prefix: string): string {
  sequence += 1
  return `${prefix}-${sequence}`
}

export function clamp(value: number, min: number, max: number): number {
  return max < min ? min : Math.min(max, Math.max(min, value))
}

const GAP = 10
const EDGE = 8

export function placeInDock(panel: HTMLElement, anchor: HTMLElement, dock: HTMLElement): void {
  panel.style.maxHeight = ''
  const dockRect = dock.getBoundingClientRect()
  const anchorRect = anchor.getBoundingClientRect()
  const center = anchorRect.left + anchorRect.width / 2 - dockRect.left
  const width = panel.offsetWidth
  panel.style.left = `${clamp(center - width / 2, EDGE, dockRect.width - width - EDGE)}px`
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight
  const above = anchorRect.top - GAP - EDGE
  const below = viewportHeight - anchorRect.bottom - GAP - EDGE
  const flip = panel.offsetHeight > above && below > above
  panel.classList.toggle('ve-below', flip)
  const room = flip ? below : above
  if (room > 0 && panel.offsetHeight > room) panel.style.maxHeight = `${Math.floor(room)}px`
}

export function placeAtRect(
  panel: HTMLElement,
  rect: EditorRect,
  root: HTMLElement,
  mode: 'above' | 'below' | 'caret',
): void {
  const rootRect = root.getBoundingClientRect()
  const width = panel.offsetWidth
  const height = panel.offsetHeight
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight
  const left =
    mode === 'caret'
      ? rect.left - rootRect.left - 12
      : (rect.left + rect.right) / 2 - rootRect.left - width / 2
  const fitsAbove = rect.top - height - GAP >= 0
  const fitsBelow = rect.bottom + height + GAP <= viewportHeight
  const above = mode === 'above' ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove
  const top = above ? rect.top - rootRect.top - height - GAP : rect.bottom - rootRect.top + GAP
  panel.style.left = `${clamp(left, EDGE, rootRect.width - width - EDGE)}px`
  panel.style.top = `${top}px`
}

export function matches(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false
}

export function moveFocus(items: readonly HTMLElement[], current: number, key: string): number {
  if (items.length === 0) return -1
  if (key === 'Home') return 0
  if (key === 'End') return items.length - 1
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1
  return (current + step + items.length) % items.length
}
