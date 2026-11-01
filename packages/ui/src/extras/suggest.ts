import { h, placeAtRect, uniqueId } from '../dom.js'
import type { UiPlugin, UiPluginHost } from '../plugins.js'
import { cleanDisplayText } from './text.js'

export interface SuggestionItem {
  label: string
  description?: string
  icon?: string
}

export interface SuggestionConfig<Item extends SuggestionItem> {
  char: string
  query: string
  title: string
  loading: string
  empty: string
  delay?: number
  items(query: string, signal: AbortSignal): readonly Item[] | Promise<readonly Item[]>
  select(item: Item, host: UiPluginHost): void
}

const MAX_ITEMS = 8
const LOOKBEHIND = 64

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function suggestionMenu<Item extends SuggestionItem>(
  config: SuggestionConfig<Item>,
): UiPlugin {
  const trigger = new RegExp(`(?:^|\\s)${escapeRegExp(config.char)}(${config.query})$`, 'u')
  return (host) => {
    const { editor } = host
    const listId = uniqueId('ve-suggest')
    const list = h('div', {
      class: 've-slash-list',
      id: listId,
      role: 'listbox',
      'aria-label': config.title,
    })
    const element = h('div', { class: 've-slash ve-suggest ve-glass ve-solid', hidden: '' }, [
      h('div', { class: 've-eyebrow', 'aria-hidden': 'true' }, [config.title]),
      list,
    ])
    host.root.append(element)
    let visible: Item[] = []
    let active = 0
    let typed = ''
    let dismissed: string | null = null
    let timer = 0
    let request: AbortController | null = null

    const optionId = (index: number): string => `${listId}-${index}`
    const textBefore = (): string => editor.getTextBeforeCursor().slice(-LOOKBEHIND)
    const isOpen = (): boolean => !element.hidden

    const cancel = (): void => {
      window.clearTimeout(timer)
      request?.abort()
      request = null
    }

    const close = (): void => {
      cancel()
      typed = ''
      if (!isOpen()) return
      element.hidden = true
      editor.dom.removeAttribute('aria-activedescendant')
      editor.dom.removeAttribute('aria-controls')
    }

    const place = (): void => {
      const rect = editor.getSelectionRect()
      if (rect) placeAtRect(element, rect, host.root, 'caret')
    }

    const render = (message: string | null): void => {
      list.replaceChildren(
        ...(message !== null
          ? [h('div', { class: 've-empty' }, [message])]
          : visible.map((item, index) => {
              const option = h(
                'div',
                {
                  class: 've-item',
                  id: optionId(index),
                  role: 'option',
                  'aria-selected': String(index === active),
                },
                [
                  h('span', { class: 've-item-icon' }, [cleanDisplayText(item.icon, 16)]),
                  h('span', { class: 've-item-label' }, [cleanDisplayText(item.label, 100)]),
                  h('span', { class: 've-item-hint' }, [cleanDisplayText(item.description, 200)]),
                ],
              )
              option.addEventListener('mousedown', (event) => event.preventDefault())
              option.addEventListener('click', () => select(index))
              return option
            })),
      )
      if (message === null && visible.length > 0) {
        editor.dom.setAttribute('aria-activedescendant', optionId(active))
        list.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: 'nearest' })
      } else {
        editor.dom.removeAttribute('aria-activedescendant')
        if (message !== null) host.announce(message)
      }
    }

    const show = (message: string | null): void => {
      element.hidden = false
      editor.dom.setAttribute('aria-controls', listId)
      render(message)
      place()
    }

    const load = (query: string): void => {
      cancel()
      const controller = new AbortController()
      request = controller
      timer = window.setTimeout(() => {
        let result: readonly Item[] | Promise<readonly Item[]>
        try {
          result = config.items(query, controller.signal)
        } catch (error) {
          host.report(error)
          result = []
        }
        if (result instanceof Promise) show(config.loading)
        Promise.resolve(result)
          .then((items) => {
            if (controller.signal.aborted || request !== controller) return
            visible = Array.isArray(items) ? items.slice(0, MAX_ITEMS) : []
            active = 0
            show(visible.length === 0 ? config.empty : null)
          })
          .catch((error: unknown) => {
            if (controller.signal.aborted) return
            host.report(error)
            visible = []
            show(config.empty)
          })
      }, config.delay ?? 150)
    }

    function select(index: number): void {
      const item = visible[index]
      const match = trigger.exec(textBefore())
      close()
      if (!item || !match || !editor.isEditable) return
      const { from } = editor.getSelection()
      const length = config.char.length + (match[1] ?? '').length
      host.commands.run('deleteRange', from - length, from)
      config.select(item, host)
      editor.focus()
    }

    const update = (focused: boolean): void => {
      const text = focused && editor.isEditable ? textBefore() : ''
      const match = trigger.exec(text)
      if (!match) {
        dismissed = null
        close()
        return
      }
      if (dismissed === text) return
      if (text === typed) {
        if (isOpen()) place()
        return
      }
      typed = text
      load(match[1] ?? '')
    }

    const handleKey = (event: KeyboardEvent): boolean => {
      if (!isOpen()) return false
      if (event.key === 'Escape') {
        dismissed = typed
        close()
        return true
      }
      if (visible.length === 0) return false
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const step = event.key === 'ArrowDown' ? 1 : -1
        active = (active + step + visible.length) % visible.length
        render(null)
        return true
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        select(active)
        return true
      }
      return false
    }

    return {
      update,
      handleKey,
      isOpen,
      destroy: () => {
        close()
        element.remove()
      },
    }
  }
}
