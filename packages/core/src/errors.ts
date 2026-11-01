export type ViveEditorErrorCode =
  | 'INVALID_CONTENT'
  | 'DESTROYED'
  | 'DUPLICATE_EXTENSION'
  | 'DUPLICATE_COMMAND'
  | 'DUPLICATE_QUERY'
  | 'SCHEMA_CONFLICT'
  | 'INVALID_SCHEMA'
  | 'MISSING_SCHEMA_ITEM'
  | 'UNKNOWN_COMMAND'
  | 'UNKNOWN_QUERY'

export class ViveEditorError extends Error {
  readonly code: ViveEditorErrorCode

  constructor(code: ViveEditorErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ViveEditorError'
    this.code = code
  }
}
