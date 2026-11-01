import { Extension } from "@viveeditor/core";
import { Command } from "prosemirror-state";
export declare function normalizeColor(input: unknown): string | null;
type TextAlignment = "left" | "center" | "right" | "justify";
interface TextAlignOptions {
  types: readonly string[];
  alignments: readonly TextAlignment[];
  defaultAlignment: TextAlignment;
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    setTextAlign: (alignment: TextAlignment) => Command;
    unsetTextAlign: () => Command;
  }
  interface QueryRegistry {
    textAlign: () => TextAlignment;
  }
}
export declare const TextAlign: Extension<TextAlignOptions>;
interface ColorOptions {
  ignoredColors: readonly string[];
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    setTextColor: (color: string) => Command;
    unsetTextColor: () => Command;
    setHighlight: (color?: string) => Command;
    unsetHighlight: () => Command;
    toggleHighlight: () => Command;
  }
}
export declare const TextColor: Extension<ColorOptions>;
export declare const Highlight: Extension<ColorOptions>;
export declare const formatExtensions: readonly Extension[];
export type { ColorOptions, TextAlignOptions, TextAlignment };
//# sourceMappingURL=index.d.ts.map
