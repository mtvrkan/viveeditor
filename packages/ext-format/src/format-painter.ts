import { defineExtension, type Extension } from '@viveeditor/core'
import type { Mark } from 'prosemirror-model'
import {
  type Command,
  type EditorState,
  Plugin,
  PluginKey,
  type Selection,
  type Transaction,
} from 'prosemirror-state'

export interface FormatPainterOptions {
  keepMarks: readonly string[]
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    copyFormat: () => Command
    applyFormat: () => Command
    cancelFormat: () => Command
  }
  interface QueryRegistry {
    isPaintingFormat: () => boolean
  }
}

type Copied = readonly Mark[] | null

interface PaintTarget {
  readonly state: EditorState
  readonly isDestroyed: boolean
  dispatch: (transaction: Transaction) => void
}

const painterKey = new PluginKey<Copied>('formatPainter')

function selectionMarks(state: EditorState): readonly Mark[] {
  const { empty, from, to, $from } = state.selection
  if (empty) return state.storedMarks ?? $from.marks()
  let found: readonly Mark[] | undefined
  state.doc.nodesBetween(from, to, (node) => {
    if (found) return false
    if (node.isText) found = node.marks
    return !found
  })
  return found ?? $from.marks()
}

const setCopied =
  (copied: Copied): Command =>
  (state, dispatch) => {
    dispatch?.(state.tr.setMeta(painterKey, copied))
    return true
  }

function applyFormat(options: FormatPainterOptions): Command {
  return (state, dispatch) => {
    const copied = painterKey.getState(state)
    const { from, to, empty } = state.selection
    if (!copied || empty) return false
    if (dispatch) {
      const transaction = state.tr
      for (const type of Object.values(state.schema.marks)) {
        if (!options.keepMarks.includes(type.name)) transaction.removeMark(from, to, type)
      }
      for (const mark of copied) {
        if (!options.keepMarks.includes(mark.type.name)) transaction.addMark(from, to, mark)
      }
      dispatch(transaction.setMeta(painterKey, null))
    }
    return true
  }
}

function painterPlugin(options: FormatPainterOptions): Plugin<Copied> {
  const apply = applyFormat(options)
  let pointer = false
  let dragging = false
  let source: Selection | null = null
  const tryApply = (view: PaintTarget): void => {
    if (view.isDestroyed || (source && view.state.selection.eq(source))) return
    apply(view.state, view.dispatch)
  }
  return new Plugin<Copied>({
    key: painterKey,
    state: {
      init: () => null,
      apply: (transaction, copied) => {
        const meta: Copied | undefined = transaction.getMeta(painterKey)
        return meta === undefined ? copied : meta
      },
    },
    view: () => ({
      update: (view, previous) => {
        if (!painterKey.getState(previous)) {
          pointer = false
          source = view.state.selection
        } else if (pointer && !dragging && !view.state.selection.eq(previous.selection))
          tryApply(view)
      },
    }),
    props: {
      attributes: (state): Record<string, string> =>
        painterKey.getState(state) ? { class: 'vive-format-painter' } : {},
      handleKeyDown: (view, event) => {
        pointer = false
        if (event.key !== 'Escape' || !painterKey.getState(view.state)) return false
        view.dispatch(view.state.tr.setMeta(painterKey, null))
        return true
      },
      handleDOMEvents: {
        mousedown: () => {
          pointer = true
          dragging = true
          return false
        },
        mouseup: (view) => {
          dragging = false
          if (pointer) setTimeout(() => tryApply(view), 0)
          return false
        },
        keyup: (view, event) => {
          if (event.key === 'Shift') tryApply(view)
          return false
        },
      },
    },
  })
}

export const FormatPainter: Extension<FormatPainterOptions> = defineExtension({
  name: 'formatPainter',
  defaultOptions: { keepMarks: ['link'] },
  commands: ({ options }) => ({
    copyFormat: () => (state, dispatch) =>
      setCopied(
        painterKey.getState(state)
          ? null
          : selectionMarks(state).filter((mark) => !options.keepMarks.includes(mark.type.name)),
      )(state, dispatch),
    applyFormat: () => applyFormat(options),
    cancelFormat: () => (state, dispatch) =>
      painterKey.getState(state) ? setCopied(null)(state, dispatch) : false,
  }),
  queries: () => ({
    isPaintingFormat: (state) => painterKey.getState(state) !== null,
  }),
  plugins: ({ options }) => [painterPlugin(options)],
})
