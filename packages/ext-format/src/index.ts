import type { Extension } from '@viveeditor/core'
import { ChangeCase } from './change-case.js'
import { CleanDocument } from './clean-document.js'
import { ClearFormatting } from './clear-formatting.js'
import { FontFamily } from './font-family.js'
import { FontSize } from './font-size.js'
import { FormatPainter } from './format-painter.js'
import { Indent } from './indent.js'
import { LineHeight } from './line-height.js'
import { PasteOptions } from './paste-options.js'
import { Subscript, Superscript } from './script.js'
import { TextAlign } from './text-align.js'
import { Highlight, TextColor } from './text-color.js'
import { Typography } from './typography.js'

export { ChangeCase, type ChangeCaseOptions, type TextCase } from './change-case.js'
export { CleanDocument, type DocumentCleanup } from './clean-document.js'
export { ClearFormatting, type ClearFormattingOptions } from './clear-formatting.js'
export { normalizeColor } from './color.js'
export { DEFAULT_FONT_FAMILIES, FontFamily, type FontFamilyOptions } from './font-family.js'
export {
  FONT_POINT_PRESETS,
  FONT_SIZES,
  FontSize,
  type FontSizeStep,
  MAX_FONT_POINTS,
  MIN_FONT_POINTS,
  parseFontPoints,
} from './font-size.js'
export { FormatPainter, type FormatPainterOptions } from './format-painter.js'
export { Indent, type IndentOptions } from './indent.js'
export {
  LINE_HEIGHTS,
  LineHeight,
  type LineHeightOptions,
  type LineHeightValue,
} from './line-height.js'
export {
  type LastPaste,
  type PasteMode,
  PasteOptions,
  type PasteOptionsSettings,
} from './paste-options.js'
export { Subscript, Superscript } from './script.js'
export { TextAlign, type TextAlignment, type TextAlignOptions } from './text-align.js'
export { type ColorOptions, Highlight, TextColor } from './text-color.js'
export { Typography, type TypographyOptions } from './typography.js'

export const formatExtensions: readonly Extension[] = [
  TextAlign,
  Indent,
  LineHeight,
  TextColor,
  Highlight,
  FontSize,
  FontFamily,
  Subscript,
  Superscript,
  ChangeCase,
  Typography,
  ClearFormatting,
  FormatPainter,
  CleanDocument,
  PasteOptions,
]
