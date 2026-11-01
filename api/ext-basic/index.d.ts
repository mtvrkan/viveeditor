import { Extension } from "@viveeditor/core";
import { Command } from "prosemirror-state";
interface LinkAttributes {
  href: string;
  title?: string | null;
}
interface LinkOptions {
  protocols: readonly string[];
  rel: string;
  openInNewTab: boolean;
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    setLink: (attributes: LinkAttributes) => Command;
    unsetLink: () => Command;
  }
}
export declare const Link: Extension<LinkOptions>;
declare module "@viveeditor/core" {
  interface CommandRegistry {
    toggleBold: () => Command;
    toggleItalic: () => Command;
    toggleUnderline: () => Command;
    toggleStrike: () => Command;
    toggleCode: () => Command;
  }
}
type NoOptions$1 = Record<string, never>;
export declare const Bold: Extension<NoOptions$1>;
export declare const Italic: Extension<NoOptions$1>;
export declare const Underline: Extension<NoOptions$1>;
export declare const Strike: Extension<NoOptions$1>;
export declare const Code: Extension<NoOptions$1>;
type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
interface HeadingOptions {
  levels: readonly HeadingLevel[];
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    toggleHeading: (attributes: {
      level: HeadingLevel;
    }) => Command;
    toggleBlockquote: () => Command;
    setHorizontalRule: () => Command;
    setHardBreak: () => Command;
  }
}
type NoOptions = Record<string, never>;
export declare const Heading: Extension<HeadingOptions>;
export declare const Blockquote: Extension<NoOptions>;
export declare const HorizontalRule: Extension<NoOptions>;
export declare const HardBreak: Extension<NoOptions>;
export declare const basicExtensions: readonly Extension[];
export type { HeadingLevel, HeadingOptions, LinkAttributes, LinkOptions };
//# sourceMappingURL=index.d.ts.map
