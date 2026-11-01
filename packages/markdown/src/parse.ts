import MarkdownIt from 'markdown-it'
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs'
import type Token from 'markdown-it/lib/token.mjs'
import { MAX_MARKDOWN_LENGTH } from './limits.js'

const TASK_MARKER = /^\[([ xX])\](?:\s+|$)/

function firstInline(tokens: Token[], itemIndex: number): Token | null {
  const next = tokens[itemIndex + 1]
  const inline = next?.type === 'paragraph_open' ? tokens[itemIndex + 2] : next
  return inline?.type === 'inline' ? inline : null
}

function closingIndex(tokens: Token[], openIndex: number): number {
  const open = tokens[openIndex]
  if (!open) return -1
  for (let index = openIndex + 1; index < tokens.length; index++) {
    const token = tokens[index]
    if (token?.type === open.type.replace('_open', '_close') && token.level === open.level) {
      return index
    }
  }
  return -1
}

function markTaskLists(state: StateCore): void {
  const { tokens } = state
  tokens.forEach((list, listIndex) => {
    if (list.type !== 'bullet_list_open') return
    const end = closingIndex(tokens, listIndex)
    const items = tokens
      .slice(listIndex + 1, end)
      .map((token, offset) => ({ token, index: listIndex + 1 + offset }))
      .filter(({ token }) => token.type === 'list_item_open' && token.level === list.level + 1)
    const markers = items.map(({ index }) => {
      const inline = firstInline(tokens, index)
      const match = inline ? TASK_MARKER.exec(inline.content) : null
      return match && inline ? { inline, match } : null
    })
    if (items.length === 0 || markers.some((marker) => marker === null)) return
    list.attrSet('data-type', 'taskList')
    items.forEach(({ token }, position) => {
      const marker = markers[position]
      if (!marker) return
      token.attrSet('data-type', 'taskItem')
      token.attrSet('data-checked', String(marker.match[1] !== ' '))
      const { inline, match } = marker
      inline.content = inline.content.slice(match[0].length)
      const text = inline.children?.[0]
      if (text?.type === 'text') text.content = text.content.replace(TASK_MARKER, '')
    })
  })
}

function trimCodeEndings(state: StateCore): void {
  for (const token of state.tokens) {
    if (token.type === 'fence' || token.type === 'code_block') {
      token.content = token.content.replace(/\r?\n$/, '')
    }
  }
}

function unwrapImageParagraphs(state: StateCore): void {
  const { tokens } = state
  tokens.forEach((token, index) => {
    const inline = tokens[index + 1]
    const close = tokens[index + 2]
    if (token.type !== 'paragraph_open' || close?.type !== 'paragraph_close') return
    const children = inline?.children ?? []
    const onlyImages =
      children.some((child) => child.type === 'image') &&
      children.every(
        (child) =>
          child.type === 'image' ||
          child.type === 'softbreak' ||
          (child.type === 'text' && child.content.trim() === ''),
      )
    if (!onlyImages) return
    const opensItem = tokens[index - 1]?.type === 'list_item_open'
    token.hidden = !opensItem
    close.hidden = !opensItem
  })
}

const markdown = new MarkdownIt('default', { html: false, linkify: false, breaks: false })
Object.assign(markdown.options, { maxNesting: 20 })
markdown.core.ruler.after('inline', 'vive_markdown', (state) => {
  markTaskLists(state)
  trimCodeEndings(state)
  unwrapImageParagraphs(state)
  return true
})

export function markdownToHtml(source: string): string {
  if (source.length > MAX_MARKDOWN_LENGTH) {
    throw new RangeError(`Markdown is longer than ${MAX_MARKDOWN_LENGTH} characters.`)
  }
  return markdown.render(source)
}
