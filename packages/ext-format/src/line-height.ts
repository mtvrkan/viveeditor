import { defineExtension, type Extension } from '@viveeditor/core'
import type { Command, EditorState } from 'prosemirror-state'

export type LineHeightValue = '1' | '1.15' | '1.5' | '2'

export interface LineHeightOptions {
  types: readonly string[]
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    setLineHeight: (value: LineHeightValue | null) => Command
  }
  interface QueryRegistry {
    lineHeight: () => LineHeightValue | null
  }
}

export const LINE_HEIGHTS: readonly LineHeightValue[] = ['1', '1.15', '1.5', '2']

const PERCENT_LINE_HEIGHTS: Readonly<Record<string, LineHeightValue>> = {
  '100%': '1',
  '115%': '1.15',
  '150%': '1.5',
  '200%': '2',
}

const readLineHeight = (raw: string): LineHeightValue | null => {
  const value = raw.trim()
  if (isLineHeight(value)) return value
  return Object.hasOwn(PERCENT_LINE_HEIGHTS, value) ? (PERCENT_LINE_HEIGHTS[value] ?? null) : null
}

const isLineHeight = (value: unknown): value is LineHeightValue =>
  typeof value === 'string' && (LINE_HEIGHTS as readonly string[]).includes(value)

function lineHeightCommand(options: LineHeightOptions, value: LineHeightValue | null): Command {
  return (state, dispatch) => {
    if (value !== null && !isLineHeight(value)) return false
    const { from, to } = state.selection
    const transaction = state.tr
    let found = false
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!options.types.includes(node.type.name)) return true
      found = true
      if (node.attrs.lineHeight !== value) {
        transaction.setNodeMarkup(pos, undefined, { ...node.attrs, lineHeight: value })
      }
      return false
    })
    if (!found) return false
    dispatch?.(transaction)
    return true
  }
}

function currentLineHeight(state: EditorState, options: LineHeightOptions): LineHeightValue | null {
  const { from, to } = state.selection
  let value: LineHeightValue | null = null
  let seen = false
  state.doc.nodesBetween(from, to, (node) => {
    if (seen) return false
    if (!options.types.includes(node.type.name)) return true
    seen = true
    value = isLineHeight(node.attrs.lineHeight) ? node.attrs.lineHeight : null
    return false
  })
  return value
}

export const LineHeight: Extension<LineHeightOptions> = defineExtension({
  name: 'lineHeight',
  defaultOptions: { types: ['paragraph', 'heading'] },
  attributes: (options) => [
    {
      types: options.types,
      attributes: {
        lineHeight: {
          default: null,
          parse: (element) => readLineHeight(element.style.lineHeight),
          render: (value) => (isLineHeight(value) ? { style: `line-height: ${value}` } : null),
        },
      },
    },
  ],
  commands: ({ options }) => ({
    setLineHeight: (value: LineHeightValue | null) => lineHeightCommand(options, value),
  }),
  queries: ({ options }) => ({
    lineHeight: (state) => currentLineHeight(state, options),
  }),
})
