export interface ImageSize {
  width: number
  height: number
}

const startsWith = (bytes: Uint8Array, offset: number, values: readonly number[]): boolean =>
  values.every((value, index) => bytes[offset + index] === value)

const ascii = (bytes: Uint8Array, offset: number, length: number): string =>
  String.fromCharCode(...bytes.subarray(offset, offset + length))

const byte = (bytes: Uint8Array, offset: number): number => bytes[offset] ?? 0

const uint16be = (bytes: Uint8Array, offset: number): number =>
  (byte(bytes, offset) << 8) | byte(bytes, offset + 1)

const uint16le = (bytes: Uint8Array, offset: number): number =>
  byte(bytes, offset) | (byte(bytes, offset + 1) << 8)

const uint24le = (bytes: Uint8Array, offset: number): number =>
  uint16le(bytes, offset) | (byte(bytes, offset + 2) << 16)

const uint32be = (bytes: Uint8Array, offset: number): number =>
  uint16be(bytes, offset) * 0x10000 + uint16be(bytes, offset + 2)

function isAvif(bytes: Uint8Array): boolean {
  if (ascii(bytes, 4, 4) !== 'ftyp') return false
  const end = Math.min(uint32be(bytes, 0), bytes.length, 64)
  for (let offset = 8; offset + 4 <= end; offset += 4) {
    const brand = ascii(bytes, offset, 4)
    if (brand === 'avif' || brand === 'avis') return true
  }
  return false
}

export function sniffImageType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (startsWith(bytes, 0, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') return 'image/gif'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') return 'image/webp'
  return isAvif(bytes) ? 'image/avif' : null
}

function jpegSize(bytes: Uint8Array): ImageSize | null {
  let offset = 2
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null
    const marker = byte(bytes, offset + 1)
    if (marker === 0xff) {
      offset++
      continue
    }
    const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
    if (isFrame) return { height: uint16be(bytes, offset + 5), width: uint16be(bytes, offset + 7) }
    offset += 2 + uint16be(bytes, offset + 2)
  }
  return null
}

function webpSize(bytes: Uint8Array): ImageSize | null {
  const chunk = ascii(bytes, 12, 4)
  if (chunk === 'VP8 ') {
    return { width: uint16le(bytes, 26) & 0x3fff, height: uint16le(bytes, 28) & 0x3fff }
  }
  if (chunk === 'VP8L') {
    const bits = byte(bytes, 21) | (byte(bytes, 22) << 8) | (byte(bytes, 23) << 16)
    const high = byte(bytes, 24)
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) | ((high & 0xf) << 10)) + 1 }
  }
  if (chunk === 'VP8X') return { width: uint24le(bytes, 24) + 1, height: uint24le(bytes, 27) + 1 }
  return null
}

export function imageSize(bytes: Uint8Array): ImageSize | null {
  const size = (() => {
    switch (sniffImageType(bytes)) {
      case 'image/png':
        return { width: uint32be(bytes, 16), height: uint32be(bytes, 20) }
      case 'image/gif':
        return { width: uint16le(bytes, 6), height: uint16le(bytes, 8) }
      case 'image/jpeg':
        return jpegSize(bytes)
      case 'image/webp':
        return webpSize(bytes)
      default:
        return null
    }
  })()
  return size && size.width > 0 && size.height > 0 ? size : null
}
