import { defineExtension, type Extension, getMarkType } from '@viveeditor/core'
import type { MarkType } from 'prosemirror-model'
import type { Command } from 'prosemirror-state'
import { hasMark, setMark, unsetMark } from './marks.js'

declare module '@viveeditor/core' {
  interface CommandRegistry {
    toggleSubscript: () => Command
    toggleSuperscript: () => Command
  }
}

type NoOptions = Record<string, never>

const EXCLUDES = 'subscript superscript'

const toggle =
  (type: MarkType): Command =>
  (state, dispatch) =>
    hasMark(state, type) ? unsetMark(type)(state, dispatch) : setMark(type, {})(state, dispatch)

export const Subscript: Extension<NoOptions> = defineExtension({
  name: 'subscript',
  defaultOptions: {},
  marks: () => ({
    subscript: {
      excludes: EXCLUDES,
      parseDOM: [{ tag: 'sub' }, { style: 'vertical-align=sub' }],
      toDOM: () => ['sub', 0],
    },
  }),
  commands: ({ schema }) => ({
    toggleSubscript: () => toggle(getMarkType(schema, 'subscript')),
  }),
  keymap: ({ schema }) => ({ 'Mod-,': toggle(getMarkType(schema, 'subscript')) }),
})

export const Superscript: Extension<NoOptions> = defineExtension({
  name: 'superscript',
  defaultOptions: {},
  marks: () => ({
    superscript: {
      excludes: EXCLUDES,
      parseDOM: [
        { tag: 'sup', getAttrs: (element) => !element.hasAttribute('data-footnote') && null },
        { style: 'vertical-align=super' },
      ],
      toDOM: () => ['sup', 0],
    },
  }),
  commands: ({ schema }) => ({
    toggleSuperscript: () => toggle(getMarkType(schema, 'superscript')),
  }),
  keymap: ({ schema }) => ({ 'Mod-.': toggle(getMarkType(schema, 'superscript')) }),
})
