import type { MarkType, NodeType, Schema } from 'prosemirror-model'
import { ViveEditorError } from './errors.js'

export function getNodeType(schema: Schema, name: string): NodeType {
  const type = schema.nodes[name]
  if (!type) {
    throw new ViveEditorError('MISSING_SCHEMA_ITEM', `Node type "${name}" is not in the schema.`)
  }
  return type
}

export function getMarkType(schema: Schema, name: string): MarkType {
  const type = schema.marks[name]
  if (!type) {
    throw new ViveEditorError('MISSING_SCHEMA_ITEM', `Mark type "${name}" is not in the schema.`)
  }
  return type
}
