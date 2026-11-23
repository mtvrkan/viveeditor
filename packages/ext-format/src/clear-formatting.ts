import { defineExtension, type Extension } from '@viveeditor/core'
import type { Mark } from 'prosemirror-model'
import type { Command } from 'prosemirror-state'

export interface ClearFormattingOptions {
  keepMarks: readonly string[]
  blockAttributes: readonly string[]
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    clearFormatting: () => Command
  }
}

function clearFormatting(options: ClearFormattingOptions): Command {
  return (state, dispatch) => {
    const { from, to, empty, $from } = state.selection
    const removable = (mark: Mark): boolean => !options.keepMarks.includes(mark.type.name)
    const transaction = state.tr
    let changed = false

    if (empty) {
      const marks = state.storedMarks ?? $from.marks()
      if (marks.some(removable)) {
        transaction.setStoredMarks(marks.filter((mark) => !removable(mark)))
        changed = true
      }
    } else {
      for (const type of Object.values(state.schema.marks)) {
        if (options.keepMarks.includes(type.name) || !state.doc.rangeHasMark(from, to, type)) {
          continue
        }
        transaction.removeMark(from, to, type)
        changed = true
      }
    }

    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isTextblock) return true
      const defaults = node.type.spec.attrs ?? {}
      const attrs = { ...node.attrs }
      let reset = false
      for (const name of options.blockAttributes) {
        if (!(name in attrs)) continue
        const fallback = defaults[name]?.default ?? null
        if (attrs[name] === fallback) continue
        attrs[name] = fallback
        reset = true
      }
      if (reset) {
        transaction.setNodeMarkup(pos, undefined, attrs)
        changed = true
      }
      return false
    })

    if (!changed) return false
    dispatch?.(transaction)
    return true
  }
}

export const ClearFormatting: Extension<ClearFormattingOptions> = defineExtension({
  name: 'clearFormatting',
  defaultOptions: { keepMarks: ['link'], blockAttributes: ['textAlign', 'indent'] },
  commands: ({ options }) => ({
    clearFormatting: () => clearFormatting(options),
  }),
  keymap: ({ options }) => ({ 'Mod-\\': clearFormatting(options) }),
})
