import { defineExtension, type Extension } from '@viveeditor/core'
import type { NodeSpec, NodeType, Schema } from 'prosemirror-model'
import {
  type Command,
  type EditorState,
  NodeSelection,
  Plugin,
  TextSelection,
} from 'prosemirror-state'
import {
  cleanDimension,
  cleanImage,
  cleanText,
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
import { contentWidth, ImageView, imageAttributes, scaledHeight } from './view.js'

export { type ImageSize, imageSize, sniffImageType } from './sniff.js'
export {
  cleanDimension,
  DEFAULT_SOURCE_POLICY,
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
  labels: ImageLabels
  onError: ((error: ImageError) => void) | null
}

export interface SelectedImage {
  src: string | null
  alt: string | null
  title: string | null
  width: number | null
  height: number | null
}

export interface PendingUploads {
  uploading: number
  failed: number
}

export type ImageChanges = Partial<Omit<ImageAttributes, 'src'>>

declare module '@viveeditor/core' {
  interface CommandRegistry {
    insertImage: (attributes: ImageAttributes) => Command
    setImageAttributes: (changes: ImageChanges) => Command
    scaleImage: (percent: number) => Command
    uploadImages: (files: readonly File[]) => Command
  }
  interface QueryRegistry {
    selectedImage: () => SelectedImage | null
    isUploading: () => boolean
    pendingUploads: () => PendingUploads
    imagesWithoutAlt: () => number
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
    },
    parseDOM: [
      {
        tag: 'img[src]',
        getAttrs: (dom) => {
          const names = ['src', 'alt', 'title', 'width', 'height']
          const image = cleanImage(
            Object.fromEntries(names.map((name) => [name, dom.getAttribute(name)])),
            policy,
          )
          return image.src ? { ...image } : false
        },
      },
    ],
    toDOM: (node) => ['img', imageAttributes(node.attrs, policy)],
  }
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
      if ('height' in changes) next.height = cleanDimension(changes.height)
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
  queries: ({ schema }) => ({
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
