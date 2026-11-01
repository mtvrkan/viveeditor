import { JSONContent } from "@viveeditor/core";
import { Schema } from "prosemirror-model";
export declare const MAX_MARKDOWN_LENGTH = 1e6;
export declare function markdownToHtml(source: string): string;
interface MarkdownSource {
  readonly schema: Schema;
  getJSON(): JSONContent;
}
interface ToMarkdownOptions {
  embedUrl?: (attrs: Record<string, unknown>) => string | null;
}
export declare function toMarkdown(source: MarkdownSource, options?: ToMarkdownOptions): string;
export type { MarkdownSource, ToMarkdownOptions };
//# sourceMappingURL=index.d.ts.map
