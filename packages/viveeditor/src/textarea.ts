import { Editor, type EditorOptions } from '@viveeditor/core'
import { createUI, type EditorUI, resolveLocale, type UiOptions } from '@viveeditor/ui'
import { dropInDefaults } from './defaults.js'
import { classicPreset } from './presets.js'

export interface TextareaEditorOptions extends Omit<EditorOptions, 'content'> {
  ui?: UiOptions | false
}

export interface TextareaEditor {
  readonly editor: Editor
  readonly ui: EditorUI | null
  readonly textarea: HTMLTextAreaElement
  readonly container: HTMLElement
  sync(): void
  destroy(): void
}

const REQUIRED_MESSAGES = {
  tr: 'Bu alan boş bırakılamaz.',
  en: 'This field is required.',
} as const

const UPLOAD_MESSAGES = {
  tr: {
    waiting: 'Görseller yükleniyor; bitince form gönderilecek.',
    failed: 'Bir görsel yüklenemedi, form gönderilmedi.',
  },
  en: {
    waiting: 'Images are uploading; the form will be sent when they finish.',
    failed: 'An image could not be uploaded, so the form was not sent.',
  },
} as const

const NO_UPLOADS = { uploading: 0, failed: 0 }

let errorSequence = 0

const upgraded = new WeakMap<HTMLTextAreaElement, Promise<TextareaEditor>>()

function labelFor(textarea: HTMLTextAreaElement): string | undefined {
  const fromAttribute = textarea.getAttribute('aria-label')
  if (fromAttribute) return fromAttribute
  const fromLabel = textarea.labels?.[0]?.textContent?.trim()
  return fromLabel || undefined
}

export function upgradeTextarea(
  textarea: HTMLTextAreaElement,
  options: TextareaEditorOptions = {},
): Promise<TextareaEditor> {
  const existing = upgraded.get(textarea)
  if (existing) return existing
  const pending = createTextareaEditor(textarea, options)
  upgraded.set(textarea, pending)
  pending.catch(() => upgraded.delete(textarea))
  return pending
}

async function createTextareaEditor(
  textarea: HTMLTextAreaElement,
  options: TextareaEditorOptions,
): Promise<TextareaEditor> {
  const container = document.createElement('div')
  container.className = 'vive-editor'
  textarea.after(container)

  const { ui: uiOptions, ...editorOptions } = options
  const label = options.label ?? labelFor(textarea)
  const defaults = dropInDefaults()
  const locale = uiOptions ? uiOptions.locale : undefined
  let editor: Editor
  try {
    editor = await Editor.create(container, {
      extensions: classicPreset(locale, defaults.markdown ? { markdown: defaults.markdown } : {}),
      ...editorOptions,
      ...(label === undefined ? {} : { label }),
      content: textarea.value,
      editable: (options.editable ?? true) && !textarea.disabled && !textarea.readOnly,
    })
  } catch (error) {
    container.remove()
    throw error
  }

  const files =
    textarea.dataset.files === 'false'
      ? false
      : ((uiOptions ? uiOptions.files : undefined) ?? defaults.files)
  const panels = (uiOptions ? uiOptions.panels : undefined) ?? defaults.panels
  const ui =
    uiOptions === false
      ? null
      : createUI(editor, {
          ...uiOptions,
          ...(files === undefined ? {} : { files }),
          ...(panels === undefined ? {} : { panels }),
        })
  const wasRequired = textarea.required
  const wasHidden = textarea.hidden
  textarea.required = false
  textarea.hidden = true
  const surface = editor.dom
  if (wasRequired) surface.setAttribute('aria-required', 'true')

  errorSequence += 1
  const error = document.createElement('p')
  error.className = 'vive-error'
  error.id = `vive-error-${errorSequence}`
  error.hidden = true
  error.textContent = textarea.dataset.requiredMessage ?? REQUIRED_MESSAGES[resolveLocale(locale)]
  if (wasRequired) container.after(error)

  const uploadMessages = UPLOAD_MESSAGES[resolveLocale(locale)]
  const notice = document.createElement('p')
  notice.className = 'vive-notice'
  notice.setAttribute('role', 'status')
  notice.hidden = true
  ;(wasRequired ? error : container).after(notice)
  const showNotice = (text: string, failed: boolean): void => {
    notice.textContent = text
    notice.classList.toggle('vive-error', failed)
    notice.hidden = false
  }
  const uploads = () =>
    'pendingUploads' in editor.query ? editor.query.pendingUploads() : NO_UPLOADS
  let stopWaiting: (() => void) | null = null

  const sync = (): void => {
    const html = editor.isEmpty ? '' : editor.getHTML()
    if (textarea.value === html) return
    textarea.value = html
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const clearInvalid = (): void => {
    surface.removeAttribute('aria-invalid')
    surface.removeAttribute('aria-describedby')
    error.hidden = true
    if (!stopWaiting) notice.hidden = true
  }

  const unsubscribe = editor.on('change', () => {
    sync()
    clearInvalid()
  })

  const form = textarea.form
  const submitAfterUploads = (target: HTMLFormElement, submitter: HTMLElement | null): void => {
    let failed = uploads().failed
    let sawFailure = false
    showNotice(uploadMessages.waiting, false)
    surface.setAttribute('aria-busy', 'true')
    const stop = editor.on('update', () => {
      const current = uploads()
      if (current.failed > failed) sawFailure = true
      failed = current.failed
      if (current.uploading > 0) return
      finish()
      if (sawFailure) {
        showNotice(uploadMessages.failed, true)
        textarea.dispatchEvent(
          new CustomEvent('vive:invalid', { bubbles: true, detail: { reason: 'upload' } }),
        )
        editor.focus()
        return
      }
      notice.hidden = true
      const button =
        submitter && 'form' in submitter && submitter.form === target ? submitter : undefined
      target.requestSubmit(button)
    })
    const finish = (): void => {
      stop()
      stopWaiting = null
      surface.removeAttribute('aria-busy')
    }
    stopWaiting = finish
  }
  const onSubmit = (event: SubmitEvent): void => {
    if (stopWaiting || uploads().uploading > 0) {
      event.preventDefault()
      event.stopImmediatePropagation()
      if (!stopWaiting && form) submitAfterUploads(form, event.submitter)
      return
    }
    sync()
    if (wasRequired && editor.isEmpty) {
      event.preventDefault()
      event.stopImmediatePropagation()
      surface.setAttribute('aria-invalid', 'true')
      surface.setAttribute('aria-describedby', error.id)
      error.hidden = false
      textarea.dispatchEvent(
        new CustomEvent('vive:invalid', { bubbles: true, detail: { reason: 'required' } }),
      )
      editor.focus()
    }
  }
  const onReset = (): void => {
    setTimeout(() => {
      editor.setContent(textarea.defaultValue)
      clearInvalid()
    })
  }
  form?.addEventListener('submit', onSubmit, { capture: true })
  form?.addEventListener('reset', onReset)

  const labels = [...(textarea.labels ?? [])]
  const onLabelClick = (event: MouseEvent): void => {
    event.preventDefault()
    editor.focus()
  }
  for (const element of labels) element.addEventListener('click', onLabelClick)

  let destroyed = false
  return {
    editor,
    ui,
    textarea,
    container,
    sync,
    destroy: () => {
      if (destroyed) return
      destroyed = true
      stopWaiting?.()
      sync()
      unsubscribe()
      form?.removeEventListener('submit', onSubmit, { capture: true })
      form?.removeEventListener('reset', onReset)
      for (const element of labels) element.removeEventListener('click', onLabelClick)
      ui?.destroy()
      editor.destroy()
      error.remove()
      notice.remove()
      container.remove()
      textarea.required = wasRequired
      textarea.hidden = wasHidden
      upgraded.delete(textarea)
    },
  }
}

export async function upgradeAll(
  root: ParentNode = document,
  options: TextareaEditorOptions = {},
): Promise<TextareaEditor[]> {
  const textareas = [...root.querySelectorAll<HTMLTextAreaElement>('textarea[data-editor]')]
  return Promise.all(textareas.map((textarea) => upgradeTextarea(textarea, options)))
}
