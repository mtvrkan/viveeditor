import type { Editor } from '@viveeditor/core'
import { createAlignControl } from './align.js'
import { HIGHLIGHT_COLORS, HIGHLIGHT_DEFAULT, TEXT_COLORS } from './colors.js'
import type { CommandAccess } from './commands.js'
import { placeInDock } from './dom.js'
import { icon } from './icons.js'
import { createLazyPopover, type PanelKit, type PanelSource } from './lazy-popover.js'
import { createMenu, type Menu, type MenuItem } from './menu.js'
import type { Messages } from './messages.js'
import type { Popover } from './popover.js'
import { indentItems, textStyleItems } from './text-style.js'

export interface FormatToolsOptions {
  editor: Editor
  commands: CommandAccess
  messages: Messages
  locale: string
  pill: HTMLElement
  dock: HTMLElement
  closeFloating: () => void
  returnToEditor: () => void
  onClose: () => void
  panels: PanelSource
  overrides: Readonly<Record<string, unknown>>
  report: (error: unknown) => void
}

export interface FormatTools {
  readonly menus: readonly Menu[]
  readonly popovers: ReadonlyMap<string, Popover>
  readonly menuItems: ReadonlyMap<string, readonly MenuItem[]>
  sync(): void
}

const stringOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null)

export function createFormatTools(options: FormatToolsOptions): FormatTools {
  const { editor, commands, messages, pill, dock } = options
  const button = (id: string): HTMLButtonElement | null =>
    pill.querySelector<HTMLButtonElement>(`[data-tool="${id}"]`)
  const place = (element: HTMLElement, anchor: HTMLElement): void =>
    placeInDock(element, anchor, dock)
  const popovers = new Map<string, Popover>()
  const menus: Menu[] = []
  const source = options.panels
  let kit: Promise<PanelKit> | null = null
  const loadKit = (): Promise<PanelKit> => {
    if (typeof source !== 'function') return Promise.resolve(source)
    kit ??= source().catch((error: unknown) => {
      kit = null
      throw error
    })
    return kit
  }
  const lazy = (id: string, create: (panels: PanelKit) => Popover): void => {
    if (typeof source !== 'function') {
      const popover = create(source)
      dock.append(popover.element)
      popovers.set(id, popover)
      return
    }
    popovers.set(
      id,
      createLazyPopover({
        messages,
        load: loadKit,
        create,
        mount: (element) => dock.append(element),
        place,
        onClose: options.onClose,
        report: options.report,
      }),
    )
  }

  const align = createAlignControl(commands, messages)
  const menuItems = new Map<string, readonly MenuItem[]>([
    ['align', [...align.items, ...indentItems(commands, messages)]],
    ['textStyle', textStyleItems(editor, commands, messages, options.locale)],
  ])
  for (const [id, items] of menuItems) {
    const trigger = button(id)
    if (!trigger) continue
    menus.push(
      createMenu({
        label: messages[id === 'align' ? 'align' : 'textStyle'],
        trigger,
        items,
        place: (element) => place(element, trigger),
        onOpen: options.closeFloating,
        onDone: options.returnToEditor,
      }),
    )
  }
  const alignButton = button('align')

  if (commands.has('setTextColor')) {
    lazy('textColor', (panels) =>
      panels.createSwatchPanel({
        messages,
        title: messages.textColor,
        swatches: TEXT_COLORS,
        tone: 'dark',
        clearLabel: messages.colorDefault,
        current: () => stringOrNull(editor.getAttributes('textColor').color),
        apply: (swatch) => {
          commands.run('setTextColor', swatch.value)
          options.returnToEditor()
        },
        clear: () => {
          commands.run('unsetTextColor')
          options.returnToEditor()
        },
        place,
        onClose: options.onClose,
      }),
    )
  }

  if (commands.has('setHighlight')) {
    lazy('highlight', (panels) =>
      panels.createSwatchPanel({
        messages,
        title: messages.highlight,
        swatches: HIGHLIGHT_COLORS,
        tone: 'light',
        clearLabel: messages.highlightNone,
        current: () =>
          editor.isActive('highlight')
            ? (stringOrNull(editor.getAttributes('highlight').color) ?? HIGHLIGHT_DEFAULT)
            : null,
        apply: (swatch) => {
          if (swatch.color === null) commands.run('setHighlight')
          else commands.run('setHighlight', swatch.color)
          options.returnToEditor()
        },
        clear: () => {
          commands.run('unsetHighlight')
          options.returnToEditor()
        },
        place,
        onClose: options.onClose,
      }),
    )
  }

  if (commands.has('insertTable')) {
    lazy('table', (panels) =>
      panels.createTablePanel({
        commands,
        messages,
        place,
        returnToEditor: options.returnToEditor,
        onClose: options.onClose,
      }),
    )
  }

  if (commands.has('insertImage')) {
    lazy('image', (panels) =>
      panels.createImagePanel({
        commands,
        messages,
        place,
        returnToEditor: options.returnToEditor,
        onClose: options.onClose,
      }),
    )
  }

  if (commands.has('insertEmbed')) {
    lazy('embed', (panels) =>
      panels.createEmbedPanel({
        commands,
        messages,
        place,
        returnToEditor: options.returnToEditor,
        onClose: options.onClose,
      }),
    )
  }

  if (commands.has('insertText')) {
    lazy('specialCharacters', (panels) =>
      panels.createCharPanel({
        commands,
        messages,
        place,
        returnToEditor: options.returnToEditor,
        onClose: options.onClose,
      }),
    )
  }

  if (commands.has('setSearch')) {
    lazy('search', (panels) =>
      panels.createSearchPanel({
        commands,
        messages,
        place,
        returnToEditor: options.returnToEditor,
        onClose: options.onClose,
      }),
    )
  }

  const documentPanels = [
    ['outline', 'createOutlinePanel'],
    ['accessibility', 'createCheckPanel'],
    ['shortcuts', 'createShortcutsPanel'],
  ] as const
  for (const [id, factory] of documentPanels) {
    if (!button(id)) continue
    lazy(id, (panels) =>
      panels[factory]({
        commands,
        messages,
        text: panels.documentMessages(options.locale, options.overrides),
        place,
        returnToEditor: options.returnToEditor,
        onClose: options.onClose,
      }),
    )
  }

  for (const menu of menus) dock.append(menu.element)

  const sync = (): void => {
    if (alignButton) {
      const name = align.icon()
      if (alignButton.dataset.icon !== name) {
        alignButton.dataset.icon = name
        alignButton.replaceChildren(icon(name))
      }
    }
    const colorButton = button('textColor')
    if (colorButton) {
      const color = stringOrNull(editor.getAttributes('textColor').color)
      if (color) colorButton.style.setProperty('--ve-swatch', color)
      else colorButton.style.removeProperty('--ve-swatch')
    }
  }

  return { menus, popovers, menuItems, sync }
}
