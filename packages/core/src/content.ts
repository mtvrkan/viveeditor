import {
  DOMParser as ProseMirrorDOMParser,
  type Node as ProseMirrorNode,
  type Schema,
} from 'prosemirror-model'
import type { EditorContent } from './editor.js'
import { ViveEditorError } from './errors.js'
import { withRestoredSpaces } from './whitespace.js'

export const SCHEMA_VERSION = 1

function assertReadableVersion(content: unknown): void {
  if (typeof content !== 'object' || content === null) return
  const version: unknown = Reflect.get(content, 'schemaVersion')
  if (version === undefined) return
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 0) {
    throw new ViveEditorError(
      'INVALID_CONTENT',
      'schemaVersion must be a whole number of 0 or more.',
    )
  }
  if (version > SCHEMA_VERSION) {
    throw new ViveEditorError(
      'SCHEMA_TOO_NEW',
      `Content was saved with schema version ${version}; this editor reads versions up to ${SCHEMA_VERSION}.`,
    )
  }
}

export function parseContent(schema: Schema, content: EditorContent | undefined): ProseMirrorNode {
  if (content === undefined || content === '') {
    return schema.topNodeType.createAndFill() as ProseMirrorNode
  }
  if (typeof content !== 'string') assertReadableVersion(content)
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
