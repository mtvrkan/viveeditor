import { defineExtension, type Extension } from '@viveeditor/core'
import type { Command, EditorState } from 'prosemirror-state'

export type TextAlignment = 'left' | 'center' | 'right' | 'justify'

export interface TextAlignOptions {
  types: readonly string[]
  alignments: readonly TextAlignment[]
  defaultAlignment: TextAlignment
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    setTextAlign: (alignment: TextAlignment) => Command
    unsetTextAlign: () => Command
  }
  interface QueryRegistry {
    textAlign: () => TextAlignment
  }
}

const isAlignment = (value: unknown, options: TextAlignOptions): value is TextAlignment =>
  typeof value === 'string' && (options.alignments as readonly string[]).includes(value)

function alignCommand(options: TextAlignOptions, alignment: TextAlignment | null): Command {
  return (state, dispatch) => {
    if (alignment !== null && !isAlignment(alignment, options)) return false
    const value = alignment === options.defaultAlignment ? null : alignment
    const { from, to } = state.selection
    const transaction = state.tr
    let found = false
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!options.types.includes(node.type.name)) return true
      found = true
      if (node.attrs.textAlign !== value) {
        transaction.setNodeMarkup(pos, undefined, { ...node.attrs, textAlign: value })
      }
      return false
    })
    if (!found) return false
    dispatch?.(transaction)
    return true
  }
}

function currentAlignment(state: EditorState, options: TextAlignOptions): TextAlignment {
  const { from, to } = state.selection
  let alignment: TextAlignment | null = null
  state.doc.nodesBetween(from, to, (node) => {
    if (alignment !== null) return false
    if (!options.types.includes(node.type.name)) return true
    alignment = isAlignment(node.attrs.textAlign, options)
      ? node.attrs.textAlign
      : options.defaultAlignment
    return false
  })
  return alignment ?? options.defaultAlignment
}

export const TextAlign: Extension<TextAlignOptions> = defineExtension({
  name: 'textAlign',
  defaultOptions: {
    types: ['paragraph', 'heading'],
    alignments: ['left', 'center', 'right', 'justify'],
    defaultAlignment: 'left',
  },
  attributes: (options) => [
    {
      types: options.types,
      attributes: {
        textAlign: {
          default: null,
          parse: (element) => {
            const value = (element.style.textAlign || element.getAttribute('align') || '')
              .trim()
              .toLowerCase()
            return isAlignment(value, options) && value !== options.defaultAlignment ? value : null
          },
          render: (value) =>
            isAlignment(value, options) && value !== options.defaultAlignment
              ? { style: `text-align: ${value}` }
              : null,
        },
      },
    },
  ],
  commands: ({ options }) => ({
    setTextAlign: (alignment: TextAlignment) => alignCommand(options, alignment),
    unsetTextAlign: () => alignCommand(options, null),
  }),
  queries: ({ options }) => ({
    textAlign: (state) => currentAlignment(state, options),
  }),
  keymap: ({ options }) => {
    const bindings: Record<string, Command> = {}
    const keys: Record<TextAlignment, string> = {
      left: 'Mod-Shift-l',
      center: 'Mod-Shift-e',
      right: 'Mod-Shift-r',
      justify: 'Mod-Shift-j',
    }
    for (const alignment of options.alignments) {
      bindings[keys[alignment]] = alignCommand(options, alignment)
    }
    return bindings
  },
})
