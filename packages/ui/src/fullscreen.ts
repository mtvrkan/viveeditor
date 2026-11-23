import type { Listen } from './lifecycle.js'

export interface Fullscreen {
  isOpen(): boolean
  toggle(): void
  close(): void
}

let locks = 0
let savedOverflow = ''

function lockPage(): void {
  const { style } = document.documentElement
  if (locks++ === 0) {
    savedOverflow = style.overflow
    style.overflow = 'hidden'
  }
}

function unlockPage(): void {
  if (locks > 0 && --locks === 0) document.documentElement.style.overflow = savedOverflow
}

export function createFullscreen(
  root: HTMLElement,
  listen: Listen,
  onChange: () => void,
  canLeave: (event: KeyboardEvent) => boolean,
): Fullscreen {
  let open = false
  const set = (value: boolean): void => {
    if (value === open) return
    open = value
    root.classList.toggle('ve-fullscreen', value)
    if (value) lockPage()
    else unlockPage()
    onChange()
  }
  listen(
    root,
    'keydown',
    (event) => {
      const keyEvent = event as KeyboardEvent
      if (!open || keyEvent.key !== 'Escape' || keyEvent.isComposing || !canLeave(keyEvent)) return
      event.preventDefault()
      event.stopPropagation()
      set(false)
    },
    true,
  )
  return { isOpen: () => open, toggle: () => set(!open), close: () => set(false) }
}
