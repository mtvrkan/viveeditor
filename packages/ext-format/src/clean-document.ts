import { defineExtension, type Extension } from '@viveeditor/core'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import type { Command, EditorState, Transaction } from 'prosemirror-state'

export interface DocumentCleanup {
  extraSpaces: number
  trailingBreaks: number
  emptyParagraphs: number
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    cleanDocument: () => Command
  }
  interface QueryRegistry {
    documentCleanup: () => DocumentCleanup
  }
}

type Range = [number, number]

const isPlainTextblock = (node: ProseMirrorNode): boolean =>
  node.isTextblock && !node.type.spec.code

function removeRanges(transaction: Transaction, ranges: readonly Range[]): number {
  let removed = 0
  for (const [from, to] of [...ranges].sort((a, b) => b[0] - a[0])) {
    transaction.delete(from, to)
    removed += to - from
  }
  return removed
}

function extraSpaces(doc: ProseMirrorNode): Range[] {
  const ranges: Range[] = []
  const remove = (pos: number): void => {
    const last = ranges.at(-1)
    if (last && last[1] === pos) last[1] = pos + 1
    else ranges.push([pos, pos + 1])
  }
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    if (node.type.spec.code) return false
    let lineStart = true
    let kept = -1
    node.forEach((child, offset) => {
      const start = pos + 1 + offset
      if (!child.isText) {
        const lineBreak = child.type.name === 'hardBreak'
        if (lineBreak && kept >= 0) remove(kept)
        kept = -1
        lineStart = lineBreak
        return
      }
      const text = child.text ?? ''
      for (let index = 0; index < text.length; index++) {
        if (text[index] !== ' ') {
          lineStart = false
          kept = -1
        } else if (lineStart || kept >= 0) remove(start + index)
        else kept = start + index
      }
    })
    if (kept >= 0) remove(kept)
    return false
  })
  return ranges
}

function trailingBreaks(doc: ProseMirrorNode): Range[] {
  const ranges: Range[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    if (node.type.spec.code) return false
    let end = pos + node.nodeSize - 1
    for (let index = node.childCount - 1; index >= 0; index--) {
      const child = node.child(index)
      if (child.type.name !== 'hardBreak') break
      end -= child.nodeSize
    }
    if (end < pos + node.nodeSize - 1) ranges.push([end, pos + node.nodeSize - 1])
    return false
  })
  return ranges
}

function emptyParagraphs(doc: ProseMirrorNode): Range[] {
  const blocks: { node: ProseMirrorNode; pos: number; empty: boolean }[] = []
  doc.forEach((node, pos) => {
    blocks.push({ node, pos, empty: isPlainTextblock(node) && node.content.size === 0 })
  })
  const first = blocks.findIndex((block) => !block.empty)
  if (first < 0) return blocks.slice(1).map(({ node, pos }) => [pos, pos + node.nodeSize])
  const last = blocks.length - 1 - [...blocks].reverse().findIndex((block) => !block.empty)
  const keepBefore = !blocks[first]?.node.isTextblock
  const keepAfter = !blocks[last]?.node.isTextblock
  return blocks
    .filter((block, index) => {
      if (!block.empty) return false
      if (index < first) return !(keepBefore && index === first - 1)
      if (index > last) return !(keepAfter && index === last + 1)
      return blocks[index - 1]?.empty === true
    })
    .map(({ node, pos }) => [pos, pos + node.nodeSize])
}

function cleanup(state: EditorState): { transaction: Transaction; report: DocumentCleanup } {
  const transaction = state.tr
  const spaces = removeRanges(transaction, extraSpaces(transaction.doc))
  const breaks = removeRanges(transaction, trailingBreaks(transaction.doc))
  const empty = emptyParagraphs(transaction.doc)
  removeRanges(transaction, empty)
  return {
    transaction,
    report: { extraSpaces: spaces, trailingBreaks: breaks, emptyParagraphs: empty.length },
  }
}

const cleanDocument: Command = (state, dispatch) => {
  const { transaction, report } = cleanup(state)
  if (report.extraSpaces + report.trailingBreaks + report.emptyParagraphs === 0) return false
  dispatch?.(transaction)
  return true
}

export const CleanDocument: Extension<Record<string, never>> = defineExtension({
  name: 'cleanDocument',
  defaultOptions: {},
  commands: () => ({
    cleanDocument: () => cleanDocument,
  }),
  queries: () => ({
    documentCleanup: (state) => cleanup(state).report,
  }),
})
