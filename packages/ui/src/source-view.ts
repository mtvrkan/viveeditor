import type { Editor } from '@viveeditor/core'
import type { CommandAccess } from './commands.js'
import { h } from './dom.js'
import type { Messages } from './messages.js'

export interface SourceView {
  readonly element: HTMLTextAreaElement
  isOpen(): boolean
  open(): void
  close(): void
  apply(): void
  destroy(): void
}

const CONTAINERS = new Set([
  'ul',
  'ol',
  'li',
  'blockquote',
  'table',
  'colgroup',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
])
const INDENT = '  '

function openTag(element: Element): string {
  const html = (element.cloneNode(false) as Element).outerHTML
  return html.slice(0, html.length - `</${element.localName}>`.length)
}

function formatNode(element: Element, depth: number): string[] {
  const pad = INDENT.repeat(depth)
  const children = [...element.childNodes]
  if (
    !CONTAINERS.has(element.localName) ||
    children.length === 0 ||
    children.some((child) => child.nodeType !== Node.ELEMENT_NODE)
  ) {
    return [pad + element.outerHTML]
  }
  return [
    pad + openTag(element),
    ...(children as Element[]).flatMap((child) => formatNode(child, depth + 1)),
    `${pad}</${element.localName}>`,
  ]
}

export function formatHtml(html: string): string {
  const template = document.createElement('template')
  template.innerHTML = html
  const nodes = [...template.content.childNodes]
  if (nodes.some((node) => node.nodeType !== Node.ELEMENT_NODE)) return html
  return (nodes as Element[]).flatMap((node) => formatNode(node, 0)).join('\n')
}

export function createSourceView(
  editor: Editor,
  commands: CommandAccess,
  messages: Messages,
  root: HTMLElement,
): SourceView {
  const element = h('textarea', {
    class: 've-source',
    'aria-label': messages.sourceLabel,
    spellcheck: 'false',
    autocapitalize: 'off',
    autocomplete: 'off',
    dir: 'ltr',
    hidden: '',
  })
  let baseline = ''

  const isOpen = (): boolean => !element.hidden

  const apply = (): void => {
    if (!isOpen() || editor.isDestroyed || element.value === baseline) return
    commands.run('replaceContent', element.value)
    baseline = element.value
  }

  const open = (): void => {
    if (isOpen()) return
    const height = editor.dom.getBoundingClientRect().height
    baseline = formatHtml(editor.getHTML())
    element.value = baseline
    if (height > 0) element.style.height = `${Math.round(height)}px`
    editor.dom.after(element)
    root.dataset.source = ''
    element.hidden = false
    element.focus()
  }

  const close = (): void => {
    if (!isOpen()) return
    apply()
    element.hidden = true
    delete root.dataset.source
    if (!editor.isDestroyed) editor.focus()
  }

  element.addEventListener('change', apply)

  return {
    element,
    isOpen,
    open,
    close,
    apply,
    destroy: () => {
      apply()
      element.remove()
      delete root.dataset.source
    },
  }
}
