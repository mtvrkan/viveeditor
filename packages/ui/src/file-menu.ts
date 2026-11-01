import type { Editor } from '@viveeditor/core'
import type { CommandAccess } from './commands.js'
import { h } from './dom.js'
import { icon } from './icons.js'
import type { MenuItem } from './menu.js'
import { format, type Messages } from './messages.js'
import { printableHtml, printDocument } from './print.js'

export interface DocxImportResult {
  html: string
  warnings: readonly { code: string; count: number }[]
}

export interface DocxModule {
  importDocx(
    file: Blob,
    options?: { upload?: FileImageUploader; allowBase64?: boolean; signal?: AbortSignal },
  ): Promise<DocxImportResult>
  exportDocx(editor: Editor, options?: { title?: string; signal?: AbortSignal }): Promise<Blob>
}

export interface MarkdownModule {
  markdownToHtml(source: string): string
  toMarkdown(editor: Editor): string
}

export type FileImageUploader = (
  file: File,
  context: { signal: AbortSignal; onProgress: (fraction: number) => void },
) => Promise<string | { src: string; width?: number; height?: number }>

export interface FileOptions {
  docx?: () => Promise<DocxModule>
  markdown?: () => Promise<MarkdownModule>
  html?: boolean
  print?: boolean
  fileName?: string
  upload?: FileImageUploader
  allowBase64?: boolean
}

export interface FileMenu {
  readonly items: readonly MenuItem[]
  readonly notice: HTMLElement
  hideNotice(): void
  destroy(): void
}

type ImportKind = 'docx' | 'markdown' | 'html' | 'text'

const MAX_TEXT_BYTES = 5 * 1024 * 1024
const MAX_DOCX_BYTES = 20 * 1024 * 1024
const NOTICE_TIME = 8000
const REVOKE_DELAY = 30_000
const RESERVED_NAME = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i
const ERROR_MESSAGES: Record<string, keyof Messages> = {
  TOO_LARGE: 'fileTooLarge',
  TOO_COMPLEX: 'fileTooLarge',
  ENCRYPTED: 'fileEncrypted',
  NOT_DOCX: 'fileUnsupported',
  UNSUPPORTED: 'fileUnsupported',
}

const unsafeNameCharacter = (code: number): boolean =>
  code < 0x20 ||
  (code >= 0x7f && code <= 0x9f) ||
  code === 0xad ||
  (code >= 0x200b && code <= 0x200f) ||
  (code >= 0x202a && code <= 0x202e) ||
  (code >= 0x2060 && code <= 0x206f) ||
  code === 0xfeff

export function safeFileName(name: string, extension: string, fallback: string): string {
  let clean = ''
  for (const character of name) {
    const code = character.codePointAt(0) ?? 0
    if (unsafeNameCharacter(code)) continue
    clean += '<>:"/\\|?*'.includes(character) ? '-' : character
  }
  clean = clean.replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '')
  if (clean.toLowerCase().endsWith(`.${extension}`)) clean = clean.slice(0, -extension.length - 1)
  clean = Array.from(clean).slice(0, 100).join('').trim()
  if (!clean || RESERVED_NAME.test(clean)) clean = fallback
  return `${clean}.${extension}`
}

function importKind(name: string): ImportKind | null {
  const extension = name.toLowerCase().split('.').pop() ?? ''
  if (extension === 'docx') return 'docx'
  if (extension === 'md' || extension === 'markdown') return 'markdown'
  if (extension === 'html' || extension === 'htm') return 'html'
  if (extension === 'txt') return 'text'
  return null
}

function textToHtml(text: string): string {
  const doc = document.implementation.createHTMLDocument('')
  for (const block of text.replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
    const paragraph = doc.createElement('p')
    block.split('\n').forEach((line, index) => {
      if (index > 0) paragraph.append(doc.createElement('br'))
      paragraph.append(line)
    })
    doc.body.append(paragraph)
  }
  return doc.body.innerHTML
}

function errorCode(error: unknown): string {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : error instanceof RangeError
      ? 'TOO_LARGE'
      : ''
}

export function createFileMenu(
  editor: Editor,
  commands: CommandAccess,
  messages: Messages,
  options: FileOptions,
  status: HTMLElement,
  place: (element: HTMLElement) => void,
): FileMenu {
  const input = h('input', {
    type: 'file',
    class: 've-sr',
    tabindex: '-1',
    'aria-hidden': 'true',
  })
  const accept = ['.html', '.htm', '.txt']
  if (options.markdown) accept.push('.md', '.markdown')
  if (options.docx) accept.push('.docx')
  input.accept = accept.join(',')
  const text = h('p', { class: 've-hint', 'data-tone': 'error' })
  const notice = h(
    'div',
    { class: 've-panel ve-notice ve-glass ve-solid', role: 'alert', hidden: '' },
    [text],
  )
  let busy = false
  let noticeTimer = 0
  let controller: AbortController | null = null
  const fallbackName = options.fileName || messages.fileName

  const hideNotice = (): void => {
    window.clearTimeout(noticeTimer)
    notice.hidden = true
    text.replaceChildren()
  }

  const showError = (message: string): void => {
    status.textContent = ''
    text.replaceChildren(icon('alert'), message)
    notice.hidden = false
    place(notice)
    window.clearTimeout(noticeTimer)
    noticeTimer = window.setTimeout(hideNotice, NOTICE_TIME)
  }

  const announce = (message: string): void => {
    status.textContent = message
  }

  const run = async (work: () => Promise<void>): Promise<void> => {
    if (busy || editor.isDestroyed) return
    busy = true
    hideNotice()
    try {
      await work()
    } finally {
      busy = false
    }
  }

  const load = async <Module>(loader: () => Promise<Module>): Promise<Module | null> => {
    try {
      return await loader()
    } catch {
      showError(messages.fileLoadFailed)
      return null
    }
  }

  const download = (blob: Blob, extension: string): void => {
    const url = URL.createObjectURL(blob)
    const link = h('a', {
      href: url,
      download: safeFileName(fallbackName, extension, messages.fileName),
      hidden: '',
    })
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY)
    announce(messages.fileSaved)
  }

  const apply = (html: string): boolean =>
    commands.run(editor.isEmpty ? 'replaceContent' : 'insertContent', html)

  const readFile = async (file: File): Promise<string | null> => {
    const kind = importKind(file.name)
    if (!kind || (kind === 'docx' && !options.docx) || (kind === 'markdown' && !options.markdown)) {
      showError(messages.fileUnsupported)
      return null
    }
    if (file.size > (kind === 'docx' ? MAX_DOCX_BYTES : MAX_TEXT_BYTES)) {
      showError(messages.fileTooLarge)
      return null
    }
    announce(messages.fileOpening)
    if (kind === 'docx' && options.docx) {
      const module = await load(options.docx)
      if (!module) return null
      controller = new AbortController()
      const result = await module.importDocx(file, {
        signal: controller.signal,
        ...(options.upload ? { upload: options.upload } : {}),
        ...(options.allowBase64 ? { allowBase64: true } : {}),
      })
      const images = result.warnings.find((warning) => warning.code === 'IMAGE_DROPPED')
      const others = result.warnings.some((warning) => warning.code !== 'IMAGE_DROPPED')
      if (images) showError(format(messages.fileImagesDropped, { count: images.count }))
      else if (others) showError(messages.fileContentDropped)
      return result.html
    }
    const source = await file.text()
    if (kind === 'markdown' && options.markdown) {
      const module = await load(options.markdown)
      return module ? module.markdownToHtml(source) : null
    }
    return kind === 'html' ? source : textToHtml(source)
  }

  const openFile = async (file: File): Promise<void> => {
    try {
      const html = await readFile(file)
      if (html === null || editor.isDestroyed) return
      if (!apply(html)) {
        showError(messages.fileDamaged)
        return
      }
      if (notice.hidden) announce(messages.fileOpened)
      editor.focus()
    } catch (error) {
      if (editor.isDestroyed || errorCode(error) === 'ABORTED') return
      showError(messages[ERROR_MESSAGES[errorCode(error)] ?? 'fileDamaged'])
    } finally {
      controller = null
    }
  }

  const onChange = (): void => {
    const file = input.files?.[0]
    input.value = ''
    if (file) void run(() => openFile(file))
  }
  input.addEventListener('change', onChange)
  notice.addEventListener('click', hideNotice)

  const items: MenuItem[] = [
    {
      id: 'fileOpen',
      label: messages.fileOpen,
      icon: 'folder',
      role: 'menuitem',
      group: 0,
      disabled: () => busy || !editor.isEditable,
      action: () => {
        if (!input.isConnected) editor.dom.after(input)
        input.click()
        return true
      },
    },
  ]
  if (options.docx) {
    const loader = options.docx
    items.push({
      id: 'fileSaveDocx',
      label: messages.fileSaveDocx,
      icon: 'download',
      role: 'menuitem',
      group: 1,
      disabled: () => busy,
      action: () =>
        void run(async () => {
          const module = await load(loader)
          if (!module) return
          try {
            download(await module.exportDocx(editor, { title: fallbackName }), 'docx')
          } catch {
            showError(messages.fileSaveFailed)
          }
        }),
    })
  }
  if (options.markdown) {
    const loader = options.markdown
    items.push({
      id: 'fileSaveMarkdown',
      label: messages.fileSaveMarkdown,
      icon: 'download',
      role: 'menuitem',
      group: 1,
      disabled: () => busy,
      action: () =>
        void run(async () => {
          const module = await load(loader)
          if (module) {
            download(
              new Blob([module.toMarkdown(editor)], { type: 'text/markdown;charset=utf-8' }),
              'md',
            )
          }
        }),
    })
  }
  if (options.html !== false) {
    items.push({
      id: 'fileSaveHtml',
      label: messages.fileSaveHtml,
      icon: 'download',
      role: 'menuitem',
      group: 1,
      disabled: () => busy,
      action: () => {
        const html = printableHtml(editor, { title: fallbackName })
        download(new Blob([html], { type: 'text/html;charset=utf-8' }), 'html')
      },
    })
  }
  if (options.print !== false) {
    items.push({
      id: 'filePrint',
      label: messages.filePrint,
      icon: 'print',
      role: 'menuitem',
      group: 2,
      disabled: () => busy,
      action: () =>
        void run(() =>
          printDocument(editor, { title: fallbackName }).catch(() => {
            showError(messages.filePrintFailed)
          }),
        ),
    })
  }

  return {
    items,
    notice,
    hideNotice,
    destroy: () => {
      controller?.abort()
      window.clearTimeout(noticeTimer)
      input.removeEventListener('change', onChange)
      input.remove()
      notice.remove()
    },
  }
}
