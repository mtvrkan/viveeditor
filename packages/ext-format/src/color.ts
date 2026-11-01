const HEX = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i
const RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+%?)\s*)?\)$/i
const HSL =
  /^hsla?\(\s*\d{1,3}(?:\.\d+)?(?:deg)?\s*,?\s*\d{1,3}(?:\.\d+)?%\s*,?\s*\d{1,3}(?:\.\d+)?%\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/i
const NAMED = /^[a-z]{3,20}$/i
const KEYWORDS = new Set([
  'inherit',
  'initial',
  'unset',
  'revert',
  'currentcolor',
  'transparent',
  'auto',
  'none',
  'windowtext',
])

const hexPair = (value: number): string => Math.min(255, value).toString(16).padStart(2, '0')

function expandHex(hex: string): string {
  const digits = hex.slice(1).toLowerCase()
  if (digits.length > 4) return `#${digits}`
  return `#${[...digits].map((digit) => digit + digit).join('')}`
}

function alphaOf(raw: string | undefined): number {
  if (raw === undefined) return 1
  const value = Number.parseFloat(raw)
  return raw.endsWith('%') ? value / 100 : value
}

export function normalizeColor(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const value = input.trim()
  if (value === '' || KEYWORDS.has(value.toLowerCase())) return null
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
  if (HSL.test(value)) return value.toLowerCase().replace(/\s+/g, ' ')
  if (NAMED.test(value)) return value.toLowerCase()
  return null
}
