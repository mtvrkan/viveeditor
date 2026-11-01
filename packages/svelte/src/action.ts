import { type Editor, type EditorMount, type MountOptions, mountEditor } from 'viveeditor'

export interface ViveEditorOptions
  extends Pick<MountOptions, 'extensions' | 'ui' | 'locale' | 'label' | 'onError'> {
  value?: string
  editable?: boolean
  onChange?: (html: string, editor: Editor) => void
  onReady?: (editor: Editor) => void
  onFocus?: (editor: Editor) => void
  onBlur?: (editor: Editor) => void
}

export interface ViveEditorAction {
  update(options: ViveEditorOptions): void
  destroy(): void
}

export function viveEditor(host: HTMLElement, options: ViveEditorOptions = {}): ViveEditorAction {
  let latest = options
  const { value, editable, extensions, ui, locale, label } = options
  const mount: EditorMount = mountEditor(host, {
    value: value ?? '',
    editable: editable ?? true,
    ...(extensions === undefined ? {} : { extensions }),
    ...(ui === undefined ? {} : { ui }),
    ...(locale === undefined ? {} : { locale }),
    ...(label === undefined ? {} : { label }),
    onChange: (html, current) => latest.onChange?.(html, current),
    onReady: (current) => latest.onReady?.(current),
    onFocus: (current) => latest.onFocus?.(current),
    onBlur: (current) => latest.onBlur?.(current),
    onError: (error) => latest.onError?.(error),
  })
  return {
    update(next) {
      latest = next
      if (next.value !== undefined) mount.setValue(next.value)
      mount.setEditable(next.editable ?? true)
    },
    destroy() {
      mount.destroy()
    },
  }
}
