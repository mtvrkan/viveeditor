import type { Editor } from '@viveeditor/core'
import type { CommandAccess } from './commands.js'
import type { ContextKind, ContextMenu, ContextPoint } from './context-menu.js'
import { h } from './dom.js'
import type { PanelKit } from './lazy-popover.js'
import type { Listen } from './lifecycle.js'
import type { ContextMenuMode } from './ui-options.js'

export interface ContextTarget {
  kind: ContextKind
  element: Element | null
}

export interface ContextTriggerOptions {
  mode: ContextMenuMode
  editor: Editor
  commands: CommandAccess
  listen: Listen
  load: () => Promise<PanelKit>
  create: (kit: PanelKit, container: HTMLElement) => ContextMenu
  report: (error: unknown) => void
}

export interface ContextTrigger {
  readonly element: HTMLElement
  close(returnFocus: boolean): void
}

const OBJECTS = '.vive-image, .vive-embed, .vive-math, a[href], .vive-code, td, th'
const CLASS_KINDS: readonly [string, ContextKind][] = [
  ['vive-image', 'image'],
  ['vive-embed', 'embed'],
  ['vive-math', 'math'],
  ['vive-code', 'code'],
]
const KEYBOARD_ECHO = 600

export function objectAt(node: unknown, editorDom: HTMLElement): ContextTarget | null {
  const start = node instanceof Element ? node : node instanceof Node ? node.parentElement : null
  const element = start?.closest(OBJECTS)
  if (!element || element === editorDom || !editorDom.contains(element)) return null
  const named = CLASS_KINDS.find(([name]) => element.classList.contains(name))
  const kind: ContextKind = named ? named[1] : element.tagName === 'A' ? 'link' : 'table'
  return { kind, element }
}

export function bindContextMenu(options: ContextTriggerOptions): ContextTrigger {
  const { editor, commands, listen, mode } = options
  const element = h('div', { class: 've-context' })
  let menu: ContextMenu | null = null
  let loading: Promise<ContextMenu> | null = null
  let pointer = ''
  let keyed = -Infinity

  const close = (returnFocus: boolean): void => menu?.close(returnFocus)
  if (mode === false) return { element, close }

  const allowed = (target: ContextTarget | null): ContextTarget | null =>
    target && (editor.isEditable || (target.kind !== 'table' && target.kind !== 'math'))
      ? target
      : null

  const fallback = (): ContextTarget | null =>
    mode === 'always' ? { kind: 'text', element: null } : null

  const atSelection = (): ContextTarget | null => {
    const selected = objectAt(editor.dom.querySelector('.ProseMirror-selectednode'), editor.dom)
    if (selected) return selected
    if (commands.query('link')) return { kind: 'link', element: null }
    if (editor.isActive('codeBlock')) return { kind: 'code', element: null }
    if (commands.query('inTable') === true) return { kind: 'table', element: null }
    return fallback()
  }

  const show = (target: ContextTarget, point: ContextPoint): void => {
    loading ??= options.load().then((kit) => {
      const created = options.create(kit, element)
      menu = created
      return created
    })
    loading.then(
      (created) => {
        if (!editor.isDestroyed) created.open(target.kind, target.element, point)
      },
      (error: unknown) => {
        loading = null
        options.report(error)
      },
    )
  }

  const isTouch = (event: MouseEvent): boolean =>
    pointer === 'touch' || (event as PointerEvent).pointerType === 'touch'

  const pointerTarget = (event: MouseEvent): ContextTarget | null =>
    event.shiftKey || isTouch(event)
      ? null
      : allowed(objectAt(event.target, editor.dom) ?? fallback())

  listen(editor.dom, 'pointerdown', (event) => {
    pointer = (event as PointerEvent).pointerType ?? ''
  })
  listen(
    editor.dom,
    'mousedown',
    (event) => {
      const mouse = event as MouseEvent
      if (mouse.button !== 2 || !pointerTarget(mouse)) return
      mouse.preventDefault()
      mouse.stopPropagation()
    },
    true,
  )
  listen(editor.dom, 'contextmenu', (event) => {
    const mouse = event as MouseEvent
    if (performance.now() - keyed < KEYBOARD_ECHO) {
      mouse.preventDefault()
      return
    }
    const target = pointerTarget(mouse)
    if (!target) return
    mouse.preventDefault()
    commands.run('selectAt', target.element ?? mouse.target, {
      left: mouse.clientX,
      top: mouse.clientY,
    })
    show(target, { x: mouse.clientX, y: mouse.clientY })
  })
  listen(editor.dom, 'keydown', (event) => {
    const key = event as KeyboardEvent
    const pressed = key.key === 'ContextMenu' || (key.shiftKey && key.key === 'F10')
    if (!pressed || key.altKey || key.ctrlKey || key.metaKey || key.target !== editor.dom) return
    const target = allowed(atSelection())
    if (!target) return
    key.preventDefault()
    keyed = performance.now()
    const rect = target.element?.getBoundingClientRect() ?? editor.getSelectionRect()
    const box = editor.dom.getBoundingClientRect()
    show(target, rect ? { x: rect.left, y: rect.bottom } : { x: box.left, y: box.top })
  })

  return { element, close }
}
