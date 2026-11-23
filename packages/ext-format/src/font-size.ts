import { defineExtension, type Extension, getMarkType } from '@viveeditor/core'
import type { MarkType } from 'prosemirror-model'
import type { Command, EditorState } from 'prosemirror-state'
import { setMark, unsetMark } from './marks.js'

export type FontSizeStep = 'tiny' | 'small' | 'big' | 'huge'

export const FONT_SIZES: Readonly<Record<FontSizeStep, string>> = {
  tiny: '0.75em',
  small: '0.875em',
  big: '1.25em',
  huge: '1.5em',
}

const STEPS: readonly (FontSizeStep | null)[] = ['tiny', 'small', null, 'big', 'huge']

declare module '@viveeditor/core' {
  interface CommandRegistry {
    setFontSize: (size: FontSizeStep) => Command
    unsetFontSize: () => Command
    stepFontSize: (direction: 1 | -1) => Command
  }
  interface QueryRegistry {
    fontSize: () => FontSizeStep | null
  }
}

const isFontSize = (value: unknown): value is FontSizeStep =>
  typeof value === 'string' && Object.hasOwn(FONT_SIZES, value)

function sizeOf(value: string): FontSizeStep | false {
  const clean = value.trim().toLowerCase()
  const match = Object.entries(FONT_SIZES).find(([, em]) => em === clean)
  return match ? (match[0] as FontSizeStep) : false
}

function currentSize(state: EditorState, type: MarkType): FontSizeStep | null {
  const { empty, $from, from, to } = state.selection
  if (empty) {
    const size = type.isInSet(state.storedMarks ?? $from.marks())?.attrs.size
    return isFontSize(size) ? size : null
  }
  let found: FontSizeStep | null = null
  let seen = false
  state.doc.nodesBetween(from, to, (node) => {
    if (seen || !node.isText) return !seen
    seen = true
    const size = type.isInSet(node.marks)?.attrs.size
    found = isFontSize(size) ? size : null
    return false
  })
  return found
}

function apply(type: MarkType, size: FontSizeStep | null): Command {
  return size ? setMark(type, { size }) : unsetMark(type)
}

function step(type: MarkType, direction: 1 | -1): Command {
  return (state, dispatch) => {
    const next = STEPS[STEPS.indexOf(currentSize(state, type)) + direction]
    return next === undefined ? false : apply(type, next)(state, dispatch)
  }
}

export const FontSize: Extension<Record<string, never>> = defineExtension({
  name: 'fontSize',
  defaultOptions: {},
  marks: () => ({
    fontSize: {
      attrs: { size: {} },
      parseDOM: [
        {
          style: 'font-size',
          getAttrs: (value) => {
            const size = sizeOf(value)
            return size ? { size } : false
          },
        },
      ],
      toDOM: (mark) => {
        const em = isFontSize(mark.attrs.size) ? FONT_SIZES[mark.attrs.size] : null
        return ['span', em ? { style: `font-size: ${em}` } : {}, 0]
      },
    },
  }),
  commands: ({ schema }) => {
    const type = getMarkType(schema, 'fontSize')
    return {
      setFontSize: (size: FontSizeStep) => (isFontSize(size) ? apply(type, size) : () => false),
      unsetFontSize: () => unsetMark(type),
      stepFontSize: (direction: 1 | -1) => step(type, direction),
    }
  },
  queries: ({ schema }) => ({
    fontSize: (state) => currentSize(state, getMarkType(schema, 'fontSize')),
  }),
  keymap: ({ schema }) => {
    const type = getMarkType(schema, 'fontSize')
    return { 'Mod-Shift-.': step(type, 1), 'Mod-Shift-,': step(type, -1) }
  },
})
