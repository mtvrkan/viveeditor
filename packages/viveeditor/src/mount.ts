import { Editor, type Extension } from '@viveeditor/core'
import { createUI, type EditorUI, type UiOptions } from '@viveeditor/ui'
import { classicPreset } from './presets.js'

export interface MountOptions {
  value?: string
  extensions?: readonly Extension[]
  ui?: UiOptions | false
  locale?: string
  label?: string
  editable?: boolean
  onChange?: (html: string, editor: Editor) => void
  onReady?: (editor: Editor) => void
  onFocus?: (editor: Editor) => void
  onBlur?: (editor: Editor) => void
  onError?: (error: unknown) => void
}

export interface EditorMount {
  readonly ready: Promise<Editor>
  readonly editor: Editor | null
  readonly ui: EditorUI | null
  getValue(): string
  setValue(html: string): void
  setEditable(editable: boolean): void
  destroy(): void
}

export class MountDestroyedError extends Error {
  constructor() {
    super('The editor was destroyed before it was ready.')
    this.name = 'MountDestroyedError'
  }
}

const htmlOf = (editor: Editor): string => (editor.isEmpty ? '' : editor.getHTML())

export function mountEditor(host: HTMLElement, options: MountOptions = {}): EditorMount {
  const container = host.ownerDocument.createElement('div')
  container.className = 'vive-editor'
  host.append(container)
  const locale = options.locale ?? (options.ui ? options.ui.locale : undefined)
  const initial = options.value ?? ''
  let value = initial
  let editable = options.editable ?? true
  let editor: Editor | null = null
  let ui: EditorUI | null = null
  let destroyed = false
  let applying = false
  let applied: { input: string; output: string } | null = null
  const unsubscribers: Array<() => void> = []

  const apply = (target: Editor, html: string): void => {
    const current = htmlOf(target)
    if (html === current || (applied?.input === html && applied.output === current)) return
    applying = true
    try {
      target.setContent(html)
    } finally {
      applying = false
    }
    applied = { input: html, output: htmlOf(target) }
  }

  const ready = Editor.create(container, {
    extensions: options.extensions ?? classicPreset(locale),
    content: initial,
    editable,
    ...(options.label === undefined ? {} : { label: options.label }),
  }).then(
    (created) => {
      if (destroyed) {
        created.destroy()
        throw new MountDestroyedError()
      }
      editor = created
      if (value !== initial) apply(created, value)
      if (created.isEditable !== editable) created.setEditable(editable)
      unsubscribers.push(
        created.on('change', () => {
          if (!applying) options.onChange?.(htmlOf(created), created)
        }),
        created.on('focus', () => options.onFocus?.(created)),
        created.on('blur', () => options.onBlur?.(created)),
      )
      if (options.ui !== false) {
        ui = createUI(created, { ...(locale === undefined ? {} : { locale }), ...options.ui })
      }
      options.onReady?.(created)
      return created
    },
    (error: unknown) => {
      container.remove()
      if (!destroyed) options.onError?.(error)
      throw error
    },
  )
  ready.catch(() => undefined)

  return {
    ready,
    get editor() {
      return editor
    },
    get ui() {
      return ui
    },
    getValue: () => (editor ? htmlOf(editor) : value),
    setValue: (html) => {
      value = html
      if (editor && !destroyed) apply(editor, html)
    },
    setEditable: (next) => {
      editable = next
      if (editor && !destroyed) editor.setEditable(next)
    },
    destroy: () => {
      if (destroyed) return
      destroyed = true
      for (const unsubscribe of unsubscribers.splice(0)) unsubscribe()
      ui?.destroy()
      editor?.destroy()
      container.remove()
    },
  }
}
