import { Extension } from "@viveeditor/core";
type OfficeSource = "word" | "docs" | "libreoffice";
interface OfficeCleanResult {
  html: string;
  source: OfficeSource | null;
  droppedImages: number;
}
export declare function detectOffice(html: string): OfficeSource | null;
export declare function cleanOffice(html: string): OfficeCleanResult;
export declare function cleanOfficeHtml(html: string): string;
export interface OfficeDropInfo {
  source: OfficeSource;
  images: number;
}
export interface OfficePasteOptions {
  onDropped: ((info: OfficeDropInfo) => void) | null;
}
export declare const OfficePaste: Extension<OfficePasteOptions>;
export type { OfficeCleanResult, OfficeSource };
//# sourceMappingURL=index.d.ts.map
