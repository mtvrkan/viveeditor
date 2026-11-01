import { defineExtension, type Extension } from '@viveeditor/core'
import { InputRule } from 'prosemirror-inputrules'
import type { NodeSpec, NodeType } from 'prosemirror-model'
import { type Command, type EditorState, NodeSelection, Plugin } from 'prosemirror-state'
import { cleanLatex, type KatexLoader, katexLoader, type MathError } from './katex.js'
import { type MathLabels, MathView, mathViewOf } from './view.js'

export {
  isSupportedKatex,
  type KatexLike,
  type KatexLoader,
  type KatexModule,
  MAX_LATEX_LENGTH,
  type MathError,
  type MathErrorCode,
  MIN_KATEX_VERSION,
} from './katex.js'
export type { MathLabels } from './view.js'

export interface MathOptions {
  load: KatexLoader | null
  labels: MathLabels
  onError: ((error: MathError) => void) | null
}

export interface InsertMathOptions {
  display?: boolean
  latex?: string
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    insertMath: (options?: InsertMathOptions) => Command
  }
}

const latexAttrs = {
  latex: {
    default: '',
    validate: (value: unknown) => {
      if (cleanLatex(value) === null) throw new RangeError('Invalid formula')
    },
  },
}

const latexOf = (dom: HTMLElement): { latex: string } | false => {
  const latex = cleanLatex(dom.textContent?.trim() ?? '')
  return latex ? { latex } : false
}

const mathSpecs = (): Record<string, NodeSpec> => ({
  mathInline: {
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    attrs: latexAttrs,
    parseDOM: [{ tag: 'span[data-math="inline"]', priority: 60, getAttrs: latexOf }],
    toDOM: (node) => ['span', { 'data-math': 'inline' }, cleanLatex(node.attrs.latex) ?? ''],
    leafText: (node) => `$${cleanLatex(node.attrs.latex) ?? ''}$`,
  },
  mathBlock: {
    group: 'block',
    atom: true,
    selectable: true,
    attrs: latexAttrs,
    parseDOM: [{ tag: 'div[data-math="block"]', priority: 60, getAttrs: latexOf }],
    toDOM: (node) => ['div', { 'data-math': 'block' }, cleanLatex(node.attrs.latex) ?? ''],
  },
})

function blockInsertion(state: EditorState): number | null {
  const { $from } = state.selection
  if ($from.depth === 0 || !$from.parent.isTextblock) return null
  return $from.parent.content.size === 0 ? $from.before() : $from.after()
}

function insertMath(inline: NodeType, block: NodeType) {
  return (options: InsertMathOptions = {}): Command =>
    (state, dispatch, view) => {
      if (view && !view.editable) return false
      const latex = cleanLatex(options.latex ?? '')
      const { $from } = state.selection
      if (latex === null || $from.parent.type.spec.code) return false
      if (!options.display) {
        if (!$from.parent.inlineContent) return false
        if (dispatch) {
          const transaction = state.tr.replaceSelectionWith(inline.create({ latex }), false)
          const pos = transaction.selection.from - 1
          dispatch(
            transaction.setSelection(NodeSelection.create(transaction.doc, pos)).scrollIntoView(),
          )
        }
        return true
      }
      const pos = blockInsertion(state)
      if (pos === null) return false
      const $pos = state.doc.resolve(pos)
      if (!$pos.parent.canReplaceWith($pos.index(), $pos.index(), block)) return false
      if (dispatch) {
        const node = block.create({ latex })
        const empty = $from.parent.content.size === 0
        const transaction = empty
          ? state.tr.replaceWith(pos, pos + $from.parent.nodeSize, node)
          : state.tr.insert(pos, node)
        dispatch(
          transaction.setSelection(NodeSelection.create(transaction.doc, pos)).scrollIntoView(),
        )
      }
      return true
    }
}

export const MathExtension: Extension<MathOptions> = defineExtension<MathOptions>({
  name: 'math',
  defaultOptions: {
    load: null,
    labels: { empty: 'Formula', edit: 'LaTeX formula' },
    onError: null,
  },
  nodes: () => mathSpecs(),
  commands: ({ schema }) => ({
    insertMath: insertMath(schema.nodes.mathInline as NodeType, schema.nodes.mathBlock as NodeType),
  }),
  keymap: ({ schema }) => {
    const block = schema.nodes.mathBlock as NodeType
    const inline = schema.nodes.mathInline as NodeType
    const enter: Command = (state, dispatch, view) => {
      const { selection } = state
      if (selection instanceof NodeSelection && [inline, block].includes(selection.node.type)) {
        if (dispatch && view) mathViewOf(view.nodeDOM(selection.from))?.open()
        return true
      }
      const { $from } = selection
      if (!selection.empty || $from.parent.type !== schema.nodes.paragraph) return false
      if ($from.parent.textContent !== '$$' || $from.parentOffset !== 2) return false
      const pos = $from.before()
      if (!$from.node(-1).canReplaceWith($from.index(-1), $from.indexAfter(-1), block)) return false
      if (view && !view.editable) return false
      if (dispatch) {
        const transaction = state.tr.replaceWith(pos, $from.after(), block.create())
        dispatch(
          transaction.setSelection(NodeSelection.create(transaction.doc, pos)).scrollIntoView(),
        )
      }
      return true
    }
    return { Enter: enter }
  },
  inputRules: ({ schema }) => [
    new InputRule(/(^|[^$\\\w])\$([^$\s](?:[^$]*[^$\s\\])?)\$$/, (state, match, start, end) => {
      const latex = cleanLatex(match[2])
      if (!latex || !state.selection.$from.parent.inlineContent) return null
      const from = start + (match[1]?.length ?? 0)
      return state.tr.replaceWith(
        from,
        end,
        (schema.nodes.mathInline as NodeType).create({ latex }),
      )
    }),
  ],
  plugins: ({ options }) => {
    const report = (error: MathError): void => options.onError?.(error)
    const settings = { katex: katexLoader(options.load, report), labels: options.labels }
    return [
      new Plugin({
        props: {
          nodeViews: {
            mathInline: (node, view, getPos) => new MathView(node, view, getPos, settings),
            mathBlock: (node, view, getPos) => new MathView(node, view, getPos, settings),
          },
        },
      }),
    ]
  },
})
