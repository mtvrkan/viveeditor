import { Extension } from "@viveeditor/core";
import { Command } from "prosemirror-state";
export interface MentionAttributes {
  id: string;
  label: string;
}
export interface MentionOptions {
  maxLabelLength: number;
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    insertMention: (mention: MentionAttributes) => Command;
  }
}
export declare const MENTION_ID_PATTERN: RegExp;
export declare const MAX_MENTION_LABEL: number;
export declare function isMentionId(value: unknown): value is string;
export declare function cleanMentionLabel(value: unknown, max?: number): string;
export declare function cleanMention(attrs: {
  id?: unknown;
  label?: unknown;
}, max?: number): MentionAttributes | null;
export declare const Mention: Extension<MentionOptions>;
//# sourceMappingURL=index.d.ts.map
