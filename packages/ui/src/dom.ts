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
const MIN_ROOM = 160

function visibleBand(): { top: number; bottom: number } {
  const viewport = window.visualViewport
  if (!viewport) return { top: 0, bottom: window.innerHeight }
  return { top: viewport.offsetTop, bottom: viewport.offsetTop + viewport.height }
}

interface Docked {
  anchor: HTMLElement
  dock: HTMLElement
  spot: string
}

const docked = new Map<HTMLElement, Docked>()

const spotOf = (anchor: HTMLElement): string => {
  const rect = anchor.getBoundingClientRect()
  const band = visibleBand()
  return `${rect.left},${rect.top},${rect.bottom},${band.top},${band.bottom}`
}

export function replaceDocked(): void {
  for (const [panel, { anchor, dock, spot }] of docked) {
    if (!panel.isConnected || !anchor.isConnected) docked.delete(panel)
    else if (!panel.hidden && spotOf(anchor) !== spot) placeInDock(panel, anchor, dock)
  }
}

export function placeInDock(panel: HTMLElement, anchor: HTMLElement, dock: HTMLElement): void {
  docked.set(panel, { anchor, dock, spot: spotOf(anchor) })
  panel.style.maxHeight = ''
  const dockRect = dock.getBoundingClientRect()
  const anchorRect = anchor.getBoundingClientRect()
  const center = anchorRect.left + anchorRect.width / 2 - dockRect.left
  const width = panel.offsetWidth
  const right = Math.min(dockRect.width, document.documentElement.clientWidth - dockRect.left)
  const left = Math.max(EDGE, EDGE - dockRect.left)
  panel.style.left = `${clamp(center - width / 2, left, right - width - EDGE)}px`
  const band = visibleBand()
  const above = anchorRect.top - band.top - GAP - EDGE
  const below = band.bottom - anchorRect.bottom - GAP - EDGE
  const flip = panel.offsetHeight > above && below > above
  panel.classList.toggle('ve-below', flip)
  const room = flip ? below : above
  if (panel.offsetHeight > room) panel.style.maxHeight = `${Math.floor(Math.max(room, MIN_ROOM))}px`
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
