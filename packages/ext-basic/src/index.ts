import type { Extension } from '@viveeditor/core'
import { Link } from './link.js'
import { Bold, Code, Italic, Strike, Underline } from './marks.js'
import { Blockquote, HardBreak, Heading, HorizontalRule } from './nodes.js'

export { Link, type LinkAttributes, type LinkOptions } from './link.js'
export { Bold, Code, Italic, Strike, Underline } from './marks.js'
export {
  Blockquote,
  HardBreak,
  Heading,
  type HeadingLevel,
  type HeadingOptions,
  HorizontalRule,
} from './nodes.js'

export const basicExtensions: readonly Extension[] = [
  Heading,
  Blockquote,
  HorizontalRule,
  HardBreak,
  Bold,
  Italic,
  Underline,
  Strike,
  Code,
  Link,
]
