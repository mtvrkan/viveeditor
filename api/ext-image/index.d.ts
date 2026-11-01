import { Extension } from "@viveeditor/core";
import { Command, Plugin, PluginKey } from "prosemirror-state";
import { Slice } from "prosemirror-model";
import { Decoration, DecorationSet } from "prosemirror-view";
interface ImageSourcePolicy {
  allowBase64: boolean;
  maxBase64Length: number;
  insecure: "block" | "upgrade";
  allowRelative: boolean;
}
interface ImageAttributes {
  src: string;
  alt?: string | null;
  title?: string | null;
  width?: number | null;
  height?: number | null;
}
export declare const DEFAULT_SOURCE_POLICY: ImageSourcePolicy;
export declare function normalizeImageSrc(value: unknown, policy?: ImageSourcePolicy): string | null;
export declare function isAllowedImageSrc(value: unknown, policy?: ImageSourcePolicy): boolean;
export declare function cleanDimension(value: unknown): number | null;
type ImageErrorCode = "TYPE" | "SIZE" | "COUNT" | "TIMEOUT" | "UPLOAD" | "SOURCE";
interface ImageError {
  code: ImageErrorCode;
  fileName: string;
}
interface UploadContext {
  signal: AbortSignal;
  onProgress: (value: number) => void;
}
type UploadResult = string | {
  src: string;
  width?: number;
  height?: number;
};
type ImageUploader = (file: File, context: UploadContext) => Promise<UploadResult>;
type ImageRehoster = (url: string, context: UploadContext) => Promise<UploadResult>;
interface ImageSize {
  width: number;
  height: number;
}
export declare function sniffImageType(bytes: Uint8Array): string | null;
export declare function imageSize(bytes: Uint8Array): ImageSize | null;
export interface ImageLabels {
  uploading: string;
  failed: string;
  missingAlt: string;
}
export interface ImageOptions {
  upload: ImageUploader | null;
  rehost: ImageRehoster | null;
  remoteImages: "allow" | "drop" | "rehost";
  allowBase64: boolean;
  maxBase64Length: number;
  insecure: "block" | "upgrade";
  allowRelative: boolean;
  mimeTypes: readonly string[];
  maxSize: number;
  maxFiles: number;
  concurrency: number;
  timeout: number;
  maxPreviewPixels: number;
  requireAlt: "off" | "warn" | "block";
  labels: ImageLabels;
  onError: ((error: ImageError) => void) | null;
}
export interface SelectedImage {
  src: string | null;
  alt: string | null;
  title: string | null;
  width: number | null;
  height: number | null;
}
export interface PendingUploads {
  uploading: number;
  failed: number;
}
export type ImageChanges = Partial<Omit<ImageAttributes, "src">>;
declare module "@viveeditor/core" {
  interface CommandRegistry {
    insertImage: (attributes: ImageAttributes) => Command;
    setImageAttributes: (changes: ImageChanges) => Command;
    scaleImage: (percent: number) => Command;
    uploadImages: (files: readonly File[]) => Command;
  }
  interface QueryRegistry {
    selectedImage: () => SelectedImage | null;
    isUploading: () => boolean;
    pendingUploads: () => PendingUploads;
    imagesWithoutAlt: () => number;
  }
}
export declare const Image: Extension<ImageOptions>;
export type { ImageAttributes, ImageError, ImageErrorCode, ImageRehoster, ImageSize, ImageSourcePolicy, ImageUploader, UploadContext, UploadResult };
//# sourceMappingURL=index.d.ts.map
