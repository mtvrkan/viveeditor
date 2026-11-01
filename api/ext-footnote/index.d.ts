import { Extension } from "@viveeditor/core";
import "prosemirror-model";
import { Command } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
interface FootnoteLabels {
  footnote: string;
  edit: string;
}
export declare const MAX_FOOTNOTE_LENGTH = 5e3;
export interface FootnoteOptions {
  labels: FootnoteLabels;
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    insertFootnote: () => Command;
  }
}
export declare const Footnote: Extension<FootnoteOptions>;
export type { FootnoteLabels };
//# sourceMappingURL=index.d.ts.map
