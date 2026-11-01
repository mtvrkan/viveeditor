import { ImageSourcePolicy, ImageUploader } from "@viveeditor/ext-image";
import { Schema } from "prosemirror-model";
type DocxErrorCode = "TOO_LARGE" | "NOT_DOCX" | "ENCRYPTED" | "UNSUPPORTED" | "DAMAGED" | "TOO_COMPLEX" | "ABORTED";
export declare class DocxError extends Error {
  readonly code: DocxErrorCode;
  constructor(code: DocxErrorCode, message: string);
}
interface ImportLimits {
  fileBytes: number;
  totalBytes: number;
  documentBytes: number;
  partBytes: number;
  imageBytes: number;
  images: number;
  imagePixels: number;
  elements: number;
  cells: number;
}
interface ImportOptions {
  upload?: ImageUploader | null;
  allowBase64?: boolean;
  imagePolicy?: Partial<ImageSourcePolicy>;
  signal?: AbortSignal;
  limits?: Partial<ImportLimits>;
}
type ImportWarningCode = "HIDDEN_TEXT" | "IMAGE_DROPPED" | "LINK_DROPPED" | "OBJECT_DROPPED" | "NESTING_FLATTENED";
interface ImportWarning {
  code: ImportWarningCode;
  count: number;
}
interface DocxImport {
  html: string;
  warnings: ImportWarning[];
}
export declare const DEFAULT_IMPORT_LIMITS: Readonly<ImportLimits>;
export declare function importDocx(file: Blob, options?: ImportOptions): Promise<DocxImport>;
interface ExportSource {
  readonly schema: Schema;
  getJSON(): unknown;
}
interface ExportOptions {
  title?: string;
  fetchImages?: boolean;
  signal?: AbortSignal;
  limits?: Partial<ExportLimits>;
}
interface ExportLimits {
  imageBytes: number;
  images: number;
  timeout: number;
}
export declare const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export declare function exportDocx(source: ExportSource, options?: ExportOptions): Promise<Blob>;
export type { DocxErrorCode, DocxImport, ExportLimits, ExportOptions, ExportSource, ImportLimits, ImportOptions, ImportWarning, ImportWarningCode };
//# sourceMappingURL=index.d.ts.map
