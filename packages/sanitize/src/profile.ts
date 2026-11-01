import profileJson from './profile.json' with { type: 'json' }

export interface ElementRule {
  readonly attributes?: readonly string[]
  readonly styles?: readonly string[]
}

export interface EmbedProviderRule {
  readonly label: string
  readonly host: string
  readonly width: number
  readonly height: number
  readonly compactHeight?: number
  readonly compactTypes?: readonly string[]
  readonly fluid: boolean
  readonly sandbox: string
  readonly allow: string
}

export interface SanitizeProfile {
  readonly version: number
  readonly limits: {
    readonly maxBytes: number
    readonly maxDepth: number
    readonly maxAttributeLength: number
    readonly maxImageSrcLength: number
    readonly maxUrlLength: number
    readonly maxTextAttributeLength: number
    readonly maxStyleValueLength: number
    readonly maxSpan: number
    readonly maxImageSize: number
    readonly maxListStart: number
    readonly maxTableWidth: number
    readonly maxEmbedStart: number
    readonly maxEmbedTitle: number
    readonly maxMentionId: number
    readonly maxMentionLabel: number
    readonly maxMathLength: number
    readonly maxMathDepth: number
    readonly maxFootnoteLength: number
    readonly maxAttributes: number
    readonly maxNesting: number
    readonly maxExtraElements: number
  }
  readonly dropWithContent: readonly string[]
  readonly elements: Readonly<Record<string, ElementRule>>
  readonly mentionClass: string
  readonly footnoteElements: readonly string[]
  readonly textAlign: readonly string[]
  readonly linkProtocols: readonly string[]
  readonly linkRel: string
  readonly image: {
    readonly loading: string
    readonly decoding: string
    readonly referrerpolicy: string
    readonly base64Types: readonly string[]
  }
  readonly embedProviders: Readonly<Record<string, EmbedProviderRule>>
  readonly spotifyTypes: readonly string[]
  readonly colorKeywordsRejected: readonly string[]
  readonly namedColors: readonly string[]
}

export const VIVE_PROFILE: SanitizeProfile = profileJson
