import type { Extension } from '@viveeditor/core'
import { TextAlign } from './text-align.js'
import { Highlight, TextColor } from './text-color.js'

export { normalizeColor } from './color.js'
export { TextAlign, type TextAlignment, type TextAlignOptions } from './text-align.js'
export { type ColorOptions, Highlight, TextColor } from './text-color.js'

export const formatExtensions: readonly Extension[] = [TextAlign, TextColor, Highlight]
