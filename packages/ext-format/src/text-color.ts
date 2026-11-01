import { defineExtension, type Extension, getMarkType } from '@viveeditor/core'
import { type Command, Plugin } from 'prosemirror-state'
import { normalizeColor } from './color.js'
import { hasMark, setMark, unsetMark } from './marks.js'

export interface ColorOptions {
  ignoredColors: readonly string[]
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    setTextColor: (color: string) => Command
    unsetTextColor: () => Command
    setHighlight: (color?: string) => Command
    unsetHighlight: () => Command
    toggleHighlight: () => Command
  }
}

const pastedColor =
  (options: ColorOptions) =>
  (value: string | HTMLElement): { color: string } | false => {
    const color = normalizeColor(value)
    return color && !options.ignoredColors.includes(color) ? { color } : false
  }

export const TextColor: Extension<ColorOptions> = defineExtension({
  name: 'textColor',
  defaultOptions: { ignoredColors: ['#000000', 'black'] },
  marks: (options) => ({
    textColor: {
      attrs: { color: {} },
      parseDOM: [
        { style: 'color', getAttrs: pastedColor(options) },
        {
          tag: 'font[color]',
          getAttrs: (element) => pastedColor(options)(element.getAttribute('color') ?? ''),
        },
      ],
      toDOM: (mark) => {
        const color = normalizeColor(mark.attrs.color)
        return ['span', color ? { style: `color: ${color}` } : {}, 0]
      },
    },
  }),
  commands: ({ schema }) => {
    const type = getMarkType(schema, 'textColor')
    return {
      setTextColor: (color: string) => {
        const normalized = normalizeColor(color)
        return normalized ? setMark(type, { color: normalized }) : () => false
      },
      unsetTextColor: () => unsetMark(type),
    }
  },
  plugins: () => [
    new Plugin({
      props: {
        markViews: {
          textColor: (mark) => {
            const dom = document.createElement('span')
            const color = normalizeColor(mark.attrs.color)
            if (color) dom.setAttribute('style', `color: ${color}; --vive-ink: ${color}`)
            return { dom }
          },
        },
      },
    }),
  ],
})

export const Highlight: Extension<ColorOptions> = defineExtension({
  name: 'highlight',
  defaultOptions: { ignoredColors: ['#ffffff', 'white'] },
  marks: (options) => ({
    highlight: {
      attrs: { color: { default: null } },
      parseDOM: [
        {
          tag: 'mark',
          getAttrs: (element) => ({ color: normalizeColor(element.style.backgroundColor) }),
        },
        { style: 'background-color', getAttrs: pastedColor(options) },
      ],
      toDOM: (mark) => {
        const color = normalizeColor(mark.attrs.color)
        return color ? ['mark', { style: `background-color: ${color}` }, 0] : ['mark', 0]
      },
    },
  }),
  commands: ({ schema }) => {
    const type = getMarkType(schema, 'highlight')
    const set = (color?: string): Command => {
      if (color === undefined) return setMark(type, { color: null })
      const normalized = normalizeColor(color)
      return normalized ? setMark(type, { color: normalized }) : () => false
    }
    return {
      setHighlight: set,
      unsetHighlight: () => unsetMark(type),
      toggleHighlight: () => (state, dispatch) =>
        hasMark(state, type) ? unsetMark(type)(state, dispatch) : set()(state, dispatch),
    }
  },
  keymap: ({ schema }) => {
    const type = getMarkType(schema, 'highlight')
    return {
      'Mod-Shift-h': (state, dispatch) =>
        hasMark(state, type)
          ? unsetMark(type)(state, dispatch)
          : setMark(type, { color: null })(state, dispatch),
    }
  },
})
