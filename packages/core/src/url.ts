export const DEFAULT_ALLOWED_PROTOCOLS: readonly string[] = ['http', 'https', 'mailto', 'tel']

const SCHEME = /^([a-z][a-z0-9+.-]*):/i

function isInvisible(code: number): boolean {
  return (
    code <= 0x20 ||
    (code >= 0x7f && code <= 0x9f) ||
    code === 0xad ||
    (code >= 0x200b && code <= 0x200f) ||
    code === 0x2028 ||
    code === 0x2029 ||
    code === 0xfeff
  )
}

export function isAllowedUrl(
  url: string,
  protocols: readonly string[] = DEFAULT_ALLOWED_PROTOCOLS,
): boolean {
  const normalized = Array.from(url)
    .filter((character) => !isInvisible(character.codePointAt(0) ?? 0))
    .join('')
  if (normalized === '') return false
  const scheme = SCHEME.exec(normalized)?.[1]
  if (!scheme) return true
  return protocols.includes(scheme.toLowerCase())
}
