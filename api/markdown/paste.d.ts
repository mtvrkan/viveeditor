import { Extension } from "@viveeditor/core";
export interface MarkdownConverter {
  markdownToHtml(source: string): string;
}
export interface MarkdownPasteOptions {
  load: (() => Promise<MarkdownConverter>) | null;
}
export declare function looksLikeMarkdown(text: string): boolean;
export declare const MarkdownPaste: Extension<MarkdownPasteOptions>;
//# sourceMappingURL=paste.d.ts.map
