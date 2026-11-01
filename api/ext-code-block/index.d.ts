import { Extension } from "@viveeditor/core";
import { Command } from "prosemirror-state";
export interface CodeLanguage {
  value: string;
  label: string;
}
export interface CodeBlockOptions {
  languages: readonly CodeLanguage[];
  languageLabel: string;
  plainTextLabel: string;
  tabSize: number;
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    toggleCodeBlock: (language?: string | null) => Command;
    setCodeBlockLanguage: (language: string | null) => Command;
  }
  interface QueryRegistry {
    codeBlockLanguage: () => string | null;
  }
}
export declare function normalizeLanguage(value: unknown): string | null;
export declare const DEFAULT_LANGUAGES: readonly CodeLanguage[];
export declare const CodeBlock: Extension<CodeBlockOptions>;
//# sourceMappingURL=index.d.ts.map
