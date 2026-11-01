export interface EmbedAttributes {
  provider: string
  id: string
  hash: string | null
  start: number | null
  title: string | null
}

export type EmbedInput = { readonly [Key in keyof EmbedAttributes]?: unknown }

export interface EmbedProvider {
  readonly name: string
  readonly label: string
  readonly host: string
  readonly sandbox: string
  readonly allow: string
  readonly width: number
  readonly height: (id: string) => number
  readonly fluid: boolean
  readonly id: RegExp
  readonly path: (id: string) => string
  readonly query: (embed: EmbedAttributes, autoplay: boolean) => Record<string, string>
  readonly fragment: (embed: EmbedAttributes) => string
  readonly watch: (embed: EmbedAttributes) => string
  readonly match: (url: URL) => Omit<EmbedAttributes, 'provider' | 'title'> | null
}

const VIDEO_SANDBOX =
  'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox'
const MAX_START = 86_400
const MAX_TITLE = 200
const MAX_URL = 2048
const PROVIDER_NAME = /^[a-z][a-z0-9-]{0,31}$/
const VIMEO_HASH = /^[0-9a-f]{8,20}$/
const TIMESTAMP = /^(?:(\d{1,2})h)?(?:(\d{1,4})m)?(?:(\d{1,5})s?)?$/

function seconds(value: string | null | undefined): number | null {
  if (!value) return null
  const parts = TIMESTAMP.exec(value)
  if (!parts) return null
  const total = Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0)
  return total > 0 && total <= MAX_START ? total : null
}

const segments = (url: URL): string[] => url.pathname.split('/').filter(Boolean)

const youtube: EmbedProvider = {
  name: 'youtube',
  label: 'YouTube',
  host: 'www.youtube-nocookie.com',
  sandbox: VIDEO_SANDBOX,
  allow: 'fullscreen; picture-in-picture; encrypted-media',
  width: 560,
  height: () => 315,
  fluid: true,
  id: /^[A-Za-z0-9_-]{11}$/,
  path: (id) => `/embed/${id}`,
  query: (embed, autoplay) => ({
    ...(embed.start ? { start: String(embed.start) } : {}),
    ...(autoplay ? { autoplay: '1' } : {}),
  }),
  fragment: () => '',
  watch: (embed) =>
    `https://www.youtube.com/watch?v=${embed.id}${embed.start ? `&t=${embed.start}s` : ''}`,
  match: (url) => {
    const host = url.hostname
    const parts = segments(url)
    const start = seconds(url.searchParams.get('t') ?? url.searchParams.get('start'))
    let id: string | undefined
    if (host === 'youtu.be') id = parts[0]
    else if (['youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
      if (parts[0] === 'embed') id = parts[1]
    } else if (
      ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)
    ) {
      if (url.pathname === '/watch') id = url.searchParams.get('v') ?? undefined
      else if (['embed', 'shorts', 'live'].includes(parts[0] ?? '')) id = parts[1]
    }
    return id ? { id, hash: null, start } : null
  },
}

const vimeo: EmbedProvider = {
  name: 'vimeo',
  label: 'Vimeo',
  host: 'player.vimeo.com',
  sandbox: VIDEO_SANDBOX,
  allow: 'fullscreen; picture-in-picture; encrypted-media',
  width: 640,
  height: () => 360,
  fluid: true,
  id: /^[1-9]\d{0,11}$/,
  path: (id) => `/video/${id}`,
  query: (embed, autoplay) => ({
    dnt: '1',
    ...(embed.hash ? { h: embed.hash } : {}),
    ...(autoplay ? { autoplay: '1' } : {}),
  }),
  fragment: (embed) => (embed.start ? `#t=${embed.start}s` : ''),
  watch: (embed) =>
    `https://vimeo.com/${embed.id}${embed.hash ? `/${embed.hash}` : ''}${embed.start ? `#t=${embed.start}s` : ''}`,
  match: (url) => {
    const parts = segments(url)
    const start = seconds(/^#t=(.+)$/.exec(url.hash)?.[1])
    if (url.hostname === 'player.vimeo.com') {
      return parts[0] === 'video' && parts[1]
        ? { id: parts[1], hash: url.searchParams.get('h'), start }
        : null
    }
    if (!['vimeo.com', 'www.vimeo.com'].includes(url.hostname) || !parts[0]) return null
    return { id: parts[0], hash: parts[1] ?? url.searchParams.get('h'), start }
  },
}

const SPOTIFY_TYPES = ['track', 'album', 'playlist', 'episode', 'show', 'artist']

const spotify: EmbedProvider = {
  name: 'spotify',
  label: 'Spotify',
  host: 'open.spotify.com',
  sandbox: 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox',
  allow: 'fullscreen; encrypted-media',
  width: 560,
  height: (id) => (id.startsWith('track:') || id.startsWith('episode:') ? 152 : 352),
  fluid: false,
  id: /^(?:track|album|playlist|episode|show|artist):[A-Za-z0-9]{22}$/,
  path: (id) => `/embed/${id.replace(':', '/')}`,
  query: () => ({}),
  fragment: () => '',
  watch: (embed) => `https://open.spotify.com/${embed.id.replace(':', '/')}`,
  match: (url) => {
    if (url.hostname !== 'open.spotify.com') return null
    const parts = segments(url).filter((part) => part !== 'embed' && !part.startsWith('intl-'))
    const [type, id] = parts
    return type && id && SPOTIFY_TYPES.includes(type)
      ? { id: `${type}:${id}`, hash: null, start: null }
      : null
  },
}

export const EMBED_PROVIDERS: Readonly<Record<string, EmbedProvider>> = Object.freeze({
  youtube: Object.freeze(youtube),
  vimeo: Object.freeze(vimeo),
  spotify: Object.freeze(spotify),
})

const isInvisible = (code: number): boolean =>
  code <= 0x20 ||
  (code >= 0x7f && code <= 0x9f) ||
  code === 0xad ||
  (code >= 0x200b && code <= 0x200f) ||
  code === 0x2028 ||
  code === 0x2029 ||
  code === 0x2060 ||
  code === 0xfeff

function stripInvisible(value: string): string {
  let result = ''
  for (const character of value) {
    if (!isInvisible(character.charCodeAt(0))) result += character
  }
  return result
}

function cleanTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null
  let result = ''
  for (const character of value) {
    const code = character.charCodeAt(0)
    result += code < 0x20 || (code >= 0x7f && code <= 0x9f) ? ' ' : character
  }
  return result.trim().slice(0, MAX_TITLE) || null
}

function cleanStart(value: unknown): number | null {
  const number = typeof value === 'string' && /^\d{1,5}$/.test(value) ? Number(value) : value
  return typeof number === 'number' && Number.isInteger(number) && number > 0 && number <= MAX_START
    ? number
    : null
}

const providerOf = (name: unknown, enabled?: readonly string[]): EmbedProvider | null =>
  typeof name === 'string' &&
  PROVIDER_NAME.test(name) &&
  Object.hasOwn(EMBED_PROVIDERS, name) &&
  (!enabled || enabled.includes(name))
    ? (EMBED_PROVIDERS[name] ?? null)
    : null

export function cleanEmbed(attrs: EmbedInput, enabled?: readonly string[]): EmbedAttributes | null {
  const provider = providerOf(attrs.provider, enabled)
  if (!provider || typeof attrs.id !== 'string' || !provider.id.test(attrs.id)) return null
  const hash =
    provider.name === 'vimeo' && typeof attrs.hash === 'string' && VIMEO_HASH.test(attrs.hash)
      ? attrs.hash
      : null
  return {
    provider: provider.name,
    id: attrs.id,
    hash,
    start: provider.name === 'spotify' ? null : cleanStart(attrs.start),
    title: cleanTitle(attrs.title),
  }
}

export function matchEmbedUrl(input: unknown, enabled?: readonly string[]): EmbedAttributes | null {
  if (typeof input !== 'string' || input.length > MAX_URL) return null
  const text = stripInvisible(input)
  let url: URL
  try {
    url = new URL(text.startsWith('//') ? `https:${text}` : text)
  } catch {
    return null
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) {
    return null
  }
  for (const provider of Object.values(EMBED_PROVIDERS)) {
    const found = provider.match(url)
    if (found) return cleanEmbed({ ...found, provider: provider.name }, enabled)
  }
  return null
}

export function buildEmbedSrc(
  attrs: EmbedInput,
  options: { autoplay?: boolean; enabled?: readonly string[] } = {},
): string | null {
  const embed = cleanEmbed(attrs, options.enabled)
  const provider = embed && providerOf(embed.provider)
  if (!embed || !provider) return null
  const url = new URL(`https://${provider.host}`)
  url.pathname = provider.path(embed.id)
  for (const [key, value] of Object.entries(provider.query(embed, options.autoplay === true))) {
    url.searchParams.set(key, value)
  }
  const expected = provider.path(embed.id)
  const safe =
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.port &&
    url.hostname === provider.host &&
    url.pathname === expected
  return safe ? `${url.href}${provider.fragment(embed)}` : null
}

export function isAllowedEmbedSrc(src: unknown, enabled?: readonly string[]): boolean {
  if (typeof src !== 'string') return false
  const embed = matchEmbedUrl(src, enabled)
  if (!embed) return false
  try {
    const url = new URL(src)
    const provider = providerOf(embed.provider)
    return provider !== null && url.hostname === provider.host && buildEmbedSrc(embed) === src
  } catch {
    return false
  }
}

export function embedProvider(name: unknown): EmbedProvider | null {
  return providerOf(name)
}

export function iframeAttributes(
  embed: EmbedAttributes,
  provider: EmbedProvider,
  src: string,
  autoplay = false,
): Record<string, string> {
  const height = provider.height(embed.id)
  return {
    src,
    title: embed.title ?? provider.label,
    width: String(provider.width),
    height: String(height),
    style: provider.fluid
      ? `width: 100%; height: auto; aspect-ratio: ${provider.width} / ${height}; border: 0`
      : `width: 100%; height: ${height}px; border: 0`,
    loading: 'lazy',
    referrerpolicy: 'strict-origin-when-cross-origin',
    sandbox: provider.sandbox,
    allow: autoplay ? `${provider.allow}; autoplay` : provider.allow,
    allowfullscreen: '',
  }
}
