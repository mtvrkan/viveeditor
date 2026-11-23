import { describe, expect, it, vi } from 'vitest'
import {
  cropBlocker,
  croppedSize,
  cropType,
  exportCrop,
  fitAspect,
  isReadable,
  moveRect,
  resizeRect,
  roundRect,
} from '../src/crop.js'

const bounds = { width: 800, height: 600 }
const full = { x: 0, y: 0, width: 800, height: 600 }

function mockCanvas(toBlob: (callback: BlobCallback, type?: string) => void) {
  const context = { drawImage: vi.fn(), getImageData: vi.fn() }
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toBlob: vi.fn(toBlob),
  } as unknown as HTMLCanvasElement
  return { canvas, context }
}

const securityError = (): never => {
  throw new DOMException('Tainted canvases may not be exported.', 'SecurityError')
}

describe('crop availability', () => {
  it('allows cropping through an uploader or base64 when the image is readable', () => {
    expect([cropBlocker('upload', true), cropBlocker('base64', true)]).toEqual([null, null])
  })

  it('explains that uploads are needed when images cannot be stored', () => {
    expect(cropBlocker(null, true)).toBe('imageCropOff')
  })

  it('reports a tainted cross-origin image', () => {
    expect(cropBlocker('upload', false)).toBe('imageCropBlocked')
  })

  it('treats a canvas that throws SecurityError as unreadable', () => {
    const { canvas, context } = mockCanvas(() => undefined)
    context.getImageData.mockImplementation(securityError)

    expect(isReadable({} as CanvasImageSource, canvas)).toBe(false)
  })
})

describe('crop math', () => {
  it('fits the largest centred rectangle of a preset aspect', () => {
    expect(fitAspect(16 / 9, bounds, full)).toEqual({ x: 0, y: 75, width: 800, height: 450 })
    expect(fitAspect(1, bounds, full)).toEqual({ x: 100, y: 0, width: 600, height: 600 })
    expect(fitAspect(null, bounds, full)).toBe(full)
  })

  it('moves inside the image only', () => {
    const rect = { x: 700, y: 10, width: 100, height: 100 }

    expect(moveRect(rect, 50, -40, bounds)).toEqual({ x: 700, y: 0, width: 100, height: 100 })
  })

  it('resizes a corner freely and keeps a 16 px minimum', () => {
    const rect = { x: 100, y: 100, width: 200, height: 200 }

    expect(resizeRect(rect, 'se', 50, 20, null, bounds)).toEqual({
      x: 100,
      y: 100,
      width: 250,
      height: 220,
    })
    expect(resizeRect(rect, 'nw', 500, 500, null, bounds)).toMatchObject({ width: 16, height: 16 })
  })

  it('keeps a fixed aspect and stays within the image when resizing', () => {
    const rect = { x: 600, y: 100, width: 100, height: 100 }

    const result = resizeRect(rect, 'e', 400, 0, 1, bounds)

    expect(result.width).toBe(result.height)
    expect(result.x + result.width).toBeLessThanOrEqual(800)
    expect(result.width).toBe(200)
  })

  it('rounds the region to whole pixels inside the image', () => {
    expect(roundRect({ x: 10.4, y: 0.6, width: 795.7, height: 20.2 }, bounds)).toEqual({
      x: 10,
      y: 1,
      width: 790,
      height: 20,
    })
  })

  it('keeps the display scale of the original image for the cropped size', () => {
    const region = { x: 0, y: 0, width: 400, height: 300 }

    expect(croppedSize(region, bounds, { width: 400, height: 300 })).toEqual({
      width: 200,
      height: 150,
    })
    expect(croppedSize(region, bounds, { width: null, height: null })).toEqual({
      width: 400,
      height: 300,
    })
  })

  it('exports in the original type when the canvas can write it, else PNG', () => {
    expect(cropType('data:image/jpeg;base64,AAAA')).toBe('image/jpeg')
    expect(cropType('https://cdn.example.com/a.webp?v=2')).toBe('image/webp')
    expect(cropType('https://cdn.example.com/a.gif')).toBe('image/png')
    expect(cropType('https://cdn.example.com/photo')).toBe('image/png')
  })
})

describe('crop export', () => {
  it('draws the region at natural resolution and exports the requested type', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' })
    const { canvas, context } = mockCanvas((callback) => callback(blob))
    const image = {} as CanvasImageSource

    const result = await exportCrop(
      image,
      { x: 10, y: 20, width: 300, height: 150 },
      'image/jpeg',
      canvas,
    )

    expect(result).toBe(blob)
    expect([canvas.width, canvas.height]).toEqual([300, 150])
    expect(context.drawImage).toHaveBeenCalledWith(image, 10, 20, 300, 150, 0, 0, 300, 150)
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.92)
  })

  it('returns null instead of throwing for a tainted canvas', async () => {
    const { canvas } = mockCanvas(securityError)

    const result = await exportCrop({} as CanvasImageSource, full, 'image/png', canvas)

    expect(result).toBeNull()
  })
})
