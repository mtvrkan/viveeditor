import { h, moveFocus } from './dom.js'
import { icon } from './icons.js'
import type { Listen } from './lifecycle.js'
import type { Messages } from './messages.js'
import type { ToolSpec } from './tools.js'

export interface ToolbarOptions {
  messages: Messages
  groups: readonly (readonly ToolSpec[])[]
  createButton: (tool: ToolSpec) => HTMLButtonElement
  blockButton: HTMLButtonElement | null
  listen: Listen
  onEscape: () => void
}

export interface Toolbar {
  readonly pill: HTMLElement
  readonly dock: HTMLElement
  readonly moreButton: HTMLButtonElement
  readonly moreTools: readonly ToolSpec[]
  readonly countButton: HTMLButtonElement
  readonly countText: HTMLElement
  readonly countUnit: HTMLElement
  toolButtons(): HTMLButtonElement[]
  focusTarget(): HTMLButtonElement | undefined
  isCollapsed(id: string): boolean
  hasOverflow(): boolean
  setNarrow(narrow: boolean): void
}

export function createToolbar(options: ToolbarOptions): Toolbar {
  const { messages, listen } = options
  const toolById = new Map(options.groups.flat().map((tool) => [tool.id, tool]))
  const moreButton = h(
    'button',
    { type: 'button', class: 've-btn ve-more', 'aria-label': messages.more, title: messages.more },
    [icon('more')],
  )
  const countText = h('span', { class: 've-count-value' })
  const countUnit = h('span', { class: 've-count-unit' }, [
    messages.words.replace('{count}', '').trim(),
  ])
  const countButton = h(
    'button',
    { type: 'button', class: 've-count', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' },
    [countText, ' ', countUnit],
  )
  const group = (children: readonly Element[], extra = ''): HTMLElement =>
    h('div', { class: `ve-group${extra}` }, children)
  const toolGroups = options.groups
    .filter((list) => list.length > 0)
    .map((list) => group(list.map(options.createButton)))
  const moreGroup = group([moreButton])
  const moreTools = options.groups.flat().filter((tool) => !tool.narrow)
  const pill = h(
    'div',
    { class: 've-pill ve-glass', role: 'toolbar', 'aria-label': messages.toolbar },
    [
      options.blockButton ? group([options.blockButton]) : null,
      ...toolGroups,
      moreGroup,
      group([countButton], ' ve-group-count'),
    ],
  )
  const dock = h('div', { class: 've-dock' }, [pill])
  let rovingIndex = 0

  const items = (): HTMLButtonElement[] =>
    [...pill.querySelectorAll<HTMLButtonElement>('button')].filter(
      (button) => !button.hidden && !button.closest('[hidden]'),
    )

  const syncRoving = (): void => {
    const visible = items()
    rovingIndex = Math.min(rovingIndex, visible.length - 1)
    for (const [index, button] of visible.entries()) {
      button.tabIndex = index === rovingIndex ? 0 : -1
    }
    for (const button of pill.querySelectorAll<HTMLButtonElement>('button')) {
      if (!visible.includes(button)) button.tabIndex = -1
    }
  }

  const toolButtons = (): HTMLButtonElement[] => [
    ...pill.querySelectorAll<HTMLButtonElement>('[data-tool]'),
  ]

  const syncGroups = (): void => {
    for (const element of toolGroups) {
      element.hidden = [...element.children].every((child) => (child as HTMLElement).hidden)
    }
  }

  const overflowing = (): boolean => pill.scrollWidth > pill.clientWidth + 1

  const rankOf = (button: HTMLButtonElement): number | undefined =>
    toolById.get(button.dataset.tool ?? '')?.collapse

  const setNarrow = (narrow: boolean): void => {
    for (const button of toolButtons()) {
      button.hidden = narrow && toolById.get(button.dataset.tool ?? '')?.narrow === false
    }
    syncGroups()
    moreGroup.hidden = !narrow || moreTools.length === 0
    if (!narrow && overflowing()) {
      const candidates = toolButtons()
        .filter((button) => rankOf(button) !== undefined)
        .reverse()
        .sort((a, b) => (rankOf(a) ?? 0) - (rankOf(b) ?? 0))
      moreGroup.hidden = candidates.length === 0
      for (const button of candidates) {
        if (!overflowing()) break
        button.hidden = true
        syncGroups()
      }
    }
    syncRoving()
  }

  const isCollapsed = (id: string): boolean =>
    pill.querySelector<HTMLElement>(`[data-tool="${id}"]`)?.hidden === true

  listen(pill, 'focusin', (event) => {
    const index = items().indexOf(event.target as HTMLButtonElement)
    if (index < 0) return
    rovingIndex = index
    syncRoving()
  })
  listen(pill, 'keydown', (event) => {
    const { key } = event as KeyboardEvent
    if (key === 'Escape') {
      event.preventDefault()
      options.onEscape()
      return
    }
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return
    event.preventDefault()
    const visible = items()
    visible[
      moveFocus(visible, visible.indexOf(document.activeElement as HTMLButtonElement), key)
    ]?.focus()
  })

  return {
    pill,
    dock,
    moreButton,
    moreTools,
    countButton,
    countText,
    countUnit,
    toolButtons,
    focusTarget: () => items()[rovingIndex],
    isCollapsed,
    hasOverflow: () => !moreGroup.hidden,
    setNarrow,
  }
}
