const isUnsafe = (code: number): boolean =>
  code <= 0x08 ||
  code === 0x0b ||
  code === 0x0c ||
  (code >= 0x0e && code <= 0x1f) ||
  (code >= 0x7f && code <= 0x9f) ||
  (code >= 0x202a && code <= 0x202e) ||
  (code >= 0x2066 && code <= 0x2069)

const isLoneSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdfff

function cleanCharacters(value: string): string[] {
  const result: string[] = []
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0
    if (isLoneSurrogate(code)) result.push('�')
    else if (!isUnsafe(code)) result.push(character)
  }
  return result
}

export function cleanDisplayText(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  const flat = cleanCharacters(value.slice(0, max * 4))
    .join('')
    .replace(/[\t\n\r]+/g, ' ')
  return Array.from(flat).slice(0, max).join('')
}

export function cleanGeneratedText(value: string): string {
  return cleanCharacters(value).join('').replace(/\r\n?/g, '\n')
}
