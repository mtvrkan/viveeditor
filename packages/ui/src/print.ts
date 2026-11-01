import type { Editor } from '@viveeditor/core'
import { h } from './dom.js'

export interface PrintOptions {
  title?: string
  css?: string
  imageTimeout?: number
}

const PRINT_CSS = [
  'body{margin:0;font:12pt/1.6 Georgia,"Times New Roman",serif;color:#000}',
  'h1,h2,h3,h4{font-family:-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.25;break-after:avoid}',
  'a{color:inherit}',
  'img{max-width:100%;height:auto}',
  'blockquote{margin:1em 0;padding-left:1em;border-left:3px solid #999}',
  'pre,code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10pt}',
  'pre{white-space:pre-wrap;padding:.6em;border:1px solid #ccc}',
  'table{border-collapse:collapse;width:100%;break-inside:auto}',
  'th,td{border:1px solid #999;padding:4px 6px;vertical-align:top}',
  'tr{break-inside:avoid}',
  'td>p,th>p,li>p{margin:0}',
  'ul[data-type="taskList"]{list-style:none;padding-left:0}',
  'li[data-type="taskItem"]{display:flex;gap:.5em}',
].join('')

const CSP =
  "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https: data:"

export function printableHtml(editor: Editor, options: PrintOptions = {}): string {
  const doc = document.implementation.createHTMLDocument(options.title ?? document.title)
  doc.body.innerHTML = editor.getHTML()
  for (const embed of doc.querySelectorAll('[data-embed]')) {
    const src = embed.querySelector('iframe')?.getAttribute('src') ?? ''
    const paragraph = doc.createElement('p')
    if (src.startsWith('https://')) {
      const link = doc.createElement('a')
      link.href = src
      link.textContent = embed.getAttribute('data-title') || src
      paragraph.append(link)
    }
    embed.replaceWith(paragraph)
  }
  for (const element of doc.querySelectorAll('script, iframe, object, embed')) element.remove()
  const notes = Array.from(doc.querySelectorAll('sup[data-footnote]'))
  if (notes.length > 0) {
    const list = doc.createElement('ol')
    notes.forEach((note, index) => {
      const item = doc.createElement('li')
      item.append(...Array.from(note.childNodes))
      list.append(item)
      note.textContent = String(index + 1)
    })
    doc.body.append(list)
  }
  const meta = (attributes: Record<string, string>): HTMLMetaElement => {
    const element = doc.createElement('meta')
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value)
    return element
  }
  const style = doc.createElement('style')
  style.textContent = PRINT_CSS + (options.css ?? '')
  doc.head.prepend(
    meta({ charset: 'utf-8' }),
    meta({ 'http-equiv': 'Content-Security-Policy', content: CSP }),
    meta({ name: 'referrer', content: 'no-referrer' }),
  )
  doc.head.append(style)
  return `<!DOCTYPE html>${doc.documentElement.outerHTML}`
}

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds))

const CLEANUP_DELAY = 10 * 60_000
let pending: { frame: HTMLIFrameElement; timer: number } | null = null

const removeFrame = (): void => {
  if (!pending) return
  window.clearTimeout(pending.timer)
  pending.frame.remove()
  pending = null
}

export async function printDocument(editor: Editor, options: PrintOptions = {}): Promise<void> {
  removeFrame()
  const frame = h('iframe', {
    sandbox: 'allow-same-origin allow-modals',
    'aria-hidden': 'true',
    tabindex: '-1',
    class: 've-print-frame',
    style: 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden',
  })
  const loaded = new Promise<void>((resolve) =>
    frame.addEventListener('load', () => resolve(), { once: true }),
  )
  frame.srcdoc = printableHtml(editor, options)
  document.body.append(frame)
  pending = { frame, timer: window.setTimeout(removeFrame, CLEANUP_DELAY) }
  const current = pending
  try {
    await loaded
    const view = frame.contentWindow
    if (!view) throw new Error('Print frame is not available')
    const images = [...view.document.images].map((image) => image.decode().catch(() => undefined))
    await Promise.race([Promise.all(images), wait(options.imageTimeout ?? 5000)])
    if (pending !== current) return
    view.addEventListener('afterprint', () => pending === current && removeFrame(), { once: true })
    view.focus()
    view.print()
  } catch (error) {
    if (pending === current) removeFrame()
    throw error
  }
}
