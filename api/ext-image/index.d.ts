import { Extension } from "@viveeditor/core";
import { Command, Plugin, PluginKey } from "prosemirror-state";
import { Slice } from "prosemirror-model";
import { Decoration, DecorationSet } from "prosemirror-view";
interface ImageSize {
  width: number;
  height: number;
}
export declare function sniffImageType(bytes: Uint8Array): string | null;
export declare function imageSize(bytes: Uint8Array): ImageSize | null;
interface ImageSizeChange {
  width?: number | null;
  height?: number | null;
}
interface StoredSize {
  width: number | null;
  height: number | null;
}
export declare const MIN_IMAGE_SIZE = 16;
export declare function clampSize(width: number, ratio: number, max: number): ImageSize;
export declare function fitNatural(natural: ImageSize, max: number): ImageSize;
export declare function nextSize(current: StoredSize, change: ImageSizeChange, keepRatio: boolean, natural: ImageSize | null, max: number): StoredSize | null;
interface ImageSourcePolicy {
  allowBase64: boolean;
  maxBase64Length: number;
  insecure: "block" | "upgrade";
  allowRelative: boolean;
}
type ImageAlign = "left" | "center" | "right";
interface ImageAttributes {
  src: string;
  alt?: string | null;
  title?: string | null;
  width?: number | null;
  height?: number | null;
  caption?: string | null;
  align?: ImageAlign | null;
  href?: string | null;
}
export declare const DEFAULT_SOURCE_POLICY: ImageSourcePolicy;
export declare function normalizeImageSrc(value: unknown, policy?: ImageSourcePolicy): string | null;
export declare function isAllowedImageSrc(value: unknown, policy?: ImageSourcePolicy): boolean;
export declare function cleanImageHref(value: unknown): string | null;
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
  resizable: boolean;
  labels: ImageLabels;
  onError: ((error: ImageError) => void) | null;
}
export interface SelectedImage {
  src: string | null;
  alt: string | null;
  title: string | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  align: ImageAlign | null;
  href: string | null;
}
export interface PendingUploads {
  uploading: number;
  failed: number;
}
export type ImageChanges = Partial<Omit<ImageAttributes, "src">>;
export type ImageReplaceMode = "upload" | "base64";
declare module "@viveeditor/core" {
  interface CommandRegistry {
    insertImage: (attributes: ImageAttributes) => Command;
    setImageAttributes: (changes: ImageChanges) => Command;
    scaleImage: (percent: number) => Command;
    resizeImage: (size: ImageSizeChange, keepRatio?: boolean) => Command;
    resetImageSize: () => Command;
    replaceImage: (file: File, size?: ImageSizeChange) => Command;
    uploadImages: (files: readonly File[]) => Command;
    setImageLink: (href: string | null) => Command;
  }
  interface QueryRegistry {
    selectedImage: () => SelectedImage | null;
    isUploading: () => boolean;
    pendingUploads: () => PendingUploads;
    imagesWithoutAlt: () => number;
    imageReplaceMode: () => ImageReplaceMode | null;
  }
}
export declare const Image: Extension<ImageOptions>;
export type { ImageAlign, ImageAttributes, ImageError, ImageErrorCode, ImageRehoster, ImageSize, ImageSizeChange, ImageSourcePolicy, ImageUploader, UploadContext, UploadResult };
