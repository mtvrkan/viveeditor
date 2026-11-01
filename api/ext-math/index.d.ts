import { a as MIN_KATEX_VERSION, c as isSupportedKatex, i as MAX_LATEX_LENGTH, n as KatexLoader, o as MathError, r as KatexModule, s as MathErrorCode, t as KatexLike } from "./katex.chunk.js";
import { Extension } from "@viveeditor/core";
import { Command } from "prosemirror-state";
import "prosemirror-model";
import "prosemirror-view";
interface MathLabels {
  empty: string;
  edit: string;
}
export interface MathOptions {
  load: KatexLoader | null;
  labels: MathLabels;
  onError: ((error: MathError) => void) | null;
}
export interface InsertMathOptions {
  display?: boolean;
  latex?: string;
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    insertMath: (options?: InsertMathOptions) => Command;
  }
}
export declare const MathExtension: Extension<MathOptions>;
export { type KatexLike, type KatexLoader, type KatexModule, MAX_LATEX_LENGTH, MIN_KATEX_VERSION, type MathError, type MathErrorCode, type MathLabels, isSupportedKatex };
//# sourceMappingURL=index.d.ts.map
