import type { Lifecycle, Listen } from './lifecycle.js'
import type { Toolbar } from './toolbar.js'

const NARROW_WIDTH = 560

export interface Layout {
  relayout(force?: boolean): void
  observe(targets: readonly Element[]): void
}

export function createLayout(
  root: HTMLElement,
  toolbar: Toolbar,
  closeOverflow: () => void,
  lifecycle: Lifecycle,
): Layout {
  let laidOutWidth = -1
  const applySize = (width: number): void => {
    if (width === laidOutWidth) return
    laidOutWidth = width
    const narrow = width > 0 && width < NARROW_WIDTH
    root.dataset.size = narrow ? 'narrow' : 'wide'
    toolbar.setNarrow(narrow)
    if (!toolbar.hasOverflow()) closeOverflow()
  }
  const relayout = (force = false): void => {
    if (force) laidOutWidth = -1
    applySize(root.getBoundingClientRect().width)
  }
  return {
    relayout,
    observe: (targets) => {
      if (typeof ResizeObserver !== 'function') return
      const observer = new ResizeObserver((entries) => {
        relayout(entries.some((entry) => entry.target !== root))
      })
      for (const target of targets) observer.observe(target)
      lifecycle.add(() => observer.disconnect())
    },
  }
}

export interface PointerOptions {
  editorDom: HTMLElement
  floating: readonly HTMLElement[]
  listen: Listen
  hideBubble: () => void
  closeFloating: () => void
  schedule: () => void
}

export interface PointerTracking {
  isDragging(): boolean
}

export function trackPointer(options: PointerOptions): PointerTracking {
  const { listen, schedule } = options
  let dragging = false
  listen(options.editorDom, 'pointerdown', () => {
    dragging = true
    options.hideBubble()
  })
  listen(document, 'pointerup', () => {
    if (!dragging) return
    dragging = false
    schedule()
  })
  listen(document, 'pointerdown', (event) => {
    const target = event.target as Node
    const inside = options.floating.some((element) => element.contains(target))
    if (!inside) options.closeFloating()
  })
  listen(window, 'scroll', schedule, { passive: true, capture: true })
  listen(window, 'resize', schedule)
  return { isDragging: () => dragging }
}
