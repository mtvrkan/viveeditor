import { defineExtension, type Extension } from '@viveeditor/core'
import type { Command, EditorState } from 'prosemirror-state'

export interface IndentOptions {
  types: readonly string[]
  skipParents: readonly string[]
  max: number
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    indent: () => Command
    outdent: () => Command
  }
  interface QueryRegistry {
    indentLevel: () => number
  }
}

const STEP_EM = 2
const LIMIT = 8

const limitOf = (options: IndentOptions): number =>
  Math.max(0, Math.min(LIMIT, Math.floor(options.max)))

function levelOf(value: unknown, options: IndentOptions): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
    ? Math.min(value, limitOf(options))
    : 0
}

function parseLevel(element: HTMLElement, options: IndentOptions): number | null {
  const match = /^(\d{1,2})em$/.exec(element.style.marginInlineStart.trim())
  const em = match ? Number(match[1]) : 0
  const level = em % STEP_EM === 0 ? em / STEP_EM : 0
  return level >= 1 && level <= limitOf(options) ? level : null
}

function eachBlock(
  state: EditorState,
  options: IndentOptions,
  visit: (level: number, pos: number) => void,
): void {
  const { from, to } = state.selection
  state.doc.nodesBetween(from, to, (node, pos, parent) => {
    if (!options.types.includes(node.type.name)) return true
    if (parent && options.skipParents.includes(parent.type.name)) return false
    visit(levelOf(node.attrs.indent, options), pos)
    return false
  })
}

function shift(options: IndentOptions, direction: 1 | -1): Command {
  return (state, dispatch) => {
    const transaction = state.tr
    let changed = false
    eachBlock(state, options, (level, pos) => {
      const next = Math.max(0, Math.min(limitOf(options), level + direction))
      if (next === level) return
      const node = transaction.doc.nodeAt(pos)
      if (!node) return
      transaction.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next || null })
      changed = true
    })
    if (!changed) return false
    dispatch?.(transaction)
    return true
  }
}

export const Indent: Extension<IndentOptions> = defineExtension({
  name: 'indent',
  defaultOptions: {
    types: ['paragraph', 'heading'],
    skipParents: ['listItem', 'taskItem'],
    max: LIMIT,
  },
  attributes: (options) => [
    {
      types: options.types,
      attributes: {
        indent: {
          default: null,
          parse: (element) => parseLevel(element, options),
          render: (value) => {
            const level = levelOf(value, options)
            return level ? { style: `margin-inline-start: ${level * STEP_EM}em` } : null
          },
        },
      },
    },
  ],
  commands: ({ options }) => ({
    indent: () => shift(options, 1),
    outdent: () => shift(options, -1),
  }),
  queries: ({ options }) => ({
    indentLevel: (state) => {
      let found = 0
      let seen = false
      eachBlock(state, options, (level) => {
        if (seen) return
        seen = true
        found = level
      })
      return found
    },
  }),
  keymap: ({ options }) => ({ 'Mod-]': shift(options, 1), 'Mod-[': shift(options, -1) }),
})
