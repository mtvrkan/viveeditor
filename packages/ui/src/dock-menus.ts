import type { Editor } from '@viveeditor/core'
import type { BlockControl } from './blocks.js'
import type { CommandAccess } from './commands.js'
import { placeInDock } from './dom.js'
import type { FileMenu } from './file-menu.js'
import type { FormatTools } from './format-tools.js'
import type { Fullscreen } from './fullscreen.js'
import { createMenu, type Menu, type MenuItem } from './menu.js'
import type { Messages } from './messages.js'
import type { SourceView } from './source-view.js'
import { toolArgs, toolEnabled } from './tool-button.js'
import type { Toolbar } from './toolbar.js'
import { displayShortcut, type ToolSpec } from './tools.js'

export interface DockMenusOptions {
  editor: Editor
  commands: CommandAccess
  messages: Messages
  groups: readonly (readonly ToolSpec[])[]
  toolbar: Toolbar
  formatTools: FormatTools
  fileMenu: FileMenu
  source: SourceView
  fullscreen: Fullscreen
  toggleSource: () => boolean
  openPopover: (id: string, anchor: HTMLElement) => boolean
  block: BlockControl
  fileButton: HTMLButtonElement | null
  closeFloating: () => void
  returnToEditor: () => void
}

export interface DockMenus {
  readonly more: Menu
  readonly all: Menu[]
}

const UNLOCKED = new Set(['source', 'fullscreen'])

function moreMenuItems(options: DockMenusOptions): MenuItem[] {
  const { editor, commands, messages, toolbar, source } = options
  return options.groups.flatMap((group, groupIndex) =>
    group
      .filter((tool) => !tool.narrow)
      .flatMap<MenuItem>((tool) => {
        const hidden = (): boolean => !toolbar.isCollapsed(tool.id)
        const menuItems = options.formatTools.menuItems.get(tool.id)
        if (menuItems) {
          return menuItems.map((item) => ({ ...item, group: groupIndex, hidden }))
        }
        if (tool.id === 'file') {
          return options.fileMenu.items.map((item) => ({ ...item, group: groupIndex, hidden }))
        }
        return [
          {
            group: groupIndex,
            hidden,
            id: tool.id,
            label: messages[tool.label],
            ...(tool.icon ? { icon: tool.icon } : { glyph: messages[tool.glyph ?? 'glyphBold'] }),
            ...(tool.shortcut ? { hint: displayShortcut(tool.shortcut) } : {}),
            role:
              (tool.active && !tool.popup) || tool.id === 'source' || tool.id === 'fullscreen'
                ? 'menuitemcheckbox'
                : 'menuitem',
            checked: () =>
              tool.id === 'source'
                ? source.isOpen()
                : tool.id === 'fullscreen'
                  ? options.fullscreen.isOpen()
                  : tool.active
                    ? editor.isActive(tool.active)
                    : false,
            disabled: () =>
              (source.isOpen() && !UNLOCKED.has(tool.id)) || !toolEnabled(tool, commands),
            action: () => {
              if (tool.id === 'source') return options.toggleSource()
              if (tool.id === 'fullscreen') {
                options.fullscreen.toggle()
                return false
              }
              if (tool.popup === 'dialog') return options.openPopover(tool.id, toolbar.moreButton)
              commands.run(tool.command, ...toolArgs(tool))
              return false
            },
          },
        ]
      }),
  )
}

export function createDockMenus(options: DockMenusOptions): DockMenus {
  const { messages, toolbar, block, fileButton } = options
  const { dock } = toolbar
  const menuFor = (label: string, trigger: HTMLButtonElement, items: readonly MenuItem[]): Menu =>
    createMenu({
      label,
      trigger,
      items,
      place: (element) => placeInDock(element, trigger, dock),
      onOpen: () => options.closeFloating(),
      onDone: options.returnToEditor,
    })
  const blockMenu = menuFor(messages.blockType, block.button, block.items)
  const more = menuFor(messages.more, toolbar.moreButton, moreMenuItems(options))
  const all = [blockMenu, more, ...options.formatTools.menus]
  if (fileButton) all.push(menuFor(messages.file, fileButton, options.fileMenu.items))
  return { more, all }
}
