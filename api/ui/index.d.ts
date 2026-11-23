import { m as DocumentMessages, t as panel_kit_d_exports } from "./panel-kit.chunk.js";
import { a as Messages, i as MessageKey, n as Locale, o as resolveLocale, r as MESSAGES } from "./commands.chunk.js";
import { i as UiPluginInstance, n as UiPlugin, r as UiPluginHost, t as SlashEntry } from "./plugins.chunk.js";
import { Editor } from "@viveeditor/core";
type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "error";
interface AutosaveOptions {
  key: string;
  wait?: number;
  storage?: "local" | "session" | false;
  save?: (editor: Editor, context: {
    signal: AbortSignal;
  }) => Promise<void> | void;
  onError?: (error: unknown) => void;
}
interface AutosaveDraft {
  readonly savedAt: number;
}
interface Autosave {
  draft(): AutosaveDraft | null;
  restore(): boolean;
  discard(): void;
  clear(): void;
  status(): AutosaveStatus;
  flush(): Promise<void>;
  onChange(listener: () => void): () => void;
  destroy(): void;
}
export declare function createAutosave(editor: Editor, options: AutosaveOptions): Autosave;
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
    fontFamilies?: readonly string[];
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
type ContextMenuMode = "objects" | "always" | false;
interface UiOptions {
  locale?: string;
  messages?: Partial<Messages & DocumentMessages>;
  theme?: UiTheme;
  readability?: ReadabilityFormula | false;
  bubble?: boolean;
  slash?: boolean;
  contextMenu?: ContextMenuMode;
  source?: boolean;
  files?: FileOptions | false;
  plugins?: readonly UiPlugin[];
  panels?: PanelSource;
  exclude?: readonly string[];
  autosave?: AutosaveOptions;
  onError?: (error: unknown) => void;
}
interface EditorUI {
  readonly root: HTMLElement;
  readonly toolbar: HTMLElement;
  readonly autosave: Autosave | null;
  refresh(): void;
  destroy(): void;
}
export declare function createUI(editor: Editor, options?: UiOptions): EditorUI;
export { type Autosave, type AutosaveDraft, type AutosaveOptions, type AutosaveStatus, type ContextMenuMode, type DocumentMessages, type DocxModule, type EditorUI, type FileImageUploader, type FileOptions, type Locale, MESSAGES, type MarkdownModule, type MessageKey, type Messages, type PanelKit, type PanelKitLoader, type PanelSource, type PrintOptions, type ReadabilityBand, type ReadabilityFormula, type SlashEntry, type TextMeasure, type UiOptions, type UiPlugin, type UiPluginHost, type UiPluginInstance, type UiTheme, resolveLocale };
