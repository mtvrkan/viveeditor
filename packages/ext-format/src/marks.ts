import type { Attrs, MarkType, Node as ProseMirrorNode } from 'prosemirror-model'
import type { Command, EditorState, SelectionRange } from 'prosemirror-state'

function markApplies(
  doc: ProseMirrorNode,
  ranges: readonly SelectionRange[],
  type: MarkType,
): boolean {
  for (const { $from, $to } of ranges) {
    let allowed = $from.depth === 0 ? doc.inlineContent && doc.type.allowsMarkType(type) : false
    doc.nodesBetween($from.pos, $to.pos, (node) => {
      if (allowed) return false
      allowed = node.inlineContent && node.type.allowsMarkType(type)
      return true
    })
    if (allowed) return true
  }
  return false
}

function cursorAllows(state: EditorState, type: MarkType): boolean {
  const { $from } = state.selection
  return $from.parent.inlineContent && $from.parent.type.allowsMarkType(type)
}

export function setMark(type: MarkType, attrs: Attrs): Command {
  return (state, dispatch) => {
    const { empty, ranges } = state.selection
    if (empty) {
      if (!cursorAllows(state, type)) return false
      dispatch?.(state.tr.addStoredMark(type.create(attrs)))
      return true
    }
    if (!markApplies(state.doc, ranges, type)) return false
    if (dispatch) {
      const transaction = state.tr
      for (const { $from, $to } of ranges) {
        transaction.addMark($from.pos, $to.pos, type.create(attrs))
      }
      dispatch(transaction.scrollIntoView())
    }
    return true
  }
}

export function unsetMark(type: MarkType): Command {
  return (state, dispatch) => {
    const { empty, ranges } = state.selection
    if (empty) {
      if (!cursorAllows(state, type)) return false
      dispatch?.(state.tr.removeStoredMark(type))
      return true
    }
    if (!markApplies(state.doc, ranges, type)) return false
    if (dispatch) {
      const transaction = state.tr
      for (const { $from, $to } of ranges) transaction.removeMark($from.pos, $to.pos, type)
      dispatch(transaction.scrollIntoView())
    }
    return true
  }
}

export function hasMark(state: EditorState, type: MarkType): boolean {
  const { empty, from, to, $from } = state.selection
  if (empty) return type.isInSet(state.storedMarks ?? $from.marks()) !== undefined
  return state.doc.rangeHasMark(from, to, type)
}
