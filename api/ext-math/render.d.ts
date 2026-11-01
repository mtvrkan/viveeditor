import { n as KatexLoader, o as MathError } from "./katex.chunk.js";
export interface RenderMathOptions {
  load: KatexLoader;
  onError?: (error: MathError) => void;
}
export declare function renderMath(root: ParentNode, options: RenderMathOptions): Promise<number>;
//# sourceMappingURL=render.d.ts.map
