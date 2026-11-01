import { Fragment, type NodeType, type Node as ProseMirrorNode, Slice } from 'prosemirror-model'
import {
  type EditorState,
  NodeSelection,
  Plugin,
  PluginKey,
  type Transaction,
} from 'prosemirror-state'
import { insertPoint } from 'prosemirror-transform'
import { Decoration, DecorationSet, type EditorView } from 'prosemirror-view'
import { imageSize, sniffImageType } from './sniff.js'
import { cleanImage, type ImageSourcePolicy, isRemoteSrc } from './source.js'

export type ImageErrorCode = 'TYPE' | 'SIZE' | 'COUNT' | 'TIMEOUT' | 'UPLOAD' | 'SOURCE'

export interface ImageError {
  code: ImageErrorCode
  fileName: string
}

export interface UploadContext {
  signal: AbortSignal
  onProgress: (value: number) => void
}

export type UploadResult = string | { src: string; width?: number; height?: number }

export type ImageUploader = (file: File, context: UploadContext) => Promise<UploadResult>

export type ImageRehoster = (url: string, context: UploadContext) => Promise<UploadResult>

export interface UploadLabels {
  uploading: string
  failed: string
}

export interface UploadSettings {
  type: NodeType
  policy: ImageSourcePolicy
  upload: ImageUploader | null
  rehost: ImageRehoster | null
  remoteImages: 'allow' | 'drop' | 'rehost'
  mimeTypes: readonly string[]
  maxSize: number
  maxFiles: number
  concurrency: number
  timeout: number
  maxPreviewPixels: number
  labels: UploadLabels
  onError: ((error: ImageError) => void) | null
}

interface Placeholder {
  id: string
  pos: number
  side: number
  failed: boolean
}

interface PlaceholderMeta {
  add?: readonly Placeholder[]
  fail?: string
  remove?: string
}

interface Job {
  id: string
  source: File | string
  name: string
  attrs: Record<string, unknown>
  controller: AbortController
  element: HTMLElement
  bar: HTMLElement | null
}

const HEAD_BYTES = 65_536
const FAILURE_VISIBLE_MS = 6000

export const uploadKey: PluginKey<DecorationSet> = new PluginKey('imageUpload')

const managers = new WeakMap<EditorView, UploadManager>()

export const uploadManager = (view: EditorView | undefined): UploadManager | undefined =>
  view && managers.get(view)

export function insertionPos(state: EditorState, type: NodeType): number {
  const { selection } = state
  const { $from } = selection
  let base = $from.pos
  if (selection instanceof NodeSelection) base = selection.to
  else if ($from.depth > 0 && $from.parent.isTextblock) {
    base = $from.parent.content.size === 0 ? $from.before() : $from.after()
  }
  return insertPoint(state.doc, base, type) ?? base
}

export const placeholdersOf = (state: EditorState): Decoration[] =>
  uploadKey.getState(state)?.find() ?? []

function element(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function withSignal<Value>(promise: Promise<Value>, signal: AbortSignal): Promise<Value> {
  return new Promise((resolve, reject) => {
    const abort = (): void => reject(signal.reason)
    if (signal.aborted) abort()
    signal.addEventListener('abort', abort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function mapImages(
  fragment: Fragment,
  type: NodeType,
  replace: (node: ProseMirrorNode) => ProseMirrorNode | null,
): Fragment {
  const children: ProseMirrorNode[] = []
  fragment.forEach((child) => {
    if (child.type === type) {
      const next = replace(child)
      if (next) children.push(next)
      return
    }
    if (child.isLeaf) {
      children.push(child)
      return
    }
    const content = mapImages(child.content, type, replace)
    children.push(
      child.type.createAndFill(child.attrs, content, child.marks) ?? child.copy(content),
    )
  })
  return Fragment.from(children)
}

export class UploadManager {
  private view: EditorView | null = null
  private readonly jobs = new Map<string, Job>()
  private readonly elements = new Map<string, HTMLElement>()
  private readonly timers = new Set<ReturnType<typeof setTimeout>>()
  private readonly remote = new Map<ProseMirrorNode, string>()
  private queue: Job[] = []
  private active = 0
  private sequence = 0

  constructor(private readonly settings: UploadSettings) {}

  get canUpload(): boolean {
    return this.settings.upload !== null || this.settings.policy.allowBase64
  }

  attach(view: EditorView): void {
    this.view = view
    managers.set(view, this)
  }

  widget(placeholder: Placeholder): Decoration {
    return Decoration.widget(
      placeholder.pos,
      () => this.elements.get(placeholder.id) ?? element('div', 'vive-image-upload'),
      {
        id: placeholder.id,
        side: placeholder.side,
        failed: placeholder.failed,
        key: `${placeholder.id}${placeholder.failed ? ':failed' : ''}`,
        ignoreSelection: true,
      },
    )
  }

  start(sources: readonly File[], pos: number): boolean {
    const view = this.view
    if (!view?.editable || sources.length === 0) return false
    const room = Math.max(0, this.settings.maxFiles - this.jobs.size)
    const placeholders: Placeholder[] = []
    const queued: Job[] = []
    const add = (id: string, failed: boolean): void => {
      placeholders.push({ id, pos, side: placeholders.length - 1000, failed })
    }
    for (const source of sources.slice(0, room)) {
      const job = this.createJob(source, {})
      const code = this.precheck(source)
      if (code) {
        this.markFailed(job, code)
        add(job.id, true)
        continue
      }
      this.jobs.set(job.id, job)
      queued.push(job)
      add(job.id, false)
    }
    const extra = sources[room]
    if (extra !== undefined) {
      const job = this.createJob(extra, {})
      this.markFailed(job, 'COUNT')
      add(job.id, true)
    }
    view.dispatch(view.state.tr.setMeta(uploadKey, { add: placeholders } satisfies PlaceholderMeta))
    this.queue.push(...queued)
    this.pump()
    return true
  }

  transformPasted(slice: Slice): Slice {
    const { remoteImages, type } = this.settings
    if (remoteImages === 'allow') return slice
    const rehost = remoteImages === 'rehost' && this.settings.rehost !== null
    const content = mapImages(slice.content, type, (node) => {
      const src: unknown = node.attrs.src
      if (typeof src !== 'string' || !isRemoteSrc(src)) return node
      if (!rehost) return null
      const marker = type.create({ ...node.attrs, src: null })
      this.remote.set(marker, src)
      return marker
    })
    return new Slice(content, slice.openStart, slice.openEnd)
  }

  collectRemote(state: EditorState): Transaction | null {
    if (this.remote.size === 0) return null
    const found: Array<{ pos: number; node: ProseMirrorNode; url: string }> = []
    state.doc.descendants((node, pos) => {
      const url = this.remote.get(node)
      if (url !== undefined) found.push({ pos, node, url })
    })
    this.remote.clear()
    if (found.length === 0) return null
    const transaction = state.tr
    for (const { pos, node } of [...found].reverse()) transaction.delete(pos, pos + node.nodeSize)
    const view = this.view
    if (!view) return transaction
    const placeholders: Placeholder[] = []
    for (const { pos, node, url } of found) {
      const job = this.createJob(url, { ...node.attrs, src: null })
      this.jobs.set(job.id, job)
      this.queue.push(job)
      placeholders.push({
        id: job.id,
        pos: transaction.mapping.map(pos, -1),
        side: -1,
        failed: false,
      })
    }
    queueMicrotask(() => this.pump())
    return transaction.setMeta(uploadKey, { add: placeholders } satisfies PlaceholderMeta)
  }

  apply(meta: PlaceholderMeta | undefined, set: DecorationSet, state: EditorState): DecorationSet {
    if (!meta) return set
    let next = set
    const drop = (id: string): Decoration[] => {
      const found = next.find(undefined, undefined, (spec) => spec.id === id)
      next = next.remove(found)
      return found
    }
    if (meta.add)
      next = next.add(
        state.doc,
        meta.add.map((placeholder) => this.widget(placeholder)),
      )
    if (meta.remove) drop(meta.remove)
    if (meta.fail) {
      const [old] = drop(meta.fail)
      if (old) {
        const placeholder = {
          id: meta.fail,
          pos: old.from,
          side: Number(old.spec.side),
          failed: true,
        }
        next = next.add(state.doc, [this.widget(placeholder)])
      }
    }
    return next
  }

  sync(): void {
    const view = this.view
    if (!view || (this.jobs.size === 0 && this.elements.size === 0)) return
    const present = new Set(placeholdersOf(view.state).map((decoration) => decoration.spec.id))
    for (const [id, job] of this.jobs) {
      if (present.has(id)) continue
      job.controller.abort()
      this.jobs.delete(id)
    }
    for (const id of this.elements.keys()) {
      if (!present.has(id) && !this.jobs.has(id)) this.elements.delete(id)
    }
  }

  destroy(): void {
    for (const job of this.jobs.values()) job.controller.abort()
    for (const timer of this.timers) clearTimeout(timer)
    this.jobs.clear()
    this.queue = []
    this.elements.clear()
    this.timers.clear()
    this.view = null
  }

  private createJob(source: File | string, attrs: Record<string, unknown>): Job {
    const id = `upload-${++this.sequence}`
    const name = typeof source === 'string' ? source.slice(0, 200) : source.name
    const node = element('div', 'vive-image-upload')
    node.contentEditable = 'false'
    node.setAttribute('role', 'status')
    node.append(
      element('span', 'vive-image-upload-label', `${this.settings.labels.uploading}: ${name}`),
    )
    const track = element('span', 'vive-image-progress')
    const bar = element('span', 'vive-image-progress-bar')
    track.setAttribute('aria-hidden', 'true')
    track.append(bar)
    node.append(track)
    this.elements.set(id, node)
    return { id, source, name, attrs, controller: new AbortController(), element: node, bar }
  }

  private precheck(source: File): ImageErrorCode | null {
    if (!this.settings.mimeTypes.includes(source.type)) return 'TYPE'
    return source.size > this.settings.maxSize ? 'SIZE' : null
  }

  private markFailed(job: Job, code: ImageErrorCode): void {
    job.element.className = 'vive-image-upload is-failed'
    job.element.setAttribute('role', 'alert')
    job.element.replaceChildren(
      element('span', 'vive-image-upload-label', `${this.settings.labels.failed}: ${job.name}`),
    )
    job.bar = null
    try {
      this.settings.onError?.({ code, fileName: job.name })
    } catch (error) {
      queueMicrotask(() => {
        throw error
      })
    }
    const timer = setTimeout(() => {
      this.timers.delete(timer)
      this.dispatchMeta({ remove: job.id })
    }, FAILURE_VISIBLE_MS)
    this.timers.add(timer)
  }

  private fail(job: Job, code: ImageErrorCode): void {
    if (!this.view || !placeholdersOf(this.view.state).some((item) => item.spec.id === job.id))
      return
    this.markFailed(job, code)
    this.dispatchMeta({ fail: job.id })
  }

  private dispatchMeta(meta: PlaceholderMeta): void {
    const view = this.view
    if (view) view.dispatch(view.state.tr.setMeta(uploadKey, meta))
  }

  private pump(): void {
    while (this.active < this.settings.concurrency) {
      const job = this.queue.shift()
      if (!job) return
      if (job.controller.signal.aborted) continue
      this.active++
      void this.run(job).finally(() => {
        this.active--
        this.jobs.delete(job.id)
        this.pump()
      })
    }
  }

  private progress(job: Job, value: number): void {
    if (!Number.isFinite(value) || !job.bar) return
    job.bar.style.transform = `scaleX(${Math.min(1, Math.max(0, value))})`
  }

  private preview(job: Job, head: Uint8Array): string | null {
    const size = imageSize(head)
    if (!size || size.width * size.height > this.settings.maxPreviewPixels) return null
    if (typeof URL.createObjectURL !== 'function' || typeof job.source === 'string') return null
    const url = URL.createObjectURL(job.source)
    const image = document.createElement('img')
    image.className = 'vive-image-preview'
    image.alt = ''
    image.src = url
    job.element.prepend(image)
    return url
  }

  private transfer(job: Job, context: UploadContext): Promise<UploadResult> {
    const { upload, rehost } = this.settings
    if (typeof job.source === 'string') {
      return rehost ? rehost(job.source, context) : Promise.reject(new Error('No rehost'))
    }
    return upload ? upload(job.source, context) : readDataUrl(job.source)
  }

  private async run(job: Job): Promise<void> {
    const { signal } = job.controller
    let timedOut = false
    let preview: string | null = null
    const timer = setTimeout(() => {
      timedOut = true
      job.controller.abort()
    }, this.settings.timeout)
    try {
      if (typeof job.source !== 'string') {
        const head = new Uint8Array(await job.source.slice(0, HEAD_BYTES).arrayBuffer())
        if (signal.aborted) throw signal.reason
        const sniffed = sniffImageType(head)
        if (!sniffed || !this.settings.mimeTypes.includes(sniffed)) {
          this.fail(job, 'TYPE')
          return
        }
        preview = this.preview(job, head)
        const size = sniffed === 'image/jpeg' ? null : imageSize(head)
        if (size) job.attrs = { ...size, ...job.attrs }
      }
      const context = { signal, onProgress: (value: number) => this.progress(job, value) }
      const result = await withSignal(this.transfer(job, context), signal)
      const fields = typeof result === 'string' ? { src: result } : result
      const image = cleanImage({ ...job.attrs, ...fields }, this.settings.policy)
      if (!image.src) {
        this.fail(job, 'SOURCE')
        return
      }
      this.insert(job, { ...image })
    } catch {
      if (timedOut) this.fail(job, 'TIMEOUT')
      else if (!signal.aborted) this.fail(job, 'UPLOAD')
    } finally {
      clearTimeout(timer)
      if (preview) URL.revokeObjectURL(preview)
    }
  }

  private insert(job: Job, attrs: Record<string, unknown>): void {
    const view = this.view
    if (!view) return
    const placeholder = placeholdersOf(view.state).find((item) => item.spec.id === job.id)
    if (!placeholder) return
    const transaction = view.state.tr.setMeta(uploadKey, {
      remove: job.id,
    } satisfies PlaceholderMeta)
    const pos = view.editable
      ? insertPoint(view.state.doc, placeholder.from, this.settings.type)
      : null
    if (pos !== null) transaction.insert(pos, this.settings.type.create(attrs))
    view.dispatch(transaction)
  }
}

export function createUploadPlugin(settings: UploadSettings): Plugin<DecorationSet> {
  const manager = new UploadManager(settings)
  const files = (list: FileList | null | undefined): File[] =>
    Array.from(list ?? []).filter((file) => file.type.startsWith('image/'))
  return new Plugin<DecorationSet>({
    key: uploadKey,
    state: {
      init: () => DecorationSet.empty,
      apply: (transaction, set, _old, state) =>
        manager.apply(
          transaction.getMeta(uploadKey) as PlaceholderMeta | undefined,
          set.map(transaction.mapping, transaction.doc),
          state,
        ),
    },
    view: (view) => {
      manager.attach(view)
      return { update: () => manager.sync(), destroy: () => manager.destroy() }
    },
    appendTransaction: (_transactions, _old, state) => manager.collectRemote(state),
    props: {
      decorations: (state) => uploadKey.getState(state),
      transformPasted: (slice) => manager.transformPasted(slice),
      handlePaste: (view, event) => {
        const data = event.clipboardData
        const images = files(data?.files)
        if (images.length === 0 || !manager.canUpload) return false
        const text = (data?.getData('text/html') ?? '').replace(/<[^>]*>/g, '').trim()
        if (text) return false
        return manager.start(images, insertionPos(view.state, settings.type))
      },
      handleDrop: (view, event, _slice, moved) => {
        const images = files(event.dataTransfer?.files)
        if (moved || images.length === 0 || !manager.canUpload) return false
        const point = view.posAtCoords({ left: event.clientX, top: event.clientY })
        const base = point?.pos ?? insertionPos(view.state, settings.type)
        const pos = insertPoint(view.state.doc, base, settings.type) ?? base
        event.preventDefault()
        return manager.start(images, pos)
      },
    },
  })
}
