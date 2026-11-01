export type DocxErrorCode =
  | 'TOO_LARGE'
  | 'NOT_DOCX'
  | 'ENCRYPTED'
  | 'UNSUPPORTED'
  | 'DAMAGED'
  | 'TOO_COMPLEX'
  | 'ABORTED'

export class DocxError extends Error {
  readonly code: DocxErrorCode

  constructor(code: DocxErrorCode, message: string) {
    super(message)
    this.name = 'DocxError'
    this.code = code
  }
}

export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DocxError('ABORTED', 'The import was cancelled.')
}
