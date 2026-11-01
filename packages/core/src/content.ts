import {
  DOMParser as ProseMirrorDOMParser,
  type Node as ProseMirrorNode,
  type Schema,
} from 'prosemirror-model'
import type { EditorContent } from './editor.js'
import { ViveEditorError } from './errors.js'
import { withRestoredSpaces } from './whitespace.js'

export function parseContent(schema: Schema, content: EditorContent | undefined): ProseMirrorNode {
  if (content === undefined || content === '') {
    return schema.topNodeType.createAndFill() as ProseMirrorNode
  }
  try {
    if (typeof content === 'string') {
      const body = new DOMParser().parseFromString(content, 'text/html').body
      return withRestoredSpaces(ProseMirrorDOMParser.fromSchema(schema).parse(body))
    }
    const node = schema.nodeFromJSON(content)
    node.check()
    return node
  } catch (cause) {
    throw new ViveEditorError('INVALID_CONTENT', 'Content does not match the editor schema.', {
      cause,
    })
  }
}
