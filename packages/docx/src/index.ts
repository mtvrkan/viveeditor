export { DocxError, type DocxErrorCode } from './errors.js'
export {
  DEFAULT_IMPORT_LIMITS,
  type DocxImport,
  type ImportLimits,
  type ImportOptions,
  type ImportWarning,
  type ImportWarningCode,
  importDocx,
} from './read.js'
export {
  DOCX_MIME,
  type ExportLimits,
  type ExportOptions,
  type ExportSource,
  exportDocx,
} from './write.js'
