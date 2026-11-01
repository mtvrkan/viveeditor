import { toggleMark } from 'prosemirror-commands'
import type { Command } from 'prosemirror-state'
import { defineExtension, type Extension, getMarkType } from '../src/index.js'

declare module '../src/extension.js' {
  interface CommandRegistry {
    toggleBold: () => Command
    toggleItalic: () => Command
  }
}

export const TestMarks: Extension<{ boldTag: string }> = defineExtension({
  name: 'test-marks',
  defaultOptions: { boldTag: 'strong' },
  marks: (options) => ({
    bold: {
      parseDOM: [{ tag: 'strong' }, { tag: 'b' }],
      toDOM: () => [options.boldTag, 0],
    },
    italic: {
      parseDOM: [{ tag: 'em' }, { tag: 'i' }],
      toDOM: () => ['em', 0],
    },
  }),
  commands: ({ schema }) => ({
    toggleBold: () => toggleMark(getMarkType(schema, 'bold')),
    toggleItalic: () => toggleMark(getMarkType(schema, 'italic')),
  }),
  keymap: ({ schema }) => ({
    'Mod-b': toggleMark(getMarkType(schema, 'bold')),
  }),
})
