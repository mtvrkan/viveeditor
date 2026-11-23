import type { ImageSize } from './sniff.js'

export interface ImageSizeChange {
  width?: number | null
  height?: number | null
}

export interface StoredSize {
  width: number | null
  height: number | null
}

export const MIN_IMAGE_SIZE = 16
const MAX_IMAGE_SIZE = 10_000

const limitOf = (max: number): number => (max > 0 ? Math.min(max, MAX_IMAGE_SIZE) : MAX_IMAGE_SIZE)

const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null

export function ratioOf(size: StoredSize | ImageSize | null | undefined): number | null {
  return size?.width && size.height ? size.width / size.height : null
}

export function clampWidth(width: number, max: number): number {
  return Math.round(Math.min(limitOf(max), Math.max(MIN_IMAGE_SIZE, width)))
}

export function clampSize(width: number, ratio: number, max: number): ImageSize {
  const limit = limitOf(max)
  let next = Math.min(limit, Math.max(MIN_IMAGE_SIZE, width))
  if (next / ratio < MIN_IMAGE_SIZE) next = Math.min(limit, MIN_IMAGE_SIZE * ratio)
  const clamped = Math.round(next)
  return {
    width: clamped,
    height: Math.min(MAX_IMAGE_SIZE, Math.max(1, Math.round(clamped / ratio))),
  }
}

export function fitNatural(natural: ImageSize, max: number): ImageSize {
  const limit = limitOf(max)
  if (natural.width <= limit) return { width: natural.width, height: natural.height }
  return { width: limit, height: Math.max(1, Math.round((limit * natural.height) / natural.width)) }
}

export function nextSize(
  current: StoredSize,
  change: ImageSizeChange,
  keepRatio: boolean,
  natural: ImageSize | null,
  max: number,
): StoredSize | null {
  const width = finite(change.width)
  const height = finite(change.height)
  if (width === null && height === null) return null
  const ratio = ratioOf(current) ?? ratioOf(natural)
  if (keepRatio && ratio) return clampSize(width ?? (height ?? 0) * ratio, ratio, max)
  const base = current.width && current.height ? current : natural
  return {
    width: width === null ? (base?.width ?? null) : clampWidth(width, max),
    height:
      height === null
        ? (base?.height ?? null)
        : Math.round(Math.min(MAX_IMAGE_SIZE, Math.max(MIN_IMAGE_SIZE, height))),
  }
}
