import type { Editor } from '@viveeditor/core'
import type { Bubble } from './bubble.js'
import type { CommandAccess } from './commands.js'
import { placeAtRect, placeInDock } from './dom.js'
import type { FormatTools } from './format-tools.js'
import type { Listen } from './lifecycle.js'
import { createLinkPanel, type LinkPanel } from './link-panel.js'
import type { Messages } from './messages.js'
import type { SourceView } from './source-view.js'
import { toolArgs } from './tool-button.js'
import type { Toolbar } from './toolbar.js'
import type { ToolSpec } from './tools.js'

export interface PanelRouterOptions {
  editor: Editor
  commands: CommandAccess
  messages: Messages
  root: HTMLElement
  toolbar: Toolbar
  bubble: Bubble
  formatTools: FormatTools
  source: SourceView
  toolById: ReadonlyMap<string, ToolSpec>
  closeFloating: () => void
  returnToEditor: () => void
  refresh: () => void
  schedule: () => void
}

export interface PanelRouter {
  readonly link: LinkPanel
  openPopover(id: string, anchor: HTMLElement): boolean
  openPanel(id: string): void
  openLink(from: HTMLElement | null): void
  toggleSource(): boolean
  activateTool(button: HTMLButtonElement, keyboard: boolean): void
}

export function createPanelRouter(options: PanelRouterOptions): PanelRouter {
  const { editor, commands, messages, root, toolbar, bubble, formatTools, source, toolById } =
    options
  const { pill, dock } = toolbar

  const openPopover = (id: string, anchor: HTMLElement): boolean => {
    const popover = formatTools.popovers.get(id)
    if (!popover) return false
    if (popover.isOpen()) {
      popover.close(true)
      return true
    }
    options.closeFloating()
    bubble.hide()
    popover.open(anchor)
    return true
  }

  const openPanel = (id: string): void => {
    const button = pill.querySelector<HTMLButtonElement>(`[data-tool="${id}"]`)
    const anchor =
      button && !button.hidden && !toolbar.isCollapsed(id) ? button : toolbar.moreButton
    const popover = formatTools.popovers.get(id)
    if (popover?.isOpen()) popover.element.querySelector('input')?.focus()
    else openPopover(id, anchor)
  }

  let linkFromDock: HTMLElement | null = null
  const link = createLinkPanel({
    editor,
    commands,
    messages,
    place: (element) => {
      if (linkFromDock) {
        placeInDock(element, linkFromDock, dock)
        return
      }
      const rect = editor.getSelectionRect()
      if (rect) placeAtRect(element, rect, root, 'below')
    },
    onClose: () => {
      linkFromDock?.setAttribute('aria-expanded', 'false')
      options.schedule()
    },
  })

  const openLink = (from: HTMLElement | null): void => {
    options.closeFloating()
    bubble.hide()
    linkFromDock = from && pill.contains(from) ? from : null
    linkFromDock?.setAttribute('aria-expanded', 'true')
    ;(linkFromDock ? dock : root).append(link.element)
    link.open(linkFromDock)
  }

  const toggleSource = (): boolean => {
    options.closeFloating()
    bubble.hide()
    if (source.isOpen()) source.close()
    else source.open()
    options.refresh()
    return true
  }

  const activateTool = (button: HTMLButtonElement, keyboard: boolean): void => {
    const tool = toolById.get(button.dataset.tool ?? '')
    if (!tool || button.getAttribute('aria-disabled') === 'true') return
    if (tool.id === 'link') {
      openLink(button)
      return
    }
    if (tool.id === 'source') {
      toggleSource()
      return
    }
    if (tool.popup === 'menu' || openPopover(tool.id, button)) return
    options.closeFloating()
    commands.run(tool.command, ...toolArgs(tool))
    if (!keyboard || !pill.contains(button)) options.returnToEditor()
    options.refresh()
  }

  return {
    link,
    openPopover,
    openPanel,
    openLink,
    toggleSource,
    activateTool,
  }
}

export interface ToolClickOptions {
  toolbar: Toolbar
  bubble: Bubble
  source: SourceView
  listen: Listen
  activateTool: (button: HTMLButtonElement, keyboard: boolean) => void
}

export function bindToolClicks(options: ToolClickOptions): void {
  const { toolbar, bubble, source, listen, activateTool } = options
  const { pill } = toolbar
  const preventFocusSteal = (event: Event): void => {
    if ((event.target as Element).closest('button')) event.preventDefault()
  }

  listen(
    pill,
    'click',
    (event) => {
      const button = (event.target as Element).closest('button')
      if (!source.isOpen() || !button || button === toolbar.moreButton) return
      if (button.dataset.tool === 'source') return
      event.preventDefault()
      event.stopPropagation()
    },
    true,
  )
  listen(pill, 'mousedown', preventFocusSteal)
  listen(bubble.element, 'mousedown', preventFocusSteal)
  listen(pill, 'click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-tool]')
    if (button) activateTool(button, (event as MouseEvent).detail === 0)
  })
  listen(bubble.element, 'click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('[data-tool]')
    if (button) activateTool(button, false)
  })
}
