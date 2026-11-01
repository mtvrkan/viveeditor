export interface ImageSourcePolicy {
  allowBase64: boolean
  maxBase64Length: number
  insecure: 'block' | 'upgrade'
  allowRelative: boolean
}

export interface ImageAttributes {
  src: string
  alt?: string | null
  title?: string | null
  width?: number | null
  height?: number | null
}

export interface CleanImage {
  src: string | null
  alt: string | null
  title: string | null
  width: number | null
  height: number | null
}

export const DEFAULT_SOURCE_POLICY: ImageSourcePolicy = {
  allowBase64: false,
  maxBase64Length: 1_500_000,
  insecure: 'upgrade',
  allowRelative: false,
}

const MAX_URL_LENGTH = 4096
const MAX_TEXT_LENGTH = 1000
const MAX_DIMENSION = 10_000
const SCHEME = /^([a-z][a-z0-9+.-]*):/i
const DATA = /^data:image\/(?:png|jpeg|gif|webp|avif);base64,[A-Za-z0-9+/]+={0,2}$/
const LINE_BREAKS = /[\t\n\r]/g
const DIGITS = /^\d{1,5}$/

const isControl = (code: number): boolean =>
  code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029

const isInvisible = (code: number): boolean =>
  isControl(code) ||
  code === 0xad ||
  (code >= 0x200b && code <= 0x200f) ||
  code === 0x2060 ||
  code === 0xfeff

function hasInvisible(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    if (isInvisible(value.charCodeAt(index))) return true
  }
  return false
}

function trimEdges(value: string): string {
  let start = 0
  let end = value.length
  while (start < end && value.charCodeAt(start) <= 0x20) start++
  while (end > start && value.charCodeAt(end - 1) <= 0x20) end--
  return value.slice(start, end)
}

function secure(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname ? parsed.href : null
  } catch {
    return null
  }
}

export function normalizeImageSrc(
  value: unknown,
  policy: ImageSourcePolicy = DEFAULT_SOURCE_POLICY,
): string | null {
  if (typeof value !== 'string') return null
  if (value.length > Math.max(policy.maxBase64Length, MAX_URL_LENGTH) + 64) return null
  const src = trimEdges(value.replace(LINE_BREAKS, ''))
  if (src === '' || hasInvisible(src) || src.includes('\\')) return null
  const scheme = SCHEME.exec(src)?.[1]?.toLowerCase()
  if (scheme === 'data') {
    return policy.allowBase64 && src.length <= policy.maxBase64Length && DATA.test(src) ? src : null
  }
  if (src.length > MAX_URL_LENGTH) return null
  if (src.startsWith('//')) return secure(`https:${src}`)
  if (scheme === 'https') return secure(src)
  if (scheme === 'http')
    return policy.insecure === 'upgrade' ? secure(`https:${src.slice(5)}`) : null
  if (scheme) return null
  return policy.allowRelative ? src.replaceAll(' ', '%20') : null
}

export function isAllowedImageSrc(
  value: unknown,
  policy: ImageSourcePolicy = DEFAULT_SOURCE_POLICY,
): boolean {
  return normalizeImageSrc(value, policy) !== null
}

export function isRemoteSrc(src: string): boolean {
  return src.startsWith('https:')
}

export function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return Array.from(value, (character) => (isControl(character.charCodeAt(0)) ? ' ' : character))
    .join('')
    .trim()
    .slice(0, MAX_TEXT_LENGTH)
}

export function cleanDimension(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.min(MAX_DIMENSION, Math.max(1, Math.round(value))) : null
  }
  if (typeof value !== 'string' || !DIGITS.test(value.trim())) return null
  return Math.min(MAX_DIMENSION, Math.max(1, Number(value)))
}

export function cleanImage(attrs: Record<string, unknown>, policy: ImageSourcePolicy): CleanImage {
  const title = cleanText(attrs.title)
  return {
    src: normalizeImageSrc(attrs.src, policy),
    alt: cleanText(attrs.alt),
    title: title || null,
    width: cleanDimension(attrs.width),
    height: cleanDimension(attrs.height),
  }
}
