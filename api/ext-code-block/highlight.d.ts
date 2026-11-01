import { Extension } from "@viveeditor/core";
export interface HighlightToken {
  from: number;
  to: number;
  style: string;
}
export type Highlighter = (code: string, language: string) => readonly HighlightToken[] | Promise<readonly HighlightToken[]>;
export interface CodeHighlightOptions {
  highlighter: Highlighter | null;
  delay: number;
  cacheSize: number;
}
interface ShikiToken {
  content: string;
  offset: number;
  color?: string;
  htmlStyle?: string | Record<string, string>;
}
export interface ShikiLike<Language extends string = string> {
  codeToTokens(code: string, options: {
    lang: Language;
    themes: Record<string, string>;
    defaultColor: false;
  }): Promise<{
    tokens: ShikiToken[][];
  }> | {
    tokens: ShikiToken[][];
  };
}
export interface ShikiHighlighterOptions {
  themes?: {
    light: string;
    dark: string;
  };
}
export declare function shikiHighlighter<Language extends string>(load: () => Promise<ShikiLike<Language>>, options?: ShikiHighlighterOptions): Highlighter;
export declare const CodeHighlight: Extension<CodeHighlightOptions>;
export {};
//# sourceMappingURL=highlight.d.ts.map
