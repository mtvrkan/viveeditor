import { selectAll, setBlockType } from 'prosemirror-commands'
import { closeHistory, history, redo, undo } from 'prosemirror-history'
import { undoInputRule } from 'prosemirror-inputrules'
import { type Mark, type Node as ProseMirrorNode, Slice } from 'prosemirror-model'
import { type EditorState, Plugin, TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { parseContent } from './content.js'
import { defineExtension, type Extension } from './extension.js'
import { cleanPastedHtml } from './paste.js'
import { getNodeType } from './schema-utils.js'

function readableText(doc: ProseMirrorNode, from: number, to: number): string {
  let text = ''
  let first = true
  doc.nodesBetween(from, to, (node, pos) => {
    const holdsRange = pos < from && pos + node.nodeSize > to
    if (node.isInline && !node.isLeaf && !holdsRange) return false
    const nodeText = node.isText
      ? (node.text ?? '').slice(Math.max(from, pos) - pos, to - pos)
      : node.isLeaf
        ? ' '
        : ''
    if (node.isBlock && (node.isTextblock || (node.isLeaf && nodeText))) {
      if (first) first = false
      else text += '\n'
    }
    text += nodeText
    return true
  })
  return text
}

function marksOfSelection(state: EditorState): readonly Mark[] {
  if (state.storedMarks) return state.storedMarks
  const { from, to } = state.selection
  let marks: readonly Mark[] = []
  let found = false
  state.doc.nodesBetween(from, to, (node) => {
    if (found) return false
    if (node.isText) {
      marks = node.marks
      found = true
    }
    return !found
  })
  return marks
}

function replaceSelectionKeepingMarks(view: EditorView, text: string): void {
  const node = view.state.schema.text(text, marksOfSelection(view.state))
  view.dispatch(view.state.tr.replaceSelectionWith(node, false).scrollIntoView())
}

const preserveMarksOnReplace = new Plugin({
  props: {
    handleTextInput: (view, from, to, text) => {
      const { selection } = view.state
      if (selection.empty || selection.from !== from || selection.to !== to) return false
      replaceSelectionKeepingMarks(view, text)
      return true
    },
    handleDOMEvents: {
      beforeinput: (view, event) => {
        if (event.inputType !== 'insertText' || event.isComposing || view.composing) return false
        if (view.state.selection.empty || !event.data) return false
        event.preventDefault()
        replaceSelectionKeepingMarks(view, event.data)
        return true
      },
    },
  },
})

const pasteCleanup = new Plugin({
  props: {
    transformPastedHTML: (html) => cleanPastedHtml(html),
  },
})

export const Base: Extension<Record<string, never>> = defineExtension({
  name: 'base',
  priority: 0,
  defaultOptions: {},
  nodes: () => ({
    doc: { content: 'block+' },
    paragraph: {
      group: 'block',
      content: 'inline*',
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0],
    },
    text: { group: 'inline' },
  }),
  commands: ({ schema }) => ({
    selectAll: () => selectAll,
    undo: () => undo,
    redo: () => redo,
    setParagraph: () => setBlockType(getNodeType(schema, 'paragraph')),
    deleteRange: (from: number, to: number) => (state, dispatch) => {
      if (from < 0 || from > to || to > state.doc.content.size) return false
      dispatch?.(state.tr.delete(from, to).scrollIntoView())
      return true
    },
    replaceContent: (content) => (state, dispatch) => {
      let doc: ProseMirrorNode
      try {
        doc = parseContent(schema, content)
      } catch {
        return false
      }
      if (dispatch && !doc.eq(state.doc)) {
        dispatch(closeHistory(state.tr.replaceWith(0, state.doc.content.size, doc.content)))
      }
      return true
    },
    insertContent: (content) => (state, dispatch) => {
      let doc: ProseMirrorNode
      try {
        doc = parseContent(schema, content)
      } catch {
        return false
      }
      if (doc.content.size === 0) return false
      if (dispatch) {
        const transaction = state.tr.replaceSelection(new Slice(doc.content, 0, 0))
        dispatch(closeHistory(transaction).scrollIntoView())
      }
      return true
    },
    insertText: (text: string) => (state, dispatch, view) => {
      if (typeof text !== 'string' || text === '' || view?.editable === false) return false
      dispatch?.(closeHistory(state.tr.insertText(text)).scrollIntoView())
      return true
    },
    setTextSelection:
      (from: number, to: number = from) =>
      (state, dispatch) => {
        const size = state.doc.content.size
        if (![from, to].every((pos) => Number.isInteger(pos) && pos >= 0 && pos <= size)) {
          return false
        }
        const selection = TextSelection.between(state.doc.resolve(from), state.doc.resolve(to))
        dispatch?.(state.tr.setSelection(selection).scrollIntoView())
        return true
      },
  }),
  queries: () => ({
    selectedText: (state) => {
      const { from, to } = state.selection
      return readableText(state.doc, from, to)
    },
    textBetween: (state, from, to) => {
      const size = state.doc.content.size
      const start = Math.min(size, Math.max(0, Math.trunc(from) || 0))
      const end = Math.min(size, Math.max(start, Math.trunc(to) || 0))
      return readableText(state.doc, start, end)
    },
  }),
  keymap: () => ({
    'Mod-z': undo,
    'Shift-Mod-z': redo,
    'Mod-y': redo,
    Backspace: undoInputRule,
  }),
  plugins: () => [history(), preserveMarksOnReplace, pasteCleanup],
})
