import { Extension } from "@viveeditor/core";
import { Command } from "prosemirror-state";
interface EmbedAttributes {
  provider: string;
  id: string;
  hash: string | null;
  start: number | null;
  title: string | null;
}
type EmbedInput = { readonly [Key in keyof EmbedAttributes]?: unknown; };
interface EmbedProvider {
  readonly name: string;
  readonly label: string;
  readonly host: string;
  readonly sandbox: string;
  readonly allow: string;
  readonly width: number;
  readonly height: (id: string) => number;
  readonly fluid: boolean;
  readonly id: RegExp;
  readonly path: (id: string) => string;
  readonly query: (embed: EmbedAttributes, autoplay: boolean) => Record<string, string>;
  readonly fragment: (embed: EmbedAttributes) => string;
  readonly watch: (embed: EmbedAttributes) => string;
  readonly match: (url: URL) => Omit<EmbedAttributes, "provider" | "title"> | null;
}
export declare const EMBED_PROVIDERS: Readonly<Record<string, EmbedProvider>>;
export declare function matchEmbedUrl(input: unknown, enabled?: readonly string[]): EmbedAttributes | null;
export declare function buildEmbedSrc(attrs: EmbedInput, options?: {
  autoplay?: boolean;
  enabled?: readonly string[];
}): string | null;
export declare function isAllowedEmbedSrc(src: unknown, enabled?: readonly string[]): boolean;
export interface EmbedLabels {
  play: string;
  invalid: string;
}
export interface EmbedOptions {
  providers: readonly string[];
  facade: boolean;
  pasteToEmbed: boolean;
  maxEmbeds: number;
  labels: EmbedLabels;
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    insertEmbed: (url: string) => Command;
    setEmbedTitle: (title: string) => Command;
  }
  interface QueryRegistry {
    selectedEmbed: () => EmbedAttributes | null;
    embedProviders: () => string[];
  }
}
export declare const Embed: Extension<EmbedOptions>;
export type { EmbedAttributes, EmbedInput, EmbedProvider };
//# sourceMappingURL=index.d.ts.map
