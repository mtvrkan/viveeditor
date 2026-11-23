import { clamp } from './dom.js'
import type { MessageKey } from './messages.js'

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface CropBounds {
  width: number
  height: number
}

export type CropHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

export const CROP_HANDLES: readonly CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export const MIN_CROP = 16

const EXPORT_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const EXTENSIONS: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export function cropBlocker(mode: unknown, readable: boolean): MessageKey | null {
  if (mode !== 'upload' && mode !== 'base64') return 'imageCropOff'
  return readable ? null : 'imageCropBlocked'
}

export function fitAspect(aspect: number | null, bounds: CropBounds, rect: CropRect): CropRect {
  if (!aspect) return rect
  let width = bounds.width
  let height = width / aspect
  if (height > bounds.height) {
    height = bounds.height
    width = height * aspect
  }
  return { x: (bounds.width - width) / 2, y: (bounds.height - height) / 2, width, height }
}

export function moveRect(rect: CropRect, dx: number, dy: number, bounds: CropBounds): CropRect {
  return {
    ...rect,
    x: clamp(rect.x + dx, 0, bounds.width - rect.width),
    y: clamp(rect.y + dy, 0, bounds.height - rect.height),
  }
}

export function resizeRect(
  rect: CropRect,
  handle: CropHandle,
  dx: number,
  dy: number,
  aspect: number | null,
  bounds: CropBounds,
): CropRect {
  const west = handle.includes('w')
  const east = handle.includes('e')
  const north = handle.startsWith('n')
  const south = handle.startsWith('s')
  let left = rect.x
  let top = rect.y
  let right = rect.x + rect.width
  let bottom = rect.y + rect.height
  if (west) left = clamp(left + dx, 0, right - MIN_CROP)
  if (east) right = clamp(right + dx, left + MIN_CROP, bounds.width)
  if (north) top = clamp(top + dy, 0, bottom - MIN_CROP)
  if (south) bottom = clamp(bottom + dy, top + MIN_CROP, bounds.height)
  let width = right - left
  let height = bottom - top
  if (!aspect) return { x: left, y: top, width, height }
  const horizontal = west || east
  const vertical = north || south
  if (horizontal && (!vertical || width / height > aspect)) height = width / aspect
  else width = height * aspect
  const centerX = rect.x + rect.width / 2
  const centerY = rect.y + rect.height / 2
  const roomX = west
    ? right
    : east
      ? bounds.width - left
      : 2 * Math.min(centerX, bounds.width - centerX)
  const roomY = north
    ? bottom
    : south
      ? bounds.height - top
      : 2 * Math.min(centerY, bounds.height - centerY)
  const scale = Math.min(1, roomX / width, roomY / height)
  width *= scale
  height *= scale
  return {
    x: west ? right - width : east ? left : centerX - width / 2,
    y: north ? bottom - height : south ? top : centerY - height / 2,
    width,
    height,
  }
}

export function roundRect(rect: CropRect, bounds: CropBounds): CropRect {
  const x = clamp(Math.round(rect.x), 0, bounds.width - 1)
  const y = clamp(Math.round(rect.y), 0, bounds.height - 1)
  return {
    x,
    y,
    width: clamp(Math.round(rect.width), 1, bounds.width - x),
    height: clamp(Math.round(rect.height), 1, bounds.height - y),
  }
}

export function croppedSize(
  region: CropRect,
  natural: CropBounds,
  stored: { width?: unknown; height?: unknown },
): CropBounds {
  const width = typeof stored.width === 'number' ? stored.width : null
  const height = typeof stored.height === 'number' ? stored.height : null
  const scaleX = width ? width / natural.width : 1
  const scaleY = width && height ? height / natural.height : scaleX
  return {
    width: Math.max(1, Math.round(region.width * scaleX)),
    height: Math.max(1, Math.round(region.height * scaleY)),
  }
}

export function cropType(src: string): string {
  const data = /^data:(image\/[a-z+.-]+)[;,]/i.exec(src)?.[1]?.toLowerCase()
  const extension = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(src)?.[1]?.toLowerCase()
  const type = data ?? (extension ? EXTENSIONS[extension] : undefined)
  return type && EXPORT_TYPES.includes(type) ? type : 'image/png'
}

export function isReadable(
  image: CanvasImageSource,
  canvas: HTMLCanvasElement = document.createElement('canvas'),
): boolean {
  try {
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d')
    if (!context) return false
    context.drawImage(image, 0, 0, 1, 1)
    context.getImageData(0, 0, 1, 1)
    return true
  } catch {
    return false
  }
}

export function loadCropImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image()
    if (!/^(?:data|blob):/i.test(src)) image.crossOrigin = 'anonymous'
    image.onload = () => resolve(isReadable(image) ? image : null)
    image.onerror = () => resolve(null)
    image.src = src
  })
}

export function exportCrop(
  image: CanvasImageSource,
  region: CropRect,
  type: string,
  canvas: HTMLCanvasElement = document.createElement('canvas'),
): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.width = region.width
      canvas.height = region.height
      const context = canvas.getContext('2d')
      if (!context) {
        resolve(null)
        return
      }
      context.drawImage(
        image,
        region.x,
        region.y,
        region.width,
        region.height,
        0,
        0,
        region.width,
        region.height,
      )
      canvas.toBlob(resolve, type, 0.92)
    } catch {
      resolve(null)
    }
  })
}
