import { Extension } from "@viveeditor/core";
import { Node } from "prosemirror-model";
export interface CharacterCountOptions {
  limit: number | null;
}
declare module "@viveeditor/core" {
  interface QueryRegistry {
    characterCount: () => number;
    characterLimit: () => number | null;
  }
}
export declare function countCharacters(node: Node): number;
export declare const CharacterCount: Extension<CharacterCountOptions>;
//# sourceMappingURL=index.d.ts.map
