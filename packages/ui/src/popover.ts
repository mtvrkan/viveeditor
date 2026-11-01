import type { MessageKey } from './messages.js'

export interface Swatch {
  color: string | null
  value: string
  name: MessageKey
}

export interface Popover {
  readonly element: HTMLElement
  open(anchor: HTMLElement): void
  close(returnFocus: boolean): void
  isOpen(): boolean
}
