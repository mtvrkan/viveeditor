import type { Editor } from '@viveeditor/core'
import { createBlockControl } from './blocks.js'
import { createBubble } from './bubble.js'
import { commandAccess } from './commands.js'
import { createCountControl } from './count-control.js'
import { createDockMenus } from './dock-menus.js'
import { h, placeInDock } from './dom.js'
import { createFileMenu } from './file-menu.js'
import { createFormatTools } from './format-tools.js'
import { bindEditorKeys, bindKeyboardInset, bindToolbarShortcut } from './keyboard.js'
import { createLayout, trackPointer } from './layout.js'
import type { PanelKitLoader } from './lazy-popover.js'
import { createLifecycle, createScheduler } from './lifecycle.js'
import { MESSAGES, type Messages, resolveLocale } from './messages.js'
import { bindToolClicks, createPanelRouter } from './panels.js'
import { startPlugins } from './plugins.js'
import { createSlashMenu } from './slash-menu.js'
import { createSourceView } from './source-view.js'
import { createToolButton, markSourceState, syncToolButtons } from './tool-button.js'
import { createToolbar } from './toolbar.js'
import { availableTools } from './tools.js'
import type { EditorUI, UiOptions } from './ui-options.js'

const loadPanelKit: PanelKitLoader = () => import('./panel-kit.js')
const BUBBLE_TOOLS = ['bold', 'italic', 'link', 'code']

export function createUI(editor: Editor, options: UiOptions = {}): EditorUI {
  const parent = editor.dom.parentElement
  if (!parent) throw new Error('The editor must be mounted inside an element before createUI.')
  const root: HTMLElement = parent
  const locale = resolveLocale(options.locale)
  const messages: Messages = { ...MESSAGES[locale], ...options.messages }
  const formula = options.readability ?? (locale === 'tr' ? 'atesman' : 'flesch')
  const commands = commandAccess(editor)
  const lifecycle = createLifecycle()
  const { listen } = lifecycle

  root.classList.add('ve-root')
  root.dataset.theme = options.theme ?? 'light'

  const tools = availableTools({
    has: (command) => commands.has(command),
    source: options.source !== false,
    files: options.files !== false,
  })
  const toolById = new Map(tools.flat().map((tool) => [tool.id, tool]))
  const block = createBlockControl(editor, commands, messages)
  const status = h('div', { class: 've-sr', role: 'status' })
  const report = options.onError ?? ((error: unknown) => console.error(error))
  const host = {
    editor,
    commands,
    messages,
    locale,
    root,
    report,
    announce: (text: string) => {
      status.textContent = text
    },
    closeFloating: () => closeFloating(),
  }
  const plugins = startPlugins(options.plugins ?? [], host, report)

  const returnToEditor = (): void => {
    if (!editor.isDestroyed) editor.focus()
  }

  const toolbar = createToolbar({
    messages,
    groups: tools,
    createButton: (tool) => createToolButton(tool, messages),
    blockButton: block.available ? block.button : null,
    listen,
    onEscape: returnToEditor,
  })
  const { pill, dock, countButton } = toolbar

  const bubble = createBubble(
    editor,
    messages,
    [
      ...BUBBLE_TOOLS.flatMap((id) => {
        const tool = toolById.get(id)
        return tool ? [createToolButton(tool, messages)] : []
      }),
      ...plugins.bubble(),
    ],
    root,
  )

  const formatTools = createFormatTools({
    editor,
    commands,
    messages,
    pill,
    dock,
    closeFloating: () => closeFloating(),
    returnToEditor,
    onClose: () => scheduler.schedule(),
    panels: options.panels ?? loadPanelKit,
    report,
  })

  const fileButton = pill.querySelector<HTMLButtonElement>('[data-tool="file"]')
  const fileMenu = createFileMenu(
    editor,
    commands,
    messages,
    options.files || {},
    status,
    (element) =>
      placeInDock(
        element,
        fileButton && !toolbar.isCollapsed('file') ? fileButton : toolbar.moreButton,
        dock,
      ),
  )

  const source = createSourceView(editor, commands, messages, root)
  const panels = createPanelRouter({
    editor,
    commands,
    messages,
    root,
    toolbar,
    bubble,
    formatTools,
    source,
    toolById,
    closeFloating: () => closeFloating(),
    returnToEditor,
    refresh: () => refresh(),
    schedule: () => scheduler.schedule(),
  })
  const { link } = panels

  const dockMenus = createDockMenus({
    editor,
    commands,
    messages,
    groups: tools,
    toolbar,
    formatTools,
    fileMenu,
    source,
    toggleSource: panels.toggleSource,
    openPopover: panels.openPopover,
    block,
    fileButton,
    closeFloating: () => closeFloating(),
    returnToEditor,
  })
  const menus = dockMenus.all
  const layout = createLayout(root, toolbar, () => dockMenus.more.close(false), lifecycle)

  const count = createCountControl({
    readText: () => editor.getText(),
    commands,
    messages,
    locale,
    formula,
    toolbar,
    dock,
    status,
    listen,
    closeFloating: () => closeFloating(),
  })

  function closeFloating(): void {
    for (const menu of menus) menu.close(false)
    for (const popover of formatTools.popovers.values()) popover.close(false)
    link.close(false)
    count.close(false)
    fileMenu.hideNotice()
  }

  const slash = createSlashMenu(editor, commands, messages, root, panels.openPanel, plugins.slash())
  dock.append(
    ...menus.map((menu) => menu.element).filter((element) => !element.isConnected),
    count.panel,
    fileMenu.notice,
  )
  root.append(bubble.element, slash.element, link.element, dock, status)

  let focused = false

  const updateTools = (): void => {
    syncToolButtons([...toolbar.toolButtons(), ...bubble.buttons], toolById, editor, commands)
    block.sync()
    formatTools.sync()
    markSourceState([...toolbar.toolButtons(), block.button], source.isOpen())
    for (const menu of menus) if (menu.isOpen()) menu.refresh()
  }

  const refresh = (): void => {
    if (editor.isDestroyed) return
    if (dock.hidden === editor.isEditable) {
      if (!editor.isEditable) source.close()
      dock.hidden = !editor.isEditable
      layout.relayout(true)
    }
    updateTools()
    count.updateLimit()
    if (options.slash !== false) slash.update(focused)
    plugins.update(focused)
    bubble.update(
      options.bubble !== false &&
        focused &&
        !pointer.isDragging() &&
        editor.isEditable &&
        !editor.getSelection().empty &&
        !commands.query('selectedImage') &&
        !link.isOpen() &&
        !slash.isOpen() &&
        !plugins.isOpen(),
    )
  }

  const scheduler = createScheduler(refresh)
  const schedule = scheduler.schedule

  bindToolClicks({ toolbar, bubble, source, listen, activateTool: panels.activateTool })
  bindToolbarShortcut(source.element, toolbar, listen)
  bindEditorKeys({
    root,
    editor,
    toolbar,
    bubble,
    slash,
    listen,
    hasTool: (id) => toolById.has(id),
    pluginKey: plugins.handleKey,
    openLink: () => panels.openLink(null),
    openSearch: () => panels.openPanel('search'),
    schedule,
  })

  const pointer = trackPointer({
    editorDom: editor.dom,
    floating: [dock, link.element],
    listen,
    hideBubble: () => bubble.hide(),
    closeFloating,
    schedule,
  })

  bindKeyboardInset(root, listen)

  layout.observe([root, block.button, countButton])

  const setFocused = (value: boolean): void => {
    focused = value
    schedule()
  }
  const unsubscribers = [
    editor.on('update', schedule),
    editor.on('change', () => count.measureLater()),
    editor.on('focus', () => setFocused(true)),
    editor.on('blur', () => setFocused(false)),
    editor.on('destroy', () => destroy()),
  ]

  count.updateMeasure()
  refresh()
  layout.relayout()

  let destroyed = false
  function destroy(): void {
    if (destroyed) return
    destroyed = true
    scheduler.cancel()
    count.cancel()
    lifecycle.dispose()
    for (const unsubscribe of unsubscribers) unsubscribe()
    slash.destroy()
    plugins.destroy()
    source.destroy()
    fileMenu.destroy()
    for (const element of [bubble.element, link.element, dock, status]) element.remove()
    root.classList.remove('ve-root')
    delete root.dataset.theme
    delete root.dataset.size
    root.style.removeProperty('--ve-keyboard')
  }

  return { root, toolbar: pill, refresh, destroy }
}
