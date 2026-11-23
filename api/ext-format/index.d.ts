import { Extension, normalizeColor } from "@viveeditor/core";
import { Command } from "prosemirror-state";
type TextCase = "upper" | "lower" | "title" | "sentence";
interface ChangeCaseOptions {
  locale: string | null;
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    changeCase: (mode: TextCase, fallbackLocale?: string) => Command;
    cycleCase: (fallbackLocale?: string) => Command;
  }
}
export declare const ChangeCase: Extension<ChangeCaseOptions>;
interface DocumentCleanup {
  extraSpaces: number;
  trailingBreaks: number;
  emptyParagraphs: number;
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    cleanDocument: () => Command;
  }
  interface QueryRegistry {
    documentCleanup: () => DocumentCleanup;
  }
}
export declare const CleanDocument: Extension<Record<string, never>>;
interface ClearFormattingOptions {
  keepMarks: readonly string[];
  blockAttributes: readonly string[];
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    clearFormatting: () => Command;
  }
}
export declare const ClearFormatting: Extension<ClearFormattingOptions>;
interface FontFamilyOptions {
  fontFamilies: readonly string[];
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    setFontFamily: (family: string) => Command;
    unsetFontFamily: () => Command;
  }
  interface QueryRegistry {
    fontFamily: () => string | null;
    fontFamilies: () => readonly string[];
  }
}
export declare const DEFAULT_FONT_FAMILIES: readonly string[];
export declare const FontFamily: Extension<FontFamilyOptions>;
type FontSizeStep = "tiny" | "small" | "big" | "huge";
export declare const FONT_SIZES: Readonly<Record<FontSizeStep, string>>;
export declare const MIN_FONT_POINTS = 6;
export declare const MAX_FONT_POINTS = 96;
export declare const FONT_POINT_PRESETS: readonly number[];
declare module "@viveeditor/core" {
  interface CommandRegistry {
    setFontSize: (size: FontSizeStep | number | string) => Command;
    unsetFontSize: () => Command;
    stepFontSize: (direction: 1 | -1) => Command;
  }
  interface QueryRegistry {
    fontSize: () => string | null;
    fontSizePoints: () => number | null;
  }
}
export declare function parseFontPoints(value: string): string | null;
export declare const FontSize: Extension<Record<string, never>>;
interface FormatPainterOptions {
  keepMarks: readonly string[];
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    copyFormat: () => Command;
    applyFormat: () => Command;
    cancelFormat: () => Command;
  }
  interface QueryRegistry {
    isPaintingFormat: () => boolean;
  }
}
export declare const FormatPainter: Extension<FormatPainterOptions>;
interface IndentOptions {
  types: readonly string[];
  skipParents: readonly string[];
  max: number;
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    indent: () => Command;
    outdent: () => Command;
  }
  interface QueryRegistry {
    indentLevel: () => number;
  }
}
export declare const Indent: Extension<IndentOptions>;
type LineHeightValue = "1" | "1.15" | "1.5" | "2";
interface LineHeightOptions {
  types: readonly string[];
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    setLineHeight: (value: LineHeightValue | null) => Command;
  }
  interface QueryRegistry {
    lineHeight: () => LineHeightValue | null;
  }
}
export declare const LINE_HEIGHTS: readonly LineHeightValue[];
export declare const LineHeight: Extension<LineHeightOptions>;
type PasteMode = "keep" | "clean" | "plain";
interface PasteOptionsSettings {
  keepMarks: readonly string[];
}
interface LastPaste {
  from: number;
  to: number;
  mode: PasteMode;
  hasText: boolean;
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    pasteAs: (mode: PasteMode) => Command;
    dismissPaste: () => Command;
  }
  interface QueryRegistry {
    lastPaste: () => LastPaste | null;
  }
}
export declare const PasteOptions: Extension<PasteOptionsSettings>;
declare module "@viveeditor/core" {
  interface CommandRegistry {
    toggleSubscript: () => Command;
    toggleSuperscript: () => Command;
  }
}
type NoOptions = Record<string, never>;
export declare const Subscript: Extension<NoOptions>;
export declare const Superscript: Extension<NoOptions>;
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
interface TypographyOptions {
  quotes: readonly [string, string, string, string] | null;
  dashes: boolean;
  symbols: boolean;
}
export declare const Typography: Extension<TypographyOptions>;
export declare const formatExtensions: readonly Extension[];
export { type ChangeCaseOptions, type ClearFormattingOptions, type ColorOptions, type DocumentCleanup, type FontFamilyOptions, type FontSizeStep, type FormatPainterOptions, type IndentOptions, type LastPaste, type LineHeightOptions, type LineHeightValue, type PasteMode, type PasteOptionsSettings, type TextAlignOptions, type TextAlignment, type TextCase, type TypographyOptions, normalizeColor };
