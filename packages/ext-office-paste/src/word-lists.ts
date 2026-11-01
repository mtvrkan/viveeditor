interface ListLevel {
  ordered: boolean
  start: number | null
}

interface OpenList {
  level: number
  ordered: boolean
  list: HTMLElement
}

const LIST_RULE = /@list\s+(l\d+):level(\d)\s*\{([^{}]*)\}/g
const MSO_LIST = /mso-list:\s*(l\d+)\s+level(\d)/i
const NUMBER_FORMAT = /mso-level-number-format:\s*([\w-]+)/i
const START_AT = /mso-level-start-at:\s*(\d{1,4})/i
const ORDERED_MARKER = /^\(?(\d{1,4}|[a-z]{1,3}|[ivxlcdm]{1,6})[.)]$/i
const NUMBER_MARKER = /^\(?(\d{1,4})[.)]$/
const MAX_STYLE_LENGTH = 500_000

function readListStyles(doc: Document): Map<string, ListLevel> {
  const levels = new Map<string, ListLevel>()
  let budget = MAX_STYLE_LENGTH
  for (const style of doc.querySelectorAll('style')) {
    if (budget <= 0) break
    const text = (style.textContent ?? '').slice(0, budget)
    budget -= text.length
    for (const [, id, level, rule = ''] of text.matchAll(LIST_RULE)) {
      const format = NUMBER_FORMAT.exec(rule)?.[1]?.toLowerCase()
      const start = START_AT.exec(rule)?.[1]
      levels.set(`${id}:${level}`, {
        ordered: format !== 'bullet' && format !== 'image',
        start: start ? Number(start) : null,
      })
    }
  }
  return levels
}

const OPENER = /^\[if !supportLists\]/i
const CLOSER = /\[endif\]/i

const isComment = (node: Node, pattern: RegExp): boolean =>
  node.nodeType === Node.COMMENT_NODE && pattern.test((node as Comment).data.trim())

function closingOf(opener: Node): Node | null {
  for (let node = opener.nextSibling; node; node = node.nextSibling) {
    if (isComment(node, CLOSER)) return node
    if (isComment(node, OPENER)) return null
  }
  return null
}

export function takeMarker(root: Element): string {
  let marker = ''
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
  const openers: Node[] = []
  while (walker.nextNode()) {
    if (isComment(walker.currentNode, OPENER)) openers.push(walker.currentNode)
  }
  for (const opener of openers) {
    const closer = closingOf(opener)
    let node = closer ? opener.nextSibling : null
    while (node && node !== closer) {
      const next = node.nextSibling
      marker += node.textContent ?? ''
      node.remove()
      node = next
    }
    closer?.parentNode?.removeChild(closer)
    opener.parentNode?.removeChild(opener)
  }
  for (const ignored of root.querySelectorAll('[style*="mso-list:Ignore" i]')) {
    marker += ignored.textContent ?? ''
    ignored.remove()
  }
  return marker.replace(/\s+/g, '')
}

function numberFrom(marker: string, fallback: number | null): number | null {
  const match = NUMBER_MARKER.exec(marker)
  return match ? Number(match[1]) : fallback
}

export function convertWordLists(doc: Document): void {
  const styles = readListStyles(doc)
  let open: OpenList[] = []
  for (const paragraph of doc.body.querySelectorAll('p')) {
    const match = MSO_LIST.exec(paragraph.getAttribute('style') ?? '')
    if (!match) continue
    const level = Math.min(Math.max(Number(match[2]), 1), 9)
    const marker = takeMarker(paragraph)
    const known = styles.get(`${match[1]}:${match[2]}`)
    const ordered = known ? known.ordered : ORDERED_MARKER.test(marker)
    if (paragraph.previousElementSibling !== open[0]?.list) open = []
    while (open.length > 0 && (open.at(-1)?.level ?? 0) > level) open.pop()
    let top = open.at(-1)
    if (top && top.level === level && top.ordered !== ordered) {
      open.pop()
      top = open.at(-1)
    }
    if (!top || top.level < level) {
      const list = doc.createElement(ordered ? 'ol' : 'ul')
      const start = ordered ? numberFrom(marker, known?.start ?? null) : null
      if (start !== null && start !== 1) list.setAttribute('start', String(start))
      if (top) {
        const holder = top.list.lastElementChild ?? top.list.appendChild(doc.createElement('li'))
        holder.append(list)
      } else {
        paragraph.before(list)
      }
      top = { level, ordered, list }
      open.push(top)
    }
    const item = doc.createElement('li')
    const block = doc.createElement('p')
    block.append(...paragraph.childNodes)
    item.append(block)
    top.list.append(item)
    paragraph.remove()
  }
}
