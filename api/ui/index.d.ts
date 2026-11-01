import { t as panel_kit_d_exports } from "./panel-kit.chunk.js";
import { a as Messages, i as MessageKey, n as Locale, o as resolveLocale, r as MESSAGES } from "./commands.chunk.js";
import { i as UiPluginInstance, n as UiPlugin, r as UiPluginHost, t as SlashEntry } from "./plugins.chunk.js";
import { Editor } from "@viveeditor/core";
interface DocxImportResult {
  html: string;
  warnings: readonly {
    code: string;
    count: number;
  }[];
}
interface DocxModule {
  importDocx(file: Blob, options?: {
    upload?: FileImageUploader;
    allowBase64?: boolean;
    signal?: AbortSignal;
  }): Promise<DocxImportResult>;
  exportDocx(editor: Editor, options?: {
    title?: string;
    signal?: AbortSignal;
  }): Promise<Blob>;
}
interface MarkdownModule {
  markdownToHtml(source: string): string;
  toMarkdown(editor: Editor): string;
}
type FileImageUploader = (file: File, context: {
  signal: AbortSignal;
  onProgress: (fraction: number) => void;
}) => Promise<string | {
  src: string;
  width?: number;
  height?: number;
}>;
interface FileOptions {
  docx?: () => Promise<DocxModule>;
  markdown?: () => Promise<MarkdownModule>;
  html?: boolean;
  print?: boolean;
  fileName?: string;
  upload?: FileImageUploader;
  allowBase64?: boolean;
}
export declare function safeFileName(name: string, extension: string, fallback: string): string;
type PanelKit = typeof panel_kit_d_exports;
type PanelKitLoader = () => Promise<PanelKit>;
type PanelSource = PanelKit | PanelKitLoader;
export declare function normalizeHref(value: string): string;
type ReadabilityFormula = "atesman" | "flesch";
type ReadabilityBand = 0 | 1 | 2 | 3 | 4;
interface TextMeasure {
  words: number;
  characters: number;
  sentences: number;
  syllables: number;
  averageSentence: number;
  readingMinutes: number;
  score: number | null;
  band: ReadabilityBand | null;
}
export declare const MIN_WORDS_FOR_SCORE = 10;
export declare function measureText(text: string, formula?: ReadabilityFormula): TextMeasure;
interface PrintOptions {
  title?: string;
  css?: string;
  imageTimeout?: number;
}
export declare function printableHtml(editor: Editor, options?: PrintOptions): string;
export declare function printDocument(editor: Editor, options?: PrintOptions): Promise<void>;
type UiTheme = "light" | "dark" | "auto";
interface UiOptions {
  locale?: string;
  messages?: Partial<Messages>;
  theme?: UiTheme;
  readability?: ReadabilityFormula | false;
  bubble?: boolean;
  slash?: boolean;
  source?: boolean;
  files?: FileOptions | false;
  plugins?: readonly UiPlugin[];
  panels?: PanelSource;
  onError?: (error: unknown) => void;
}
interface EditorUI {
  readonly root: HTMLElement;
  readonly toolbar: HTMLElement;
  refresh(): void;
  destroy(): void;
}
export declare function createUI(editor: Editor, options?: UiOptions): EditorUI;
export { type DocxModule, type EditorUI, type FileImageUploader, type FileOptions, type Locale, MESSAGES, type MarkdownModule, type MessageKey, type Messages, type PanelKit, type PanelKitLoader, type PanelSource, type PrintOptions, type ReadabilityBand, type ReadabilityFormula, type SlashEntry, type TextMeasure, type UiOptions, type UiPlugin, type UiPluginHost, type UiPluginInstance, type UiTheme, resolveLocale };
//# sourceMappingURL=index.d.ts.map
