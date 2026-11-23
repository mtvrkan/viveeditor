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
import { displayShortcut, TOOL_CATEGORIES, type ToolSpec } from './tools.js'

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

const INLINE_LIMIT = 2

function toolItem(
  options: DockMenusOptions,
  tool: ToolSpec,
  group: number,
  hidden: () => boolean,
  heading?: string,
): MenuItem {
  const { editor, commands, messages, toolbar, source } = options
  const label = messages[tool.label]
  const visual = tool.icon ? { icon: tool.icon } : { glyph: messages[tool.glyph ?? 'glyphBold'] }
  const children =
    tool.id === 'file' ? options.fileMenu.items : options.formatTools.menuItems.get(tool.id)
  if (children) {
    return {
      id: tool.id,
      label,
      ...visual,
      role: 'menuitem',
      group,
      ...(heading ? { heading } : {}),
      hidden,
      disabled: () => tool.id !== 'file' && source.isOpen(),
      items: children,
    }
  }
  return {
    group,
    ...(heading ? { heading } : {}),
    hidden,
    id: tool.id,
    label,
    ...visual,
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
    disabled: () => (source.isOpen() && !UNLOCKED.has(tool.id)) || !toolEnabled(tool, commands),
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
  }
}

function moreMenuItems(options: DockMenusOptions): MenuItem[] {
  const { messages, toolbar } = options
  const collapsed = (tool: ToolSpec): boolean => toolbar.isCollapsed(tool.id)
  return TOOL_CATEGORIES.flatMap<MenuItem>((category, index) => {
    const members = options.groups.flatMap((tools, group) =>
      tools
        .filter((tool) => !tool.narrow && category.tools.includes(tool.id))
        .map((tool) => ({ tool, group })),
    )
    if (members.length === 0) return []
    const nested = (): boolean =>
      members.filter(({ tool }) => collapsed(tool)).length > INLINE_LIMIT
    const label = messages[category.label]
    return [
      {
        id: `category-${category.label.slice(8).toLowerCase()}`,
        label,
        icon: category.icon,
        role: 'menuitem',
        group: -1,
        hidden: () => !nested(),
        items: members.map(({ tool, group }) =>
          toolItem(options, tool, group, () => !collapsed(tool)),
        ),
      },
      ...members.map(({ tool }) =>
        toolItem(options, tool, index, () => nested() || !collapsed(tool), label),
      ),
    ]
  })
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
