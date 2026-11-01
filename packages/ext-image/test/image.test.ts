import { Editor, type EditorOptions } from '@viveeditor/core'
import { NodeSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SOURCE_POLICY,
  Image,
  type ImageError,
  type ImageOptions,
  imageSize,
  normalizeImageSrc,
  sniffImageType,
  type UploadContext,
} from '../src/index.js'

let editors: Editor[] = []

async function mount(
  options: Partial<ImageOptions> = {},
  editorOptions: EditorOptions = {},
): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, {
    extensions: [Image.configure(options)],
    ...editorOptions,
  })
  editors.push(editor)
  return editor
}

const viewOf = (editor: Editor): EditorView => (editor as unknown as { view: EditorView }).view

function paste(editor: Editor, html: string): void {
  viewOf(editor).pasteHTML(html, new Event('paste') as ClipboardEvent)
}

function selectNode(editor: Editor, position: number): void {
  const view = viewOf(editor)
  view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, position)))
}

function png(width: number, height: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(33)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
  const data = new DataView(bytes.buffer)
  data.setUint32(16, width)
  data.setUint32(20, height)
  return bytes
}

const pngFile = (name = 'photo.png', size = 0): File =>
  new File([png(4, 3), new Uint8Array(size)], name, { type: 'image/png' })

interface Deferred {
  resolve: (value: string) => void
  reject: (reason: unknown) => void
  context: UploadContext
}

function controlledUploader() {
  const calls: Deferred[] = []
  const upload = vi.fn(
    (_file: File, context: UploadContext) =>
      new Promise<string>((resolve, reject) => {
        calls.push({ resolve, reject, context })
      }),
  )
  return { upload, calls }
}

const settle = async (): Promise<void> => {
  for (let index = 0; index < 5; index++) await new Promise((resolve) => setTimeout(resolve, 0))
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('normalizeImageSrc', () => {
  it('accepts https and upgrades http and protocol-relative sources', () => {
    expect(normalizeImageSrc('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
    expect(normalizeImageSrc('http://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
    expect(normalizeImageSrc('//cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
  })

  it('rejects script, file, blob and svg sources even when disguised', () => {
    const rejected = [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'java\tscript:alert(1)',
      ' \u0001javascript:alert(1)',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'blob:https://example.com/uuid',
      'filesystem:https://example.com/temporary/a.png',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'https://exa​mple.com/a.png',
      '/\\evil.example/a.png',
    ]
    for (const src of rejected) expect(normalizeImageSrc(src), src).toBeNull()
  })

  it('allows data images only when base64 is enabled and within the size cap', () => {
    const data = 'data:image/png;base64,iVBORw0KGgo='
    const policy = { ...DEFAULT_SOURCE_POLICY, allowBase64: true, maxBase64Length: 40 }
    expect(normalizeImageSrc(data)).toBeNull()
    expect(normalizeImageSrc(data, policy)).toBe(data)
    expect(normalizeImageSrc(`${data}AAAAAAAAAAAAAAAAAAAA`, policy)).toBeNull()
    expect(normalizeImageSrc('data:image/png;base64,<svg onload=x>', policy)).toBeNull()
  })

  it('keeps relative sources opt-in and blocks http when asked', () => {
    const relative = { ...DEFAULT_SOURCE_POLICY, allowRelative: true }
    expect(normalizeImageSrc('/uploads/a.png')).toBeNull()
    expect(normalizeImageSrc('/uploads/my photo.png', relative)).toBe('/uploads/my%20photo.png')
    const strict = { ...DEFAULT_SOURCE_POLICY, insecure: 'block' as const }
    expect(normalizeImageSrc('http://cdn.example.com/a.png', strict)).toBeNull()
  })
})

describe('sniffImageType', () => {
  it('detects formats from magic bytes and reads the pixel size', () => {
    const gif = new TextEncoder().encode('GIF89a\u0010\u0000\u0008\u0000')
    const webp = new TextEncoder().encode('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ')
    const avif = new Uint8Array([0, 0, 0, 20, ...new TextEncoder().encode('ftypmif1\0\0\0\0avif')])
    expect(sniffImageType(png(1, 1))).toBe('image/png')
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffImageType(gif)).toBe('image/gif')
    expect(sniffImageType(webp)).toBe('image/webp')
    expect(sniffImageType(avif)).toBe('image/avif')
    expect(sniffImageType(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull()
    expect(imageSize(png(640, 480))).toEqual({ width: 640, height: 480 })
    expect(imageSize(gif)).toEqual({ width: 16, height: 8 })
  })

  it('reads the size from a JPEG frame header after other segments', () => {
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0xe0,
      0x02, 0x80, 0x03,
    ])
    expect(imageSize(jpeg)).toEqual({ width: 640, height: 480 })
  })
})

describe('image schema', () => {
  it('parses only allowed attributes, clamps sizes and adds fixed loading attributes', async () => {
    const editor = await mount(
      {},
      {
        content:
          '<img src="https://cdn.example.com/a.png" alt="Cat" width="99999" height="12px" style="position:fixed" onerror="alert(1)" srcset="x.png 2x">',
      },
    )
    expect(editor.getHTML()).toBe(
      '<img src="https://cdn.example.com/a.png" alt="Cat" width="10000" loading="lazy" decoding="async" referrerpolicy="no-referrer">',
    )
  })

  it('drops images whose source is not allowed when parsing HTML', async () => {
    const editor = await mount({}, { content: '<p>a</p><img src="javascript:alert(1)">' })
    expect(editor.getHTML()).toBe('<p>a</p>')
  })

  it('never renders an unsafe source that arrives through JSON content', async () => {
    const editor = await mount(
      {},
      {
        content: {
          type: 'doc',
          content: [{ type: 'image', attrs: { src: 'javascript:alert(1)', alt: 'x' } }],
        },
      },
    )
    expect(editor.getHTML()).not.toContain('javascript')
    expect(editor.dom.querySelector('img')?.hasAttribute('src')).toBe(false)
  })

  it('keeps a decorative empty alt apart from a missing one', async () => {
    const editor = await mount(
      {},
      {
        content: '<img src="https://a.example/1.png" alt=""><img src="https://a.example/2.png">',
      },
    )
    const badges = [...editor.dom.querySelectorAll<HTMLElement>('.vive-image-alt')]
    expect(editor.getHTML()).toContain('alt=""')
    expect(editor.query.imagesWithoutAlt()).toBe(1)
    expect(badges.map((badge) => badge.hidden)).toEqual([true, false])
  })
})

describe('image commands', () => {
  it('inserts a validated image and puts the cursor after it', async () => {
    const editor = await mount({}, { content: '<p>Text</p>' })
    expect(editor.commands.insertImage({ src: 'https://a.example/1.png', alt: 'One' })).toBe(true)
    expect(editor.getHTML()).toMatch(
      /^<p>Text<\/p><img src="https:\/\/a\.example\/1\.png" alt="One"/,
    )
    expect(editor.getJSON().content?.at(-1)?.type).toBe('paragraph')
    expect(editor.commands.insertImage({ src: 'javascript:alert(1)' })).toBe(false)
  })

  it('updates alt and keeps the aspect ratio when the width changes', async () => {
    const editor = await mount(
      {},
      {
        content: '<img src="https://a.example/1.png" width="800" height="600">',
      },
    )
    selectNode(editor, 0)
    expect(editor.query.selectedImage()?.width).toBe(800)
    editor.commands.setImageAttributes({ alt: 'Chart\u0000 of sales', width: 400 })
    expect(editor.query.selectedImage()).toMatchObject({
      alt: 'Chart  of sales',
      width: 400,
      height: 300,
    })
  })

  it('scales the selected image to a share of the content width', async () => {
    const editor = await mount({}, { content: '<img src="https://a.example/1.png">' })
    Object.defineProperty(editor.dom, 'clientWidth', { configurable: true, value: 600 })
    selectNode(editor, 0)
    expect(editor.commands.scaleImage(50)).toBe(true)
    expect(editor.query.selectedImage()?.width).toBe(300)
    expect(editor.can.scaleImage(0)).toBe(false)
  })
})

describe('image uploads', () => {
  it('is unavailable without an uploader or base64', async () => {
    const editor = await mount()
    expect(editor.can.uploadImages([])).toBe(false)
  })

  it('shows a placeholder while uploading and inserts the returned source', async () => {
    const { upload, calls } = controlledUploader()
    const editor = await mount({ upload }, { content: '<p>Hi</p>' })
    editor.commands.uploadImages([pngFile()])
    await settle()
    expect(editor.query.isUploading()).toBe(true)
    expect(editor.dom.querySelector('.vive-image-upload')).not.toBeNull()
    expect(editor.getHTML()).toBe('<p>Hi</p>')
    calls[0]?.context.onProgress(Number.NaN)
    calls[0]?.context.onProgress(4)
    calls[0]?.resolve('https://cdn.example.com/u/1.png')
    await settle()
    expect(editor.query.isUploading()).toBe(false)
    expect(editor.getHTML()).toContain(
      '<img src="https://cdn.example.com/u/1.png" width="4" height="3"',
    )
  })

  it('rejects files whose bytes are not an allowed image', async () => {
    const { upload } = controlledUploader()
    const errors: ImageError[] = []
    const editor = await mount({ upload, onError: (error) => errors.push(error) })
    const fake = new File(['<svg onload=alert(1)>'], 'cat.png', { type: 'image/png' })
    editor.commands.uploadImages([fake])
    await settle()
    expect(upload).not.toHaveBeenCalled()
    expect(errors).toEqual([{ code: 'TYPE', fileName: 'cat.png' }])
    expect(editor.query.isUploading()).toBe(false)
    expect(editor.dom.querySelector('.vive-image-upload.is-failed')?.getAttribute('role')).toBe(
      'alert',
    )
  })

  it('enforces the size and file count limits before uploading', async () => {
    const { upload } = controlledUploader()
    const errors: ImageError[] = []
    const editor = await mount({
      upload,
      maxSize: 100,
      maxFiles: 2,
      onError: (error) => errors.push(error),
    })
    editor.commands.uploadImages([pngFile('big.png', 200), pngFile('a.png'), pngFile('b.png')])
    await settle()
    expect(errors.map((error) => error.code)).toEqual(['SIZE', 'COUNT'])
    expect(upload).toHaveBeenCalledTimes(1)
  })

  it('counts uploads still running apart from the failed ones', async () => {
    const { upload, calls } = controlledUploader()
    const editor = await mount({ upload, concurrency: 2 })
    editor.commands.uploadImages([pngFile('a.png'), pngFile('b.png')])
    await settle()
    expect(editor.query.pendingUploads()).toEqual({ uploading: 2, failed: 0 })

    calls[0]?.reject(new Error('offline'))
    await settle()

    expect(editor.query.pendingUploads()).toEqual({ uploading: 1, failed: 1 })
  })

  it('refuses a returned source that breaks the allowlist', async () => {
    const errors: ImageError[] = []
    const editor = await mount({
      upload: async () => 'blob:https://example.com/uuid',
      onError: (error) => errors.push(error),
    })
    editor.commands.uploadImages([pngFile()])
    await settle()
    expect(errors).toEqual([{ code: 'SOURCE', fileName: 'photo.png' }])
    expect(editor.getHTML()).not.toContain('<img')
  })

  it('reports a failed upload without exposing the server error', async () => {
    const errors: ImageError[] = []
    const editor = await mount({
      upload: async () => {
        throw new Error('secret server response')
      },
      onError: (error) => errors.push(error),
    })
    editor.commands.uploadImages([pngFile()])
    await settle()
    expect(errors).toEqual([{ code: 'UPLOAD', fileName: 'photo.png' }])
  })

  it('aborts the upload and inserts nothing when the placeholder disappears', async () => {
    const { upload, calls } = controlledUploader()
    const editor = await mount({ upload }, { content: '<p>Hi</p>' })
    editor.commands.uploadImages([pngFile()])
    await settle()
    editor.setContent('<p>Other</p>')
    expect(calls[0]?.context.signal.aborted).toBe(true)
    calls[0]?.resolve('https://cdn.example.com/u/1.png')
    await settle()
    expect(editor.getHTML()).toBe('<p>Other</p>')
  })

  it('aborts when the editor is destroyed and skips inserts while read-only', async () => {
    const { upload, calls } = controlledUploader()
    const editor = await mount({ upload })
    editor.commands.uploadImages([pngFile(), pngFile('b.png')])
    await settle()
    editor.setEditable(false)
    calls[0]?.resolve('https://cdn.example.com/u/1.png')
    await settle()
    expect(editor.getHTML()).not.toContain('<img')
    editor.destroy()
    expect(calls[1]?.context.signal.aborted).toBe(true)
  })

  it('times out slow uploads', async () => {
    const errors: ImageError[] = []
    const editor = await mount({
      upload: () => new Promise<string>(() => undefined),
      timeout: 20,
      onError: (error) => errors.push(error),
    })
    editor.commands.uploadImages([pngFile()])
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(errors).toEqual([{ code: 'TIMEOUT', fileName: 'photo.png' }])
  })

  it('runs at most the configured number of uploads at once', async () => {
    const { upload, calls } = controlledUploader()
    const editor = await mount({ upload, concurrency: 2 })
    editor.commands.uploadImages([pngFile('1.png'), pngFile('2.png'), pngFile('3.png')])
    await settle()
    expect(upload).toHaveBeenCalledTimes(2)
    calls[0]?.resolve('https://cdn.example.com/1.png')
    await settle()
    expect(upload).toHaveBeenCalledTimes(3)
  })

  it('embeds a base64 image when no uploader is set but base64 is allowed', async () => {
    const editor = await mount({ allowBase64: true })
    expect(editor.can.uploadImages([])).toBe(true)
    editor.commands.uploadImages([pngFile()])
    await settle()
    expect(editor.getHTML()).toContain('<img src="data:image/png;base64,')
  })
})

describe('remote images on paste', () => {
  const html = '<p>Before</p><img src="https://tracker.example/pixel.png" alt="Pixel"><p>After</p>'

  it('keeps remote images by default and drops them when asked', async () => {
    const keep = await mount()
    paste(keep, html)
    expect(keep.getHTML()).toContain('tracker.example')
    const drop = await mount({ remoteImages: 'drop' })
    paste(drop, html)
    expect(drop.getHTML()).not.toContain('<img')
    expect(drop.getText()).toContain('After')
  })

  it('re-hosts remote images without loading them and keeps their place', async () => {
    const rehost = vi.fn(async (url: string) => `https://cdn.example.com/copy?of=${url.length}`)
    const editor = await mount({ remoteImages: 'rehost', rehost })
    paste(editor, html)
    expect(editor.dom.querySelector('img[src*="tracker"]')).toBeNull()
    await settle()
    expect(rehost).toHaveBeenCalledWith('https://tracker.example/pixel.png', expect.anything())
    expect(editor.getHTML()).toMatch(
      /<p>Before<\/p><img src="https:\/\/cdn\.example\.com\/copy\?of=\d+" alt="Pixel"/,
    )
  })
})
