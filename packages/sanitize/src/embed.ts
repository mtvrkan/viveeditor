import { type EmbedProviderRule, VIVE_PROFILE } from './profile.js'
import { cleanInteger, cleanText, trimAscii } from './values.js'

export interface EmbedData {
  provider: string
  rule: EmbedProviderRule
  id: string
  hash: string | null
  start: number | null
  title: string | null
}

const IDS: Readonly<Record<string, RegExp>> = {
  youtube: /^[A-Za-z0-9_-]{11}$/,
  vimeo: /^[1-9][0-9]{0,11}$/,
  spotify: new RegExp(`^(?:${VIVE_PROFILE.spotifyTypes.join('|')}):[A-Za-z0-9]{22}$`),
}
const VIMEO_HASH = /^[0-9a-f]{8,20}$/

export function cleanEmbed(attributes: ReadonlyMap<string, string>): EmbedData | null {
  const provider = attributes.get('data-embed') ?? ''
  const rule = Object.hasOwn(VIVE_PROFILE.embedProviders, provider)
    ? VIVE_PROFILE.embedProviders[provider]
    : undefined
  const pattern = IDS[provider]
  const id = attributes.get('data-id') ?? ''
  if (!rule || !pattern?.test(id)) return null
  const hash = attributes.get('data-hash')
  const title = attributes.get('data-title')
  const cleanTitle =
    title === undefined
      ? null
      : cleanText(
          trimAscii(cleanText(title, Number.POSITIVE_INFINITY)),
          VIVE_PROFILE.limits.maxEmbedTitle,
        ) || null
  return {
    provider,
    rule,
    id,
    hash: provider === 'vimeo' && hash !== undefined && VIMEO_HASH.test(hash) ? hash : null,
    start:
      provider === 'spotify'
        ? null
        : cleanInteger(attributes.get('data-start'), 1, VIVE_PROFILE.limits.maxEmbedStart),
    title: cleanTitle,
  }
}

export function embedSrc(embed: EmbedData): string {
  const base = `https://${embed.rule.host}`
  if (embed.provider === 'youtube') {
    return `${base}/embed/${embed.id}${embed.start ? `?start=${embed.start}` : ''}`
  }
  if (embed.provider === 'vimeo') {
    const hash = embed.hash ? `&h=${embed.hash}` : ''
    const start = embed.start ? `#t=${embed.start}s` : ''
    return `${base}/video/${embed.id}?dnt=1${hash}${start}`
  }
  return `${base}/embed/${embed.id.replace(':', '/')}`
}

export function embedWatchUrl(embed: EmbedData): string {
  if (embed.provider === 'youtube') {
    return `https://www.youtube.com/watch?v=${embed.id}${embed.start ? `&t=${embed.start}s` : ''}`
  }
  if (embed.provider === 'vimeo') {
    const hash = embed.hash ? `/${embed.hash}` : ''
    return `https://vimeo.com/${embed.id}${hash}${embed.start ? `#t=${embed.start}s` : ''}`
  }
  return `https://open.spotify.com/${embed.id.replace(':', '/')}`
}

export function wrapperAttributes(embed: EmbedData): [string, string][] {
  const result: [string, string][] = [
    ['class', 'vive-embed'],
    ['data-embed', embed.provider],
    ['data-id', embed.id],
  ]
  if (embed.hash) result.push(['data-hash', embed.hash])
  if (embed.start) result.push(['data-start', String(embed.start)])
  if (embed.title) result.push(['data-title', embed.title])
  return result
}

export function iframeAttributes(embed: EmbedData): [string, string][] {
  const { rule } = embed
  const compact = rule.compactTypes?.some((type) => embed.id.startsWith(`${type}:`)) ?? false
  const height = compact && rule.compactHeight ? rule.compactHeight : rule.height
  return [
    ['src', embedSrc(embed)],
    ['title', embed.title ?? rule.label],
    ['width', String(rule.width)],
    ['height', String(height)],
    [
      'style',
      rule.fluid
        ? `width: 100%; height: auto; aspect-ratio: ${rule.width} / ${height}; border: 0`
        : `width: 100%; height: ${height}px; border: 0`,
    ],
    ['loading', 'lazy'],
    ['referrerpolicy', 'strict-origin-when-cross-origin'],
    ['sandbox', rule.sandbox],
    ['allow', rule.allow],
    ['allowfullscreen', ''],
  ]
}
