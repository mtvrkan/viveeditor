interface ElementRule {
  readonly attributes?: readonly string[];
  readonly styles?: readonly string[];
}
interface EmbedProviderRule {
  readonly label: string;
  readonly host: string;
  readonly width: number;
  readonly height: number;
  readonly compactHeight?: number;
  readonly compactTypes?: readonly string[];
  readonly fluid: boolean;
  readonly sandbox: string;
  readonly allow: string;
}
interface SanitizeProfile {
  readonly version: number;
  readonly limits: {
    readonly maxBytes: number;
    readonly maxDepth: number;
    readonly maxAttributeLength: number;
    readonly maxImageSrcLength: number;
    readonly maxUrlLength: number;
    readonly maxTextAttributeLength: number;
    readonly maxStyleValueLength: number;
    readonly maxSpan: number;
    readonly maxImageSize: number;
    readonly maxListStart: number;
    readonly maxTableWidth: number;
    readonly maxEmbedStart: number;
    readonly maxEmbedTitle: number;
    readonly maxMentionId: number;
    readonly maxMentionLabel: number;
    readonly maxMathLength: number;
    readonly maxMathDepth: number;
    readonly maxFootnoteLength: number;
    readonly maxAttributes: number;
    readonly maxNesting: number;
    readonly maxExtraElements: number;
  };
  readonly dropWithContent: readonly string[];
  readonly elements: Readonly<Record<string, ElementRule>>;
  readonly mentionClass: string;
  readonly footnoteElements: readonly string[];
  readonly textAlign: readonly string[];
  readonly linkProtocols: readonly string[];
  readonly linkRel: string;
  readonly image: {
    readonly loading: string;
    readonly decoding: string;
    readonly referrerpolicy: string;
    readonly base64Types: readonly string[];
  };
  readonly embedProviders: Readonly<Record<string, EmbedProviderRule>>;
  readonly spotifyTypes: readonly string[];
  readonly colorKeywordsRejected: readonly string[];
  readonly namedColors: readonly string[];
}
export declare const VIVE_PROFILE: SanitizeProfile;
interface SanitizeOptions {
  embeds?: boolean;
  allowBase64?: boolean;
  allowRelativeImages?: boolean;
  maxBytes?: number;
}
type SanitizeErrorCode = "TOO_LARGE" | "TOO_COMPLEX";
export declare class SanitizeError extends Error {
  readonly code: SanitizeErrorCode;
  constructor(code: SanitizeErrorCode, message: string);
}
export declare function sanitizeHtml(input: string, options?: SanitizeOptions): string;
export type { ElementRule, EmbedProviderRule, SanitizeErrorCode, SanitizeOptions, SanitizeProfile };
//# sourceMappingURL=index.d.mts.map
