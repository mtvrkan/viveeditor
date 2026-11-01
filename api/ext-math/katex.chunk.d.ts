interface KatexLike {
  readonly version: string;
  render(latex: string, element: HTMLElement, options: Readonly<Record<string, unknown>>): void;
}
type KatexModule = KatexLike | {
  default: KatexLike;
};
type KatexLoader = () => Promise<KatexModule>;
type MathErrorCode = "KATEX_OUTDATED" | "KATEX_LOAD";
interface MathError {
  code: MathErrorCode;
  version?: string;
}
declare const MIN_KATEX_VERSION = "0.18.2";
declare const MAX_LATEX_LENGTH = 2e3;
declare function isSupportedKatex(version: unknown): boolean;
export { MIN_KATEX_VERSION as a, isSupportedKatex as c, MAX_LATEX_LENGTH as i, KatexLoader as n, MathError as o, KatexModule as r, MathErrorCode as s, KatexLike as t };
//# sourceMappingURL=katex-517YH_fa.d.ts.map
