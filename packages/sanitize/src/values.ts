import { VIVE_PROFILE } from './profile.js'

const { limits } = VIVE_PROFILE
const SCHEME = /^([a-z][a-z0-9+.-]*):/i
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGB =
  /^rgba?\([\t\n\f\r ]*([0-9]{1,3})[\t\n\f\r ]*,[\t\n\f\r ]*([0-9]{1,3})[\t\n\f\r ]*,[\t\n\f\r ]*([0-9]{1,3})[\t\n\f\r ]*(?:,[\t\n\f\r ]*([0-9.]+%?)[\t\n\f\r ]*)?\)$/i
const HSL =
  /^hsla?\([\t\n\f\r ]*[0-9]{1,3}(?:\.[0-9]+)?(?:deg)?[\t\n\f\r ]*,?[\t\n\f\r ]*[0-9]{1,3}(?:\.[0-9]+)?%[\t\n\f\r ]*,?[\t\n\f\r ]*[0-9]{1,3}(?:\.[0-9]+)?%[\t\n\f\r ]*(?:[,/][\t\n\f\r ]*[0-9.]+%?[\t\n\f\r ]*)?\)$/i
const PIXELS = /^([0-9]{1,5})px$/
const DIGITS = /^[0-9]{1,5}$/
const LANGUAGE = /^[a-z0-9][a-z0-9+#.-]{0,31}$/i
const HTTPS_URL =
  /^https:\/\/[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?(?::[0-9]{1,5})?(?:[/?#][\x21-\x7e]*)?$/i
const BASE64_IMAGE = /^data:image\/([a-z]+);base64,[A-Za-z0-9+/]+={0,2}$/
const URL_FORBIDDEN = /["'<>\\`]/
const BANNED_STYLE = ['\\', '/*', 'url(', 'expression', '@', '!important']
const NAMED_COLORS = new Set(VIVE_PROFILE.namedColors)
const REJECTED_COLORS = new Set(VIVE_PROFILE.colorKeywordsRejected)

const SPACE = /[\t\n\f\r ]+/g
const MENTION_ID = new RegExp(
  `^(?!.*\\.\\.)[A-Za-z0-9_][A-Za-z0-9_.:@-]{0,${limits.maxMentionId - 1}}$`,
)

export const byteLength = (value: string): number => Buffer.byteLength(value, 'utf8')

export const lowerAscii = (value: string): string =>
  value.replace(/[A-Z]/g, (letter) => letter.toLowerCase())

export const trimAscii = (value: string): string =>
  value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '')

export function cleanText(value: string, max: number = limits.maxTextAttributeLength): string {
  const result: string[] = []
  for (const character of value) {
    if (result.length >= max) break
    const code = character.codePointAt(0) ?? 0
    result.push(code < 0x20 || (code >= 0x7f && code <= 0x9f) ? ' ' : character)
  }
  return result.join('')
}

const isHidden = (code: number): boolean =>
  code <= 0x1f ||
  (code >= 0x7f && code <= 0x9f) ||
  (code >= 0x200b && code <= 0x200f) ||
  (code >= 0x202a && code <= 0x202e) ||
  (code >= 0x2066 && code <= 0x2069) ||
  code === 0xfeff

export const isMentionId = (value: string): boolean => MENTION_ID.test(value)

export function cleanMentionLabel(value: string): string {
  let result = ''
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code === 0x09 || code === 0x0a || code === 0x0d) result += ' '
    else if (!isHidden(code)) result += character
  }
  const label = trimAscii(trimAscii(result.replace(SPACE, ' ')).replace(/^@+/, ''))
  return trimAscii(Array.from(label).slice(0, limits.maxMentionLabel).join(''))
}

export function cleanLatex(value: string): string | null {
  let result = ''
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (code === 0x09 || code === 0x0a || !isHidden(code)) result += character
  }
  const latex = trimAscii(result)
  if (latex === '' || Array.from(latex).length > limits.maxMathLength) return null
  let depth = 0
  for (const character of latex) {
    if (character === '{') depth++
    else if (character === '}') depth = Math.max(0, depth - 1)
    if (depth > limits.maxMathDepth) return null
  }
  return latex
}

export function takeCodePoints(value: string, budget: { left: number }): string {
  if (budget.left <= 0) return ''
  const characters = Array.from(value)
  const kept = characters.slice(0, budget.left)
  budget.left -= kept.length
  return kept.join('')
}

export function cleanInteger(value: string | undefined, min: number, max: number): number | null {
  if (value === undefined || !DIGITS.test(value)) return null
  const number = Number(value)
  return number >= min && number <= max ? number : null
}

export function cleanLanguage(value: string | undefined): string | null {
  return value !== undefined && LANGUAGE.test(value) ? lowerAscii(value) : null
}

export function cleanColWidth(value: string | undefined): string | null {
  if (value === undefined) return null
  const parts = value.split(',')
  if (parts.length > limits.maxSpan) return null
  return parts.every((part) => cleanInteger(part, 1, 9999) !== null) ? value : null
}

const hexPair = (value: number): string => Math.min(255, value).toString(16).padStart(2, '0')

function expandHex(hex: string): string {
  const digits = lowerAscii(hex.slice(1))
  if (digits.length > 4) return `#${digits}`
  return `#${[...digits].map((digit) => digit + digit).join('')}`
}

function alphaOf(raw: string | undefined): number {
  if (raw === undefined) return 1
  const value = Number.parseFloat(raw)
  return raw.endsWith('%') ? value / 100 : value
}

export function cleanColor(input: string): string | null {
  const value = trimAscii(input)
  const lower = lowerAscii(value)
  if (value === '' || REJECTED_COLORS.has(lower)) return null
  if (HEX.test(value)) {
    const hex = expandHex(value)
    return hex.length === 9 && hex.endsWith('00') ? null : hex
  }
  const rgb = RGB.exec(value)
  if (rgb) {
    const alpha = alphaOf(rgb[4])
    if (!(alpha > 0)) return null
    const [red, green, blue] = [rgb[1], rgb[2], rgb[3]].map((part) => Number(part))
    const hex = `#${hexPair(red ?? 0)}${hexPair(green ?? 0)}${hexPair(blue ?? 0)}`
    return alpha >= 1 ? hex : `${hex}${hexPair(Math.round(alpha * 255))}`
  }
  if (HSL.test(value)) return lower.replace(SPACE, ' ')
  return NAMED_COLORS.has(lower) ? lower : null
}

function styleValue(property: string, value: string): string | null {
  if (property === 'text-align') {
    const align = lowerAscii(value)
    return VIVE_PROFILE.textAlign.includes(align) ? align : null
  }
  if (property === 'color' || property === 'background-color') return cleanColor(value)
  const pixels = PIXELS.exec(value)
  const number = pixels ? Number(pixels[1]) : 0
  return number > 0 && number <= limits.maxTableWidth ? `${number}px` : null
}

export function cleanStyle(value: string, allowed: readonly string[]): string | null {
  if (byteLength(value) > allowed.length * (limits.maxStyleValueLength + 32)) return null
  const lower = lowerAscii(value)
  if (BANNED_STYLE.some((banned) => lower.includes(banned))) return null
  const result = new Map<string, string>()
  for (const declaration of value.split(';')) {
    const colon = declaration.indexOf(':')
    if (colon < 0) continue
    const property = lowerAscii(trimAscii(declaration.slice(0, colon)))
    const raw = trimAscii(declaration.slice(colon + 1))
    if (!allowed.includes(property) || result.has(property)) continue
    if (byteLength(raw) > limits.maxStyleValueLength) continue
    const clean = styleValue(property, raw)
    if (clean !== null) result.set(property, clean)
  }
  return result.size > 0
    ? [...result].map(([property, clean]) => `${property}: ${clean}`).join('; ')
    : null
}

function trimEdges(value: string): string {
  let start = 0
  let end = value.length
  while (start < end && value.charCodeAt(start) <= 0x20) start++
  while (end > start && value.charCodeAt(end - 1) <= 0x20) end--
  return value.slice(start, end)
}

const hasControl = (value: string): boolean => {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true
  }
  return false
}

export function cleanHref(input: string): string | null {
  if (byteLength(input) > limits.maxAttributeLength) return null
  const value = trimEdges(input.replace(/[\t\n\r]/g, ''))
  if (value === '' || hasControl(value) || value.includes('\\') || value.startsWith('//')) {
    return null
  }
  const found = SCHEME.exec(value)?.[1]
  if (found === undefined) return value
  const scheme = lowerAscii(found)
  if (!VIVE_PROFILE.linkProtocols.includes(scheme)) return null
  if ((scheme === 'http' || scheme === 'https') && !/^https?:\/\/[^/]/i.test(value)) return null
  return value
}

export interface ImagePolicy {
  allowBase64: boolean
  allowRelative: boolean
}

export function cleanImageSrc(input: string, policy: ImagePolicy): string | null {
  const value = trimEdges(input.replace(/[\t\n\r]/g, ''))
  if (value === '' || hasControl(value)) return null
  const base64 = BASE64_IMAGE.exec(value)
  if (base64) {
    return policy.allowBase64 &&
      byteLength(value) <= limits.maxImageSrcLength &&
      VIVE_PROFILE.image.base64Types.includes(base64[1] ?? '')
      ? value
      : null
  }
  if (byteLength(value) > limits.maxUrlLength || URL_FORBIDDEN.test(value)) return null
  const candidate = value.startsWith('//')
    ? `https:${value}`
    : /^http:\/\//i.test(value)
      ? `https://${value.slice(7)}`
      : value
  if (HTTPS_URL.test(candidate)) return candidate
  const scheme = SCHEME.exec(value)
  if (scheme || value.startsWith('//') || !policy.allowRelative) return null
  return /^[\x21-\x7e ]+$/.test(value) ? value.replaceAll(' ', '%20') : null
}
