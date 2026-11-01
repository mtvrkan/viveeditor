import { convertWordLists, takeMarker } from './word-lists.js'

export type OfficeSource = 'word' | 'docs' | 'libreoffice'

export interface OfficeCleanResult {
  html: string
  source: OfficeSource | null
  droppedImages: number
}

const WORD = /urn:schemas-microsoft-com:office|class=["']?Mso|mso-list:/i
const DOCS = /id=["']?docs-internal-guid/i
const LIBREOFFICE = /<meta[^>]{0,200}content=["']?LibreOffice/i

export function detectOffice(html: string): OfficeSource | null {
  if (DOCS.test(html)) return 'docs'
  if (WORD.test(html)) return 'word'
  if (LIBREOFFICE.test(html)) return 'libreoffice'
  return null
}

function rename(element: Element, tag: string): Element {
  const replacement = element.ownerDocument.createElement(tag)
  replacement.append(...element.childNodes)
  element.replaceWith(replacement)
  return replacement
}

function convertWordStyles(body: HTMLElement): void {
  for (const title of body.querySelectorAll('p.MsoTitle')) rename(title, 'h1')
  for (const quote of body.querySelectorAll('p.MsoQuote, p.MsoIntenseQuote')) {
    const block = quote.ownerDocument.createElement('blockquote')
    quote.before(block)
    block.append(rename(quote, 'p'))
  }
}

function nestStrayLists(body: HTMLElement): void {
  for (const list of body.querySelectorAll(':is(ul, ol) > :is(ul, ol)')) {
    const previous = list.previousElementSibling
    if (previous?.tagName === 'LI') {
      previous.append(list)
    } else {
      const item = list.ownerDocument.createElement('li')
      list.before(item)
      item.append(list)
    }
  }
}

function splitDecorations(body: HTMLElement): void {
  for (const span of body.querySelectorAll<HTMLElement>('span[style*="text-decoration" i]')) {
    const line = span.style.textDecorationLine || span.style.textDecoration
    if (!line.includes('underline') || !line.includes('line-through')) continue
    span.style.removeProperty('text-decoration')
    span.style.removeProperty('text-decoration-line')
    const underline = span.ownerDocument.createElement('u')
    const strike = span.ownerDocument.createElement('s')
    strike.append(...span.childNodes)
    underline.append(strike)
    span.append(underline)
  }
}

function removeOfficeLeftovers(body: HTMLElement): void {
  const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_COMMENT)
  const comments: Node[] = []
  while (walker.nextNode()) comments.push(walker.currentNode)
  for (const comment of comments) comment.parentNode?.removeChild(comment)
  for (const element of [...body.getElementsByTagName('o:p')]) element.remove()
}

function dropLocalImages(body: HTMLElement): number {
  let dropped = 0
  for (const image of body.querySelectorAll('img')) {
    const src = (image.getAttribute('src') ?? '').trim().toLowerCase()
    if (!src.startsWith('file:') && !src.startsWith('blob:')) continue
    image.remove()
    dropped++
  }
  return dropped
}

export function cleanOffice(html: string): OfficeCleanResult {
  const source = detectOffice(html)
  if (!source) return { html, source, droppedImages: 0 }
  const doc = new DOMParser().parseFromString(html, 'text/html')
  if (source === 'word') {
    convertWordLists(doc)
    convertWordStyles(doc.body)
    takeMarker(doc.body)
  }
  removeOfficeLeftovers(doc.body)
  nestStrayLists(doc.body)
  splitDecorations(doc.body)
  const droppedImages = dropLocalImages(doc.body)
  return { html: doc.body.innerHTML, source, droppedImages }
}

export function cleanOfficeHtml(html: string): string {
  return cleanOffice(html).html
}
