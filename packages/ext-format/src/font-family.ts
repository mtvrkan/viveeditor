import { defineExtension, type Extension, getMarkType } from '@viveeditor/core'
import type { MarkType } from 'prosemirror-model'
import type { Command, EditorState } from 'prosemirror-state'
import { setMark, unsetMark } from './marks.js'

export interface FontFamilyOptions {
  fontFamilies: readonly string[]
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    setFontFamily: (family: string) => Command
    unsetFontFamily: () => Command
  }
  interface QueryRegistry {
    fontFamily: () => string | null
    fontFamilies: () => readonly string[]
  }
}

export const DEFAULT_FONT_FAMILIES: readonly string[] = [
  'serif',
  'sans-serif',
  'monospace',
  'Arial, Helvetica, sans-serif',
  'Georgia, serif',
  "'Times New Roman', Times, serif",
  "'Courier New', Courier, monospace",
  'Verdana, Geneva, sans-serif',
]

const FAMILY_PART = /^(?:'[A-Za-z][A-Za-z0-9 -]*'|[A-Za-z][A-Za-z0-9 -]*)$/
const MAX_FAMILY_BYTES = 64
const SPACE = /[\t\n\f\r ]+/g

type FontFamilies = ReadonlyMap<string, string>

const lowerAscii = (value: string): string =>
  value.replace(/[A-Z]/g, (letter) => letter.toLowerCase())

const trimAscii = (value: string): string => value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '')

const familyKey = (value: string): string =>
  lowerAscii(value)
    .replace(/["']/g, '')
    .split(',')
    .map((part) => trimAscii(part).replace(SPACE, ' '))
    .join(',')

const leadKey = (key: string): string => `\n${key.split(',')[0] ?? ''}`

const findFamily = (families: FontFamilies, value: string): string | null => {
  const key = familyKey(value)
  return families.get(key) ?? families.get(leadKey(key)) ?? null
}

function familyMap(list: readonly string[]): FontFamilies {
  const map = new Map<string, string>()
  for (const entry of list) {
    const parts = typeof entry === 'string' ? entry.split(',').map(trimAscii) : []
    if (
      parts.length === 0 ||
      new TextEncoder().encode(entry).length > MAX_FAMILY_BYTES ||
      !parts.every((part) => FAMILY_PART.test(part))
    ) {
      throw new TypeError(
        `Font family "${String(entry)}" must be a comma-separated list of plain family names.`,
      )
    }
    const canonical = parts.join(', ')
    const key = familyKey(canonical)
    map.set(key, canonical)
    const first = leadKey(key)
    if (!map.has(first)) map.set(first, canonical)
  }
  return map
}

const familyOf = (families: FontFamilies, value: unknown): string | null =>
  typeof value === 'string' ? findFamily(families, value) : null

function currentFamily(state: EditorState, type: MarkType, families: FontFamilies): string | null {
  const { empty, $from, from, to } = state.selection
  if (empty) {
    return familyOf(families, type.isInSet(state.storedMarks ?? $from.marks())?.attrs.family)
  }
  const found = new Set<string | null>()
  state.doc.nodesBetween(from, to, (node) => {
    if (found.size > 1) return false
    if (node.isText) found.add(familyOf(families, type.isInSet(node.marks)?.attrs.family))
    return true
  })
  return found.size === 1 ? ([...found][0] ?? null) : null
}

const familiesByOptions = new WeakMap<FontFamilyOptions, FontFamilies>()

function familiesOf(options: FontFamilyOptions): FontFamilies {
  const cached = familiesByOptions.get(options)
  if (cached) return cached
  const families = familyMap(options.fontFamilies)
  familiesByOptions.set(options, families)
  return families
}

export const FontFamily: Extension<FontFamilyOptions> = defineExtension({
  name: 'fontFamily',
  defaultOptions: { fontFamilies: DEFAULT_FONT_FAMILIES },
  marks: (options) => {
    const families = familiesOf(options)
    return {
      fontFamily: {
        attrs: { family: {} },
        verbatimStyle: true,
        parseDOM: [
          {
            style: 'font-family',
            getAttrs: (value) => {
              const family = familyOf(families, value)
              return family ? { family } : false
            },
          },
        ],
        toDOM: (mark) => {
          const family = familyOf(families, mark.attrs.family)
          return ['span', family ? { style: `font-family: ${family}` } : {}, 0]
        },
      },
    }
  },
  commands: ({ schema, options }) => {
    const type = getMarkType(schema, 'fontFamily')
    const families = familiesOf(options)
    return {
      setFontFamily: (family: string) => {
        const canonical = familyOf(families, family)
        return canonical === null ? () => false : setMark(type, { family: canonical })
      },
      unsetFontFamily: () => unsetMark(type),
    }
  },
  queries: ({ schema, options }) => ({
    fontFamily: (state) =>
      currentFamily(state, getMarkType(schema, 'fontFamily'), familiesOf(options)),
    fontFamilies: () => [...new Set(familiesOf(options).values())],
  }),
})
