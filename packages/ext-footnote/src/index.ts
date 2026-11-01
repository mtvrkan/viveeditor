import { defineExtension, type Extension } from '@viveeditor/core'
import {
  DOMParser as ContentParser,
  Fragment,
  type Mark,
  type NodeSpec,
  type NodeType,
  type Node as ProseMirrorNode,
  type Schema,
} from 'prosemirror-model'
import { type Command, NodeSelection, Plugin } from 'prosemirror-state'
import { type FootnoteLabels, FootnoteView, MAX_FOOTNOTE_LENGTH } from './view.js'

export type { FootnoteLabels } from './view.js'
export { MAX_FOOTNOTE_LENGTH } from './view.js'

export interface FootnoteOptions {
  labels: FootnoteLabels
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    insertFootnote: () => Command
  }
}

const ALLOWED_MARKS = new Set(['bold', 'italic', 'link'])

const keepMarks = (marks: readonly Mark[]): readonly Mark[] =>
  marks.filter((mark) => ALLOWED_MARKS.has(mark.type.name))

function footnoteContent(dom: HTMLElement, schema: Schema): Fragment {
  const parsed = ContentParser.fromSchema(schema).parseSlice(dom).content
  const texts: ProseMirrorNode[] = []
  let length = 0
  parsed.descendants((node) => {
    if (length >= MAX_FOOTNOTE_LENGTH) return false
    if (!node.isText && !node.isLeaf) return true
    const value = (node.isText ? node.text : node.textContent) ?? ''
    const text = value.slice(0, MAX_FOOTNOTE_LENGTH - length)
    if (text) {
      texts.push(schema.text(text, node.isText ? keepMarks(node.marks) : []))
      length += text.length
    }
    return false
  })
  return Fragment.fromArray(texts)
}

const footnoteSpec = (): NodeSpec => ({
  group: 'inline',
  inline: true,
  atom: true,
  content: 'text*',
  marks: '_',
  parseDOM: [
    {
      tag: 'sup[data-footnote]',
      priority: 60,
      getContent: (dom, schema) => footnoteContent(dom as HTMLElement, schema),
    },
  ],
  toDOM: () => ['sup', { 'data-footnote': '' }, 0],
})

function strayMarks(doc: ProseMirrorNode, type: NodeType): Array<[number, number, Mark]> {
  const found: Array<[number, number, Mark]> = []
  doc.descendants((node, pos) => {
    if (node.type !== type) return true
    for (const mark of node.marks) {
      if (mark.type.name === 'link') found.push([pos, pos + node.nodeSize, mark])
    }
    node.forEach((child, offset) => {
      for (const mark of child.marks) {
        if (!ALLOWED_MARKS.has(mark.type.name)) {
          const from = pos + 1 + offset
          found.push([from, from + child.nodeSize, mark])
        }
      }
    })
    return false
  })
  return found
}

export const Footnote: Extension<FootnoteOptions> = defineExtension<FootnoteOptions>({
  name: 'footnote',
  defaultOptions: { labels: { footnote: 'Footnote', edit: 'Footnote text' } },
  nodes: () => ({ footnote: footnoteSpec() }),
  commands: ({ schema }) => {
    const type = schema.nodes.footnote as NodeType
    return {
      insertFootnote: (): Command => (state, dispatch, view) => {
        if (view && !view.editable) return false
        const { $from } = state.selection
        if (!$from.parent.inlineContent || $from.parent.type.spec.code) return false
        if (!$from.parent.canReplaceWith($from.index(), $from.indexAfter(), type)) return false
        if ($from.marks().some((mark) => mark.type.name === 'link')) return false
        if (dispatch) {
          const transaction = state.tr.replaceSelectionWith(type.create(), false)
          const pos = transaction.mapping.map(state.selection.from, -1)
          dispatch(
            transaction.setSelection(NodeSelection.create(transaction.doc, pos)).scrollIntoView(),
          )
        }
        return true
      },
    }
  },
  plugins: ({ schema, options }) => {
    const type = schema.nodes.footnote as NodeType
    return [
      new Plugin({
        props: {
          nodeViews: {
            footnote: (node, view, getPos) => new FootnoteView(node, view, getPos, options.labels),
          },
        },
        appendTransaction: (transactions, _old, state) => {
          if (!transactions.some((transaction) => transaction.docChanged)) return null
          const marks = strayMarks(state.doc, type)
          if (marks.length === 0) return null
          const transaction = state.tr
          for (const [from, to, mark] of marks) transaction.removeMark(from, to, mark)
          return transaction
        },
      }),
    ]
  },
})
