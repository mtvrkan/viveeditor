import { h } from './dom.js'
import type { Messages } from './messages.js'
import type { Popover } from './popover.js'

export type PanelKit = typeof import('./panel-kit.js')
export type PanelKitLoader = () => Promise<PanelKit>
export type PanelSource = PanelKit | PanelKitLoader

export interface LazyPopoverOptions {
  messages: Messages
  load: PanelKitLoader
  create: (kit: PanelKit) => Popover
  mount: (element: HTMLElement) => void
  place: (element: HTMLElement, anchor: HTMLElement) => void
  onClose: () => void
  report: (error: unknown) => void
}

export function createLazyPopover(options: LazyPopoverOptions): Popover {
  const { messages } = options
  const text = h('span', {}, [messages.panelLoading])
  const retry = h('button', { type: 'button', class: 've-item ve-retry', hidden: '' }, [
    messages.panelRetry,
  ])
  const placeholder = h(
    'div',
    {
      class: 've-panel ve-loading ve-glass ve-solid',
      role: 'status',
      tabindex: '-1',
      hidden: '',
    },
    [text, retry],
  )
  options.mount(placeholder)
  let real: Popover | null = null
  let anchor: HTMLElement | null = null
  let loading = false

  const isOpen = (): boolean => real?.isOpen() ?? !placeholder.hidden

  const showState = (failed: boolean): void => {
    text.textContent = failed ? messages.panelFailed : messages.panelLoading
    retry.hidden = !failed
  }

  const close = (returnFocus: boolean): void => {
    if (real) {
      real.close(returnFocus)
      return
    }
    if (placeholder.hidden) return
    placeholder.hidden = true
    anchor?.setAttribute('aria-expanded', 'false')
    options.onClose()
    if (returnFocus) anchor?.focus()
  }

  const settle = (kit: PanelKit): void => {
    const created = options.create(kit)
    options.mount(created.element)
    real = created
    placeholder.remove()
    if (!placeholder.hidden && anchor) created.open(anchor)
  }

  const load = (): void => {
    if (loading) return
    loading = true
    showState(false)
    Promise.resolve()
      .then(() => options.load())
      .then(
        (kit) => {
          loading = false
          settle(kit)
        },
        (error: unknown) => {
          loading = false
          options.report(error)
          showState(true)
          if (!placeholder.hidden) retry.focus()
        },
      )
  }

  const open = (target: HTMLElement): void => {
    if (real) {
      real.open(target)
      return
    }
    anchor = target
    placeholder.hidden = false
    target.setAttribute('aria-expanded', 'true')
    options.place(placeholder, target)
    placeholder.focus()
    load()
  }

  retry.addEventListener('click', load)
  placeholder.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    close(true)
  })

  return {
    get element() {
      return real?.element ?? placeholder
    },
    open,
    close,
    isOpen,
  }
}
