import { defineExtension, type Extension, getMarkType, markInputRule } from '@viveeditor/core'
import { toggleMark } from 'prosemirror-commands'
import type { Command } from 'prosemirror-state'

declare module '@viveeditor/core' {
  interface CommandRegistry {
    toggleBold: () => Command
    toggleItalic: () => Command
    toggleUnderline: () => Command
    toggleStrike: () => Command
    toggleCode: () => Command
  }
}

type NoOptions = Record<string, never>

export const Bold: Extension<NoOptions> = defineExtension({
  name: 'bold',
  defaultOptions: {},
  marks: () => ({
    bold: {
      parseDOM: [
        { tag: 'strong' },
        {
          tag: 'b',
          getAttrs: (node) => (node as HTMLElement).style.fontWeight !== 'normal' && null,
        },
        {
          style: 'font-weight',
          getAttrs: (value) => /^(bold(er)?|[5-9]\d{2})$/.test(value as string) && null,
        },
      ],
      toDOM: () => ['strong', 0],
    },
  }),
  commands: ({ schema }) => ({
    toggleBold: () => toggleMark(getMarkType(schema, 'bold')),
  }),
  keymap: ({ schema }) => ({
    'Mod-b': toggleMark(getMarkType(schema, 'bold')),
  }),
  inputRules: ({ schema }) => [
    markInputRule(
      /(?<![*\p{L}\p{N}_])\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/u,
      getMarkType(schema, 'bold'),
    ),
    markInputRule(/(?<![\p{L}\p{N}_])__([^_\s](?:[^_]*[^_\s])?)__$/u, getMarkType(schema, 'bold')),
  ],
})

export const Italic: Extension<NoOptions> = defineExtension({
  name: 'italic',
  defaultOptions: {},
  marks: () => ({
    italic: {
      parseDOM: [
        { tag: 'em' },
        {
          tag: 'i',
          getAttrs: (node) => (node as HTMLElement).style.fontStyle !== 'normal' && null,
        },
        { style: 'font-style=italic' },
      ],
      toDOM: () => ['em', 0],
    },
  }),
  commands: ({ schema }) => ({
    toggleItalic: () => toggleMark(getMarkType(schema, 'italic')),
  }),
  keymap: ({ schema }) => ({
    'Mod-i': toggleMark(getMarkType(schema, 'italic')),
  }),
  inputRules: ({ schema }) => [
    markInputRule(
      /(?<![*\p{L}\p{N}_])\*([^*\s](?:[^*]*[^*\s])?)\*$/u,
      getMarkType(schema, 'italic'),
    ),
    markInputRule(/(?<![\p{L}\p{N}_])_([^_\s](?:[^_]*[^_\s])?)_$/u, getMarkType(schema, 'italic')),
  ],
})

export const Underline: Extension<NoOptions> = defineExtension({
  name: 'underline',
  defaultOptions: {},
  marks: () => ({
    underline: {
      parseDOM: [{ tag: 'u' }, { style: 'text-decoration=underline' }],
      toDOM: () => ['u', 0],
    },
  }),
  commands: ({ schema }) => ({
    toggleUnderline: () => toggleMark(getMarkType(schema, 'underline')),
  }),
  keymap: ({ schema }) => ({
    'Mod-u': toggleMark(getMarkType(schema, 'underline')),
  }),
})

export const Strike: Extension<NoOptions> = defineExtension({
  name: 'strike',
  defaultOptions: {},
  marks: () => ({
    strike: {
      parseDOM: [
        { tag: 's' },
        { tag: 'del' },
        { tag: 'strike' },
        { style: 'text-decoration=line-through' },
      ],
      toDOM: () => ['s', 0],
    },
  }),
  commands: ({ schema }) => ({
    toggleStrike: () => toggleMark(getMarkType(schema, 'strike')),
  }),
  keymap: ({ schema }) => ({
    'Mod-Shift-s': toggleMark(getMarkType(schema, 'strike')),
  }),
  inputRules: ({ schema }) => [
    markInputRule(
      /(?<![~\p{L}\p{N}_])~~([^~\s](?:[^~]*[^~\s])?)~~$/u,
      getMarkType(schema, 'strike'),
    ),
  ],
})

export const Code: Extension<NoOptions> = defineExtension({
  name: 'code',
  defaultOptions: {},
  marks: () => ({
    code: {
      excludes: '_',
      code: true,
      parseDOM: [{ tag: 'code' }],
      toDOM: () => ['code', 0],
    },
  }),
  commands: ({ schema }) => ({
    toggleCode: () => toggleMark(getMarkType(schema, 'code')),
  }),
  keymap: ({ schema }) => ({
    'Mod-e': toggleMark(getMarkType(schema, 'code')),
  }),
  inputRules: ({ schema }) => [markInputRule(/(?<!`)`([^`]+)`$/u, getMarkType(schema, 'code'))],
})
