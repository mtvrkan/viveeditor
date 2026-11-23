import type { Extension } from '@viveeditor/core'
import { ChangeCase } from './change-case.js'
import { CleanDocument } from './clean-document.js'
import { ClearFormatting } from './clear-formatting.js'
import { FontSize } from './font-size.js'
import { FormatPainter } from './format-painter.js'
import { Indent } from './indent.js'
import { PasteOptions } from './paste-options.js'
import { Subscript, Superscript } from './script.js'
import { TextAlign } from './text-align.js'
import { Highlight, TextColor } from './text-color.js'
import { Typography } from './typography.js'

export { ChangeCase, type ChangeCaseOptions, type TextCase } from './change-case.js'
export { CleanDocument, type DocumentCleanup } from './clean-document.js'
export { ClearFormatting, type ClearFormattingOptions } from './clear-formatting.js'
export { normalizeColor } from './color.js'
export { FONT_SIZES, FontSize, type FontSizeStep } from './font-size.js'
export { FormatPainter, type FormatPainterOptions } from './format-painter.js'
export { Indent, type IndentOptions } from './indent.js'
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
  TextColor,
  Highlight,
  FontSize,
  Subscript,
  Superscript,
  ChangeCase,
  Typography,
  ClearFormatting,
  FormatPainter,
  CleanDocument,
  PasteOptions,
]
