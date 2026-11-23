import { defineExtension, type Extension } from '@viveeditor/core'
import { Fragment, type Node as ProseMirrorNode, Slice } from 'prosemirror-model'
import {
  type Command,
  type EditorState,
  Plugin,
  PluginKey,
  TextSelection,
  type Transaction,
} from 'prosemirror-state'

export type PasteMode = 'keep' | 'clean' | 'plain'

type Step = Transaction['steps'][number]

export interface PasteOptionsSettings {
  keepMarks: readonly string[]
}

export interface LastPaste {
  from: number
  to: number
  mode: PasteMode
  hasText: boolean
}

interface Clipboard {
  html: string
  text: string
}

interface PasteState extends Clipboard {
  from: number
  to: number
  mode: PasteMode
  anchor: number
  head: number
  inverse: readonly Step[]
}

interface Redo {
  mode: PasteMode
  restored: number
}

interface PasteView {
  readonly state: EditorState
  dispatch(transaction: Transaction): void
  pasteHTML(html: string): boolean
}

type Repaste = (view: PasteView, paste: PasteState, mode: PasteMode) => void

declare module '@viveeditor/core' {
  interface CommandRegistry {
    pasteAs: (mode: PasteMode) => Command
    dismissPaste: () => Command
  }
  interface QueryRegistry {
    lastPaste: () => LastPaste | null
  }
}

const pasteKey = new PluginKey<PasteState | null>('pasteOptions')
const DISMISS = 'dismiss'

const isMode = (mode: unknown): mode is PasteMode =>
  mode === 'keep' || mode === 'clean' || mode === 'plain'

function stripMarks(fragment: Fragment, keep: readonly string[]): Fragment {
  const nodes: ProseMirrorNode[] = []
  let changed = false
  fragment.forEach((node) => {
    const marks = node.marks.filter((mark) => keep.includes(mark.type.name))
    const content = stripMarks(node.content, keep)
    const same = marks.length === node.marks.length && content === node.content
    changed ||= !same
    nodes.push(
      same ? node : node.isText ? node.mark(marks) : node.type.create(node.attrs, content, marks),
    )
  })
  return changed ? Fragment.from(nodes) : fragment
}

function insertPlainText(transaction: Transaction, text: string): void {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  transaction.deleteSelection()
  const { $from } = transaction.selection
  const paragraph = transaction.doc.type.schema.nodes.paragraph
  if ($from.parent.type.spec.code) {
    transaction.insertText(lines.join('\n'))
    return
  }
  const after = $from.depth > 0 ? $from.index(-1) + 1 : -1
  if (!paragraph || after < 0 || !$from.node(-1).canReplaceWith(after, after, paragraph)) {
    const joined = lines.filter(Boolean).join(' ')
    if (joined) transaction.insertText(joined)
    return
  }
  lines.forEach((line, index) => {
    if (index > 0) transaction.split(transaction.selection.from, 1, [{ type: paragraph }])
    if (line) transaction.insertText(line)
  })
}

function inverseSteps(transaction: Transaction, start: number): Step[] {
  const inverse: Step[] = []
  for (let index = transaction.steps.length - 1; index >= start; index--) {
    const step = transaction.steps[index]
    const doc = transaction.docs[index]
    if (step && doc) inverse.push(step.invert(doc))
  }
  return inverse
}

function pastePlugin(options: PasteOptionsSettings): Plugin<PasteState | null> {
  let captured: Clipboard | null = null
  let pending: ((slice: Slice) => void) | null = null

  const repaste: Repaste = (view, paste, mode) => {
    const build = (slice: Slice | null): void => {
      const transaction = view.state.tr
      for (const step of paste.inverse) {
        if (transaction.maybeStep(step).failed) return
      }
      const restored = transaction.steps.length
      const { doc } = transaction
      transaction.setSelection(
        TextSelection.between(doc.resolve(paste.anchor), doc.resolve(paste.head)),
      )
      if (slice) transaction.replaceSelection(slice)
      else insertPlainText(transaction, paste.text)
      captured = { html: paste.html, text: paste.text }
      const redo: Redo = { mode, restored }
      try {
        view.dispatch(
          transaction
            .scrollIntoView()
            .setMeta('paste', true)
            .setMeta('uiEvent', 'paste')
            .setMeta(pasteKey, redo),
        )
      } finally {
        captured = null
      }
    }
    if (mode === 'plain') {
      build(null)
      return
    }
    pending = (slice) => {
      build(
        mode === 'clean'
          ? new Slice(stripMarks(slice.content, options.keepMarks), slice.openStart, slice.openEnd)
          : slice,
      )
    }
    try {
      view.pasteHTML(paste.html)
    } finally {
      pending = null
    }
  }

  return new Plugin<PasteState | null>({
    key: pasteKey,
    repaste,
    state: {
      init: () => null,
      apply: (transaction, value, previous) => {
        const meta: Redo | typeof DISMISS | undefined = transaction.getMeta(pasteKey)
        if (meta === DISMISS) return null
        if (transaction.getMeta('uiEvent') === 'paste' && captured) {
          const redo = typeof meta === 'object' && value ? meta : null
          const start = redo?.restored ?? 0
          const anchor = redo && value ? value.anchor : previous.selection.anchor
          const head = redo && value ? value.head : previous.selection.head
          return {
            ...captured,
            mode: redo?.mode ?? 'keep',
            anchor,
            head,
            inverse: inverseSteps(transaction, start),
            from: transaction.mapping.slice(start).map(Math.min(anchor, head), -1),
            to: transaction.selection.to,
          }
        }
        if (!transaction.docChanged) return value
        if (!value || !transaction.getMeta('appendedTransaction')) return null
        return {
          ...value,
          inverse: [...inverseSteps(transaction, 0), ...value.inverse],
          from: transaction.mapping.map(value.from, -1),
          to: transaction.mapping.map(value.to),
        }
      },
    },
    props: {
      handleDOMEvents: {
        paste: (_view, event) => {
          const html = event.clipboardData?.getData('text/html') ?? ''
          captured = html ? { html, text: event.clipboardData?.getData('text/plain') ?? '' } : null
          queueMicrotask(() => {
            captured = null
          })
          return false
        },
      },
      handlePaste: (_view, _event, slice) => {
        if (!pending) return false
        pending(slice)
        return true
      },
    },
  })
}

export const PasteOptions: Extension<PasteOptionsSettings> = defineExtension({
  name: 'pasteOptions',
  priority: 1000,
  defaultOptions: { keepMarks: ['link'] },
  commands: () => ({
    pasteAs: (mode: PasteMode) => (state, dispatch, view) => {
      const paste = pasteKey.getState(state)
      if (!paste || !view?.editable || state.doc !== view.state.doc) return false
      if (!isMode(mode) || (mode === 'plain' && !paste.text)) return false
      if (!dispatch) return true
      const spec = pasteKey.get(state)?.spec as { repaste?: Repaste } | undefined
      spec?.repaste?.(view, paste, mode)
      return true
    },
    dismissPaste: () => (state, dispatch) => {
      if (!pasteKey.getState(state)) return false
      dispatch?.(state.tr.setMeta(pasteKey, DISMISS))
      return true
    },
  }),
  queries: () => ({
    lastPaste: (state) => {
      const paste = pasteKey.getState(state)
      return paste
        ? { from: paste.from, to: paste.to, mode: paste.mode, hasText: paste.text !== '' }
        : null
    },
  }),
  plugins: ({ options }) => [pastePlugin(options)],
})
