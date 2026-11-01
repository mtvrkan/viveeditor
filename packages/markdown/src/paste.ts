import { defineExtension, type Extension } from '@viveeditor/core'
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { MAX_MARKDOWN_LENGTH } from './limits.js'

export interface MarkdownConverter {
  markdownToHtml(source: string): string
}

export interface MarkdownPasteOptions {
  load: (() => Promise<MarkdownConverter>) | null
}

interface PendingRange {
  from: number
  to: number
}

const SIGNALS = [
  /^#{1,6}[ \t]+\S/m,
  /^```/m,
  /^>[ \t]+\S/m,
  /^\|.*\|[ \t]*\n\|?[ \t]*:?-{3,}/m,
  /\*\*[^*\n]+\*\*/,
  /\[[^[\]\n]+\]\([^()\s]+\)/,
  /^[ \t]*[-*+][ \t]+\[[ xX]\][ \t]/m,
]
const LIST_LINE = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+\S/gm

export function looksLikeMarkdown(text: string): boolean {
  if (text.length > MAX_MARKDOWN_LENGTH) return false
  if (SIGNALS.some((pattern) => pattern.test(text))) return true
  return (text.match(LIST_LINE)?.length ?? 0) >= 2
}

const pendingKey = new PluginKey<Map<number, PendingRange>>('markdownPaste')
let sequence = 0

function finish(view: EditorView, id: number, insert: (view: EditorView) => void): void {
  if (view.isDestroyed) return
  const range = pendingKey.getState(view.state)?.get(id)
  view.dispatch(view.state.tr.setMeta(pendingKey, { done: id }))
  if (!range) return
  const { doc } = view.state
  const from = Math.min(range.from, doc.content.size)
  const to = Math.min(Math.max(range.to, from), doc.content.size)
  view.dispatch(view.state.tr.setSelection(TextSelection.create(doc, from, to)))
  insert(view)
}

export const MarkdownPaste: Extension<MarkdownPasteOptions> = defineExtension<MarkdownPasteOptions>(
  {
    name: 'markdownPaste',
    defaultOptions: { load: null },
    plugins: ({ options }) => [
      new Plugin<Map<number, PendingRange>>({
        key: pendingKey,
        state: {
          init: () => new Map(),
          apply: (tr, pending) => {
            const meta = tr.getMeta(pendingKey) as
              | { add: number; range: PendingRange }
              | { done: number }
              | undefined
            if (!tr.docChanged && !meta) return pending
            const next = new Map<number, PendingRange>()
            for (const [id, range] of pending) {
              next.set(id, {
                from: tr.mapping.map(range.from, -1),
                to: tr.mapping.map(range.to, 1),
              })
            }
            if (meta && 'add' in meta) next.set(meta.add, meta.range)
            if (meta && 'done' in meta) next.delete(meta.done)
            return next
          },
        },
        props: {
          handlePaste: (view, event) => {
            const data = event.clipboardData
            const load = options.load
            if (!load || !data || data.types.includes('text/html')) return false
            if (view.state.selection.$from.parent.type.spec.code) return false
            const text = data.getData('text/plain')
            if (!looksLikeMarkdown(text)) return false
            const { from, to } = view.state.selection
            sequence += 1
            const id = sequence
            view.dispatch(view.state.tr.setMeta(pendingKey, { add: id, range: { from, to } }))
            load().then(
              (converter) =>
                finish(view, id, (target) => target.pasteHTML(converter.markdownToHtml(text))),
              () => finish(view, id, (target) => target.pasteText(text)),
            )
            return true
          },
        },
      }),
    ],
  },
)
