import { defineExtension, type Extension } from '@viveeditor/core'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { Plugin, type Transaction } from 'prosemirror-state'

export interface CharacterCountOptions {
  limit: number | null
}

declare module '@viveeditor/core' {
  interface QueryRegistry {
    characterCount: () => number
    characterLimit: () => number | null
  }
}

const counts = new WeakMap<ProseMirrorNode, number>()

function codePoints(text: string): number {
  let count = text.length
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    if (code >= 0xdc00 && code <= 0xdfff) count--
  }
  return count
}

export function countCharacters(node: ProseMirrorNode): number {
  if (node.isText) return codePoints(node.text ?? '')
  const cached = counts.get(node)
  if (cached !== undefined) return cached
  let total = 0
  node.forEach((child) => {
    total += countCharacters(child)
  })
  counts.set(node, total)
  return total
}

const validLimit = (limit: unknown): number | null =>
  typeof limit === 'number' && Number.isInteger(limit) && limit > 0 ? limit : null

function trimBeforeCursor(transaction: Transaction, allowed: number): boolean {
  for (let attempt = 0; attempt < 20; attempt++) {
    const over = countCharacters(transaction.doc) - allowed
    if (over <= 0) return true
    const { $head } = transaction.selection
    let from = Math.max($head.start(), $head.pos - over)
    const first = transaction.doc.textBetween(from, from + 1).charCodeAt(0)
    if (first >= 0xdc00 && first <= 0xdfff && from > $head.start()) from--
    if (from >= $head.pos) return false
    transaction.delete(from, $head.pos)
  }
  return countCharacters(transaction.doc) <= allowed
}

export const CharacterCount: Extension<CharacterCountOptions> = defineExtension({
  name: 'characterCount',
  defaultOptions: { limit: null },
  queries: ({ options }) => ({
    characterCount: (state) => countCharacters(state.doc),
    characterLimit: () => validLimit(options.limit),
  }),
  plugins: ({ options }) => {
    const limit = validLimit(options.limit)
    if (limit === null) return []
    return [
      new Plugin({
        filterTransaction: (transaction, state) => {
          if (!transaction.docChanged || transaction.getMeta('addToHistory') === false) return true
          const next = countCharacters(transaction.doc)
          if (next <= limit) return true
          const current = countCharacters(state.doc)
          if (next <= current) return true
          const event = transaction.getMeta('uiEvent')
          if (event !== 'paste' && event !== 'drop') return false
          return trimBeforeCursor(transaction, Math.max(limit, current))
        },
      }),
    ]
  },
})
