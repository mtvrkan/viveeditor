import { defineExtension, type Extension } from '@viveeditor/core'
import type { DOMOutputSpec, NodeSpec, NodeType, Schema } from 'prosemirror-model'
import {
  type Command,
  type EditorState,
  NodeSelection,
  Plugin,
  TextSelection,
} from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { fitNatural, type ImageSizeChange, nextSize, type StoredSize } from './size.js'
import {
  cleanAlign,
  cleanDimension,
  cleanImage,
  cleanImageHref,
  cleanText,
  type ImageAlign,
  type ImageAttributes,
  type ImageSourcePolicy,
} from './source.js'
import {
  createUploadPlugin,
  type ImageError,
  type ImageRehoster,
  type ImageUploader,
  insertionPos,
  placeholdersOf,
  uploadManager,
} from './upload.js'
import {
  contentWidth,
  ImageView,
  imageAttributes,
  maxImageWidth,
  naturalSize,
  scaledHeight,
} from './view.js'

export { clampSize, fitNatural, type ImageSizeChange, MIN_IMAGE_SIZE, nextSize } from './size.js'
export { type ImageSize, imageSize, sniffImageType } from './sniff.js'
export {
  cleanDimension,
  cleanImageHref,
  DEFAULT_SOURCE_POLICY,
  type ImageAlign,
  type ImageAttributes,
  type ImageSourcePolicy,
  isAllowedImageSrc,
  normalizeImageSrc,
} from './source.js'
export type {
  ImageError,
  ImageErrorCode,
  ImageRehoster,
  ImageUploader,
  UploadContext,
  UploadResult,
} from './upload.js'

export interface ImageLabels {
  uploading: string
  failed: string
  missingAlt: string
}

export interface ImageOptions {
  upload: ImageUploader | null
  rehost: ImageRehoster | null
  remoteImages: 'allow' | 'drop' | 'rehost'
  allowBase64: boolean
  maxBase64Length: number
  insecure: 'block' | 'upgrade'
  allowRelative: boolean
  mimeTypes: readonly string[]
  maxSize: number
  maxFiles: number
  concurrency: number
  timeout: number
  maxPreviewPixels: number
  requireAlt: 'off' | 'warn' | 'block'
  resizable: boolean
  labels: ImageLabels
  onError: ((error: ImageError) => void) | null
}

export interface SelectedImage {
  src: string | null
  alt: string | null
  title: string | null
  width: number | null
  height: number | null
  caption: string | null
  align: ImageAlign | null
  href: string | null
}

export interface PendingUploads {
  uploading: number
  failed: number
}

export type ImageChanges = Partial<Omit<ImageAttributes, 'src'>>

export type ImageReplaceMode = 'upload' | 'base64'

declare module '@viveeditor/core' {
  interface CommandRegistry {
    insertImage: (attributes: ImageAttributes) => Command
    setImageAttributes: (changes: ImageChanges) => Command
    scaleImage: (percent: number) => Command
    resizeImage: (size: ImageSizeChange, keepRatio?: boolean) => Command
    resetImageSize: () => Command
    replaceImage: (file: File, size?: ImageSizeChange) => Command
    uploadImages: (files: readonly File[]) => Command
    setImageLink: (href: string | null) => Command
  }
  interface QueryRegistry {
    selectedImage: () => SelectedImage | null
    isUploading: () => boolean
    pendingUploads: () => PendingUploads
    imagesWithoutAlt: () => number
    imageReplaceMode: () => ImageReplaceMode | null
  }
}

const policyOf = (options: ImageOptions): ImageSourcePolicy => ({
  allowBase64: options.allowBase64,
  maxBase64Length: options.maxBase64Length,
  insecure: options.insecure,
  allowRelative: options.allowRelative,
})

function imageSpec(policy: ImageSourcePolicy): NodeSpec {
  return {
    group: 'block',
    atom: true,
    draggable: true,
    attrs: {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      width: { default: null },
      height: { default: null },
      caption: { default: null },
      align: { default: null },
      href: { default: null },
    },
    parseDOM: [
      {
        tag: 'figure',
        getAttrs: (dom) => {
          const image = dom.querySelector('img[src]')
          return image
            ? parseImage(image, policy, {
                caption: dom.querySelector('figcaption')?.textContent ?? null,
                align: dom.getAttribute('data-align'),
                href: anchorHref(image),
              })
            : false
        },
      },
      {
        tag: 'a[href]',
        priority: 60,
        getAttrs: (dom) => {
          const image = dom.firstElementChild
          const alone =
            dom.childElementCount === 1 &&
            image?.matches('img[src]') === true &&
            (dom.textContent ?? '').trim() === ''
          return alone ? parseImage(image, policy, { href: dom.getAttribute('href') }) : false
        },
      },
      { tag: 'img[src]', getAttrs: (dom) => parseImage(dom, policy, {}) },
    ],
    toDOM: (node) => {
      const { caption, align, href } = cleanImage(node.attrs, policy)
      const img: DOMOutputSpec = ['img', imageAttributes(node.attrs, policy)]
      const image: DOMOutputSpec = href ? ['a', { rel: LINK_REL, href }, img] : img
      if (!caption && !align) return image
      const figure: DOMOutputSpec[] = caption ? [image, ['figcaption', caption]] : [image]
      return ['figure', align ? { 'data-align': align } : {}, ...figure]
    },
  }
}

const LINK_REL = 'noopener noreferrer nofollow'

function anchorHref(image: Element): string | null {
  const parent = image.parentElement
  return parent?.tagName === 'A' ? parent.getAttribute('href') : null
}

function parseImage(
  dom: Element,
  policy: ImageSourcePolicy,
  extra: Record<string, unknown>,
): Record<string, unknown> | false {
  const names = ['src', 'alt', 'title', 'width', 'height']
  const image = cleanImage(
    { ...Object.fromEntries(names.map((name) => [name, dom.getAttribute(name)])), ...extra },
    policy,
  )
  return image.src ? { ...image } : false
}

function selectedImageNode(state: EditorState, type: NodeType): NodeSelection | null {
  const { selection } = state
  return selection instanceof NodeSelection && selection.node.type === type ? selection : null
}

function insertImage(schema: Schema, type: NodeType, policy: ImageSourcePolicy) {
  return (attributes: ImageAttributes): Command =>
    (state, dispatch) => {
      const image = cleanImage({ ...attributes }, policy)
      if (!image.src || state.selection.$from.parent.type.spec.code) return false
      const pos = insertionPos(state, type)
      const $pos = state.doc.resolve(pos)
      if (!$pos.parent.canReplaceWith($pos.index(), $pos.index(), type)) return false
      if (dispatch) {
        const node = type.create(image)
        const transaction = state.tr.insert(pos, node)
        const after = pos + node.nodeSize
        const paragraph = schema.nodes.paragraph
        const $after = transaction.doc.resolve(after)
        if (paragraph && $after.index() === $after.parent.childCount) {
          transaction.insert(after, paragraph.create())
        }
        transaction.setSelection(TextSelection.near(transaction.doc.resolve(after)))
        dispatch(transaction.scrollIntoView())
      }
      return true
    }
}

function setImageAttributes(type: NodeType): (changes: ImageChanges) => Command {
  return (changes) => (state, dispatch) => {
    const selection = selectedImageNode(state, type)
    if (!selection) return false
    if (dispatch) {
      const current = selection.node.attrs as SelectedImage
      const next: Record<string, unknown> = { ...current }
      if ('alt' in changes) next.alt = cleanText(changes.alt)
      if ('title' in changes) next.title = cleanText(changes.title) || null
      if ('caption' in changes) next.caption = cleanText(changes.caption) || null
      if ('align' in changes) next.align = cleanAlign(changes.align)
      if ('height' in changes) next.height = cleanDimension(changes.height)
      if ('href' in changes) next.href = cleanImageHref(changes.href)
      if ('width' in changes) {
        next.width = cleanDimension(changes.width)
        if (!('height' in changes) && typeof next.width === 'number') {
          next.height = scaledHeight(next.width, current)
        }
      }
      const transaction = state.tr.setNodeMarkup(selection.from, undefined, next)
      transaction.setSelection(NodeSelection.create(transaction.doc, selection.from))
      dispatch(transaction)
    }
    return true
  }
}

function setImageLink(type: NodeType): (href: string | null) => Command {
  return (href) => (state, dispatch, view) => {
    const clean = href === null ? null : cleanImageHref(href)
    if (href !== null && clean === null) return false
    return setImageAttributes(type)({ href: clean })(state, dispatch, view)
  }
}

function scaleImage(type: NodeType): (percent: number) => Command {
  return (percent) => (state, dispatch, view) => {
    const selection = selectedImageNode(state, type)
    if (!selection || !Number.isFinite(percent) || percent <= 0) return false
    if (!dispatch || !view) return true
    const available = contentWidth(view)
    if (available === 0) return false
    const width = Math.max(1, Math.round((available * Math.min(percent, 100)) / 100))
    const attrs = selection.node.attrs as SelectedImage
    const image = view.nodeDOM(selection.from)
    const natural = image instanceof HTMLElement ? image.querySelector('img') : null
    const height =
      scaledHeight(width, attrs) ??
      (natural?.naturalWidth
        ? scaledHeight(width, { width: natural.naturalWidth, height: natural.naturalHeight })
        : null)
    return setImageAttributes(type)({ width, height })(state, dispatch, view)
  }
}

function measured(view: EditorView | undefined, pos: number) {
  const dom = view?.nodeDOM(pos)
  const element = dom instanceof HTMLElement ? dom : null
  return {
    natural: naturalSize(element?.querySelector('img')),
    max: view ? maxImageWidth(view, element) : 0,
  }
}

function sizeCommand(
  type: NodeType,
  size: (attrs: SelectedImage, view: EditorView | undefined, pos: number) => StoredSize | null,
): Command {
  return (state, dispatch, view) => {
    const selection = selectedImageNode(state, type)
    if (!selection) return false
    const next = size(selection.node.attrs as SelectedImage, view, selection.from)
    if (!next) return false
    if (dispatch) {
      const transaction = state.tr.setNodeMarkup(selection.from, undefined, {
        ...selection.node.attrs,
        width: next.width,
        height: next.height,
      })
      dispatch(transaction.setSelection(NodeSelection.create(transaction.doc, selection.from)))
    }
    return true
  }
}

function resizeImage(type: NodeType) {
  return (change: ImageSizeChange, keepRatio = true): Command =>
    sizeCommand(type, (attrs, view, pos) => {
      const { natural, max } = measured(view, pos)
      return nextSize(attrs, change, keepRatio, natural, max)
    })
}

function resetImageSize(type: NodeType) {
  return (): Command =>
    sizeCommand(type, (_attrs, view, pos) => {
      const { natural, max } = measured(view, pos)
      return natural ? fitNatural(natural, max) : { width: null, height: null }
    })
}

function replaceImage(type: NodeType) {
  return (file: File, size: ImageSizeChange = {}): Command =>
    (state, dispatch, view) => {
      const selection = selectedImageNode(state, type)
      const manager = uploadManager(view)
      if (!selection || !manager?.canUpload || !view?.editable) return false
      if (dispatch) {
        const { width, height } = size
        manager.replace(file, selection.from, String(selection.node.attrs.src), {
          ...(width ? { width } : {}),
          ...(height ? { height } : {}),
        })
      }
      return true
    }
}

export const Image: Extension<ImageOptions> = defineExtension({
  name: 'image',
  defaultOptions: {
    upload: null,
    rehost: null,
    remoteImages: 'allow',
    allowBase64: false,
    maxBase64Length: 1_500_000,
    insecure: 'upgrade',
    allowRelative: false,
    mimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'],
    maxSize: 10 * 1024 * 1024,
    maxFiles: 10,
    concurrency: 3,
    timeout: 60_000,
    maxPreviewPixels: 25_000_000,
    requireAlt: 'warn',
    resizable: true,
    labels: {
      uploading: 'Uploading',
      failed: 'Image could not be added',
      missingAlt: 'No alt text',
    },
    onError: null,
  },
  nodes: (options) => ({ image: imageSpec(policyOf(options)) }),
  commands: ({ schema, options }) => {
    const type = schema.nodes.image as NodeType
    return {
      insertImage: insertImage(schema, type, policyOf(options)),
      setImageAttributes: setImageAttributes(type),
      scaleImage: scaleImage(type),
      setImageLink: setImageLink(type),
      resizeImage: resizeImage(type),
      resetImageSize: resetImageSize(type),
      replaceImage: replaceImage(type),
      uploadImages:
        (files: readonly File[]): Command =>
        (state, dispatch, view) => {
          const manager = uploadManager(view)
          if (!manager?.canUpload || !view?.editable) return false
          if (dispatch && files.length > 0) manager.start(files, insertionPos(state, type))
          return true
        },
    }
  },
  queries: ({ schema, options }) => ({
    selectedImage: (state) => {
      const selection = selectedImageNode(state, schema.nodes.image as NodeType)
      return selection ? ({ ...selection.node.attrs } as SelectedImage) : null
    },
    isUploading: (state) => placeholdersOf(state).some((item) => !item.spec.failed),
    pendingUploads: (state) => {
      const placeholders = placeholdersOf(state)
      const failed = placeholders.filter((item) => item.spec.failed).length
      return { uploading: placeholders.length - failed, failed }
    },
    imagesWithoutAlt: (state) => {
      let count = 0
      state.doc.descendants((node) => {
        if (node.type.name === 'image' && node.attrs.alt === null) count++
      })
      return count
    },
    imageReplaceMode: () => (options.upload ? 'upload' : options.allowBase64 ? 'base64' : null),
  }),
  plugins: ({ schema, options }) => {
    const type = schema.nodes.image as NodeType
    const policy = policyOf(options)
    const uploads = createUploadPlugin({
      type,
      policy,
      upload: options.upload,
      rehost: options.rehost,
      remoteImages: options.remoteImages,
      mimeTypes: options.mimeTypes,
      maxSize: options.maxSize,
      maxFiles: options.maxFiles,
      concurrency: Math.max(1, options.concurrency),
      timeout: options.timeout,
      maxPreviewPixels: options.maxPreviewPixels,
      labels: options.labels,
      onError: options.onError,
    })
    const viewSettings = {
      policy,
      requireAlt: options.requireAlt,
      missingAltLabel: options.labels.missingAlt,
      resizable: options.resizable,
    }
    const views = new Plugin({
      props: {
        nodeViews: {
          image: (node, view, getPos) => new ImageView(node, view, getPos, viewSettings),
        },
      },
    })
    return [uploads, views]
  },
})
