import { defineExtension, type Extension, getNodeType } from '@viveeditor/core'
import { chainCommands, exitCode, lift, setBlockType, wrapIn } from 'prosemirror-commands'
import { InputRule, textblockTypeInputRule, wrappingInputRule } from 'prosemirror-inputrules'
import { Fragment } from 'prosemirror-model'
import { type Command, TextSelection } from 'prosemirror-state'

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface HeadingOptions {
  levels: readonly HeadingLevel[]
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    toggleHeading: (attributes: { level: HeadingLevel }) => Command
    toggleBlockquote: () => Command
    setHorizontalRule: () => Command
    setHardBreak: () => Command
  }
}

type NoOptions = Record<string, never>

const ALL_LEVELS: readonly HeadingLevel[] = [1, 2, 3, 4, 5, 6]

function closestLevel(requested: unknown, levels: readonly HeadingLevel[]): HeadingLevel {
  const value = Number(requested)
  let best = levels[0] ?? 1
  for (const level of levels) {
    if (Math.abs(level - value) < Math.abs(best - value)) best = level
  }
  return best
}

export const Heading: Extension<HeadingOptions> = defineExtension({
  name: 'heading',
  defaultOptions: { levels: ALL_LEVELS },
  nodes: (options) => ({
    heading: {
      attrs: { level: { default: options.levels[0] ?? 1 } },
      group: 'block',
      content: 'inline*',
      defining: true,
      parseDOM: ALL_LEVELS.map((level) => ({
        tag: `h${level}`,
        attrs: { level: closestLevel(level, options.levels) },
      })),
      toDOM: (node) => [`h${closestLevel(node.attrs.level, options.levels)}`, 0],
    },
  }),
  commands: ({ schema, options }) => ({
    toggleHeading:
      ({ level }) =>
      (state, dispatch, view) => {
        if (!options.levels.includes(level)) return false
        const heading = getNodeType(schema, 'heading')
        const { $from } = state.selection
        const isActive = $from.parent.type === heading && $from.parent.attrs.level === level
        const target = isActive
          ? setBlockType(getNodeType(schema, 'paragraph'))
          : setBlockType(heading, { level })
        return target(state, dispatch, view)
      },
  }),
  keymap: ({ schema, options }) =>
    Object.fromEntries(
      options.levels.map((level) => [
        `Mod-Alt-${level}`,
        setBlockType(getNodeType(schema, 'heading'), { level }),
      ]),
    ),
  inputRules: ({ schema, options }) => [
    textblockTypeInputRule(
      new RegExp(`^(#{1,${Math.max(...options.levels)}})\\s$`),
      getNodeType(schema, 'heading'),
      (match) => ({ level: closestLevel(match[1]?.length, options.levels) }),
    ),
  ],
})

export const Blockquote: Extension<NoOptions> = defineExtension({
  name: 'blockquote',
  defaultOptions: {},
  nodes: () => ({
    blockquote: {
      group: 'block',
      content: 'block+',
      defining: true,
      parseDOM: [{ tag: 'blockquote' }],
      toDOM: () => ['blockquote', 0],
    },
  }),
  commands: ({ schema }) => ({
    toggleBlockquote: () => (state, dispatch, view) => {
      const blockquote = getNodeType(schema, 'blockquote')
      const { $from } = state.selection
      for (let depth = $from.depth; depth > 0; depth--) {
        if ($from.node(depth).type === blockquote) return lift(state, dispatch)
      }
      return wrapIn(blockquote)(state, dispatch, view)
    },
  }),
  keymap: ({ schema }) => ({
    'Mod-Shift-b': wrapIn(getNodeType(schema, 'blockquote')),
  }),
  inputRules: ({ schema }) => [wrappingInputRule(/^\s*>\s$/, getNodeType(schema, 'blockquote'))],
})

export const HorizontalRule: Extension<NoOptions> = defineExtension({
  name: 'horizontalRule',
  defaultOptions: {},
  nodes: () => ({
    horizontalRule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM: () => ['hr'],
    },
  }),
  commands: ({ schema }) => ({
    setHorizontalRule: () => (state, dispatch) => {
      const rule = getNodeType(schema, 'horizontalRule').create()
      const paragraph = getNodeType(schema, 'paragraph').create()
      const { $to } = state.selection
      const insertAt = $to.depth > 0 ? $to.after(1) : $to.pos
      const content = Fragment.from([rule, paragraph])
      const $insert = state.doc.resolve(insertAt)
      if (!$insert.parent.canReplace($insert.index(), $insert.index(), content)) return false
      if (dispatch) {
        const transaction = state.tr.insert(insertAt, content)
        transaction.setSelection(TextSelection.create(transaction.doc, insertAt + 2))
        dispatch(transaction.scrollIntoView())
      }
      return true
    },
  }),
  inputRules: ({ schema }) => [
    new InputRule(/^(?:---|___|\*\*\*)$/, (state, _match, start) => {
      const $start = state.doc.resolve(start)
      if ($start.parent.type !== getNodeType(schema, 'paragraph') || $start.depth === 0) {
        return null
      }
      const rule = getNodeType(schema, 'horizontalRule').create()
      const paragraph = getNodeType(schema, 'paragraph').create()
      const container = $start.node(-1)
      const index = $start.index(-1)
      const content = Fragment.from([rule, paragraph])
      if (!container.canReplace(index, index + 1, content)) return null
      const from = $start.before()
      const transaction = state.tr.replaceWith(from, $start.after(), content)
      transaction.setSelection(TextSelection.create(transaction.doc, from + 2))
      return transaction
    }),
  ],
})

export const HardBreak: Extension<NoOptions> = defineExtension({
  name: 'hardBreak',
  defaultOptions: {},
  nodes: () => ({
    hardBreak: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br'],
    },
  }),
  commands: ({ schema }) => ({
    setHardBreak: () => (state, dispatch) => {
      const hardBreak = getNodeType(schema, 'hardBreak')
      if (!state.selection.$from.parent.inlineContent) return false
      dispatch?.(state.tr.replaceSelectionWith(hardBreak.create()).scrollIntoView())
      return true
    },
  }),
  keymap: ({ schema }) => {
    const insertBreak: Command = (state, dispatch) => {
      dispatch?.(
        state.tr.replaceSelectionWith(getNodeType(schema, 'hardBreak').create()).scrollIntoView(),
      )
      return true
    }
    const command = chainCommands(exitCode, insertBreak)
    return { 'Shift-Enter': command, 'Mod-Enter': command }
  },
})
