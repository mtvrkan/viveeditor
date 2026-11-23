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

export const MIN_FONT_POINTS = 6
export const MAX_FONT_POINTS = 96
export const FONT_POINT_PRESETS: readonly number[] = [
  8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72,
]

const STEP_POINTS: Readonly<Record<FontSizeStep, number>> = {
  tiny: 9,
  small: 10.5,
  big: 15,
  huge: 18,
}
const BASE_POINTS = 12
const POINTS = /^([0-9]{1,2})(?:\.([05]))?pt$/

declare module '@viveeditor/core' {
  interface CommandRegistry {
    setFontSize: (size: FontSizeStep | number | string) => Command
    unsetFontSize: () => Command
    stepFontSize: (direction: 1 | -1) => Command
  }
  interface QueryRegistry {
    fontSize: () => string | null
    fontSizePoints: () => number | null
  }
}

const lowerAscii = (value: string): string =>
  value.replace(/[A-Z]/g, (letter) => letter.toLowerCase())

const trimAscii = (value: string): string => value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '')

const isFontSize = (value: unknown): value is FontSizeStep =>
  typeof value === 'string' && Object.hasOwn(FONT_SIZES, value)

const pointString = (halves: number): string =>
  `${Math.floor(halves / 2)}${halves % 2 === 1 ? '.5' : ''}pt`

const inRange = (halves: number): boolean =>
  halves >= MIN_FONT_POINTS * 2 && halves <= MAX_FONT_POINTS * 2

export function parseFontPoints(value: string): string | null {
  const match = POINTS.exec(lowerAscii(trimAscii(value)))
  if (!match) return null
  const halves = Number(match[1]) * 2 + (match[2] === '5' ? 1 : 0)
  return inRange(halves) ? pointString(halves) : null
}

function pointsFromNumber(value: number): string | null {
  if (!Number.isFinite(value)) return null
  const halves = Math.round(value * 2)
  return inRange(halves) ? pointString(halves) : null
}

function sizeOf(value: string): string | false {
  const clean = lowerAscii(trimAscii(value))
  const step = Object.entries(FONT_SIZES).find(([, em]) => em === clean)
  if (step) return step[0]
  return parseFontPoints(value) ?? false
}

function normalizeSize(size: unknown): string | null {
  if (typeof size === 'number') return pointsFromNumber(size)
  if (typeof size !== 'string') return null
  if (isFontSize(size)) return size
  return parseFontPoints(size)
}

function pointsOf(size: unknown): number | null {
  if (isFontSize(size)) return STEP_POINTS[size]
  if (typeof size !== 'string') return null
  const canonical = parseFontPoints(size)
  return canonical === null ? null : Number(canonical.slice(0, -2))
}

function currentSize(state: EditorState, type: MarkType): string | null {
  const { empty, $from, from, to } = state.selection
  if (empty) {
    return normalizeSize(type.isInSet(state.storedMarks ?? $from.marks())?.attrs.size)
  }
  let found: string | null = null
  let seen = false
  state.doc.nodesBetween(from, to, (node) => {
    if (seen || !node.isText) return !seen
    seen = true
    found = normalizeSize(type.isInSet(node.marks)?.attrs.size)
    return false
  })
  return found
}

function step(type: MarkType, direction: 1 | -1): Command {
  return (state, dispatch) => {
    const current = pointsOf(currentSize(state, type)) ?? BASE_POINTS
    const next =
      direction === 1
        ? FONT_POINT_PRESETS.find((points) => points > current)
        : [...FONT_POINT_PRESETS].reverse().find((points) => points < current)
    const size = next === undefined ? null : pointsFromNumber(next)
    return size === null ? false : setMark(type, { size })(state, dispatch)
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
        const size = normalizeSize(mark.attrs.size)
        const css = size === null ? null : isFontSize(size) ? FONT_SIZES[size] : size
        return ['span', css ? { style: `font-size: ${css}` } : {}, 0]
      },
    },
  }),
  commands: ({ schema }) => {
    const type = getMarkType(schema, 'fontSize')
    return {
      setFontSize: (size: FontSizeStep | number | string) => {
        const normalized = normalizeSize(size)
        return normalized === null ? () => false : setMark(type, { size: normalized })
      },
      unsetFontSize: () => unsetMark(type),
      stepFontSize: (direction: 1 | -1) => step(type, direction),
    }
  },
  queries: ({ schema }) => ({
    fontSize: (state) => currentSize(state, getMarkType(schema, 'fontSize')),
    fontSizePoints: (state) => pointsOf(currentSize(state, getMarkType(schema, 'fontSize'))),
  }),
  keymap: ({ schema }) => {
    const type = getMarkType(schema, 'fontSize')
    return { 'Mod-Shift-.': step(type, 1), 'Mod-Shift-,': step(type, -1) }
  },
})
