import {
  type CSSProperties,
  createElement,
  type ForwardRefExoticComponent,
  forwardRef,
  type RefAttributes,
  type RefObject,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { type Editor, type EditorMount, type MountOptions, mountEditor } from 'viveeditor'

export interface ViveEditorOptions
  extends Pick<MountOptions, 'extensions' | 'ui' | 'locale' | 'label' | 'onError'> {
  value?: string
  defaultValue?: string
  editable?: boolean
  onChange?: (html: string, editor: Editor) => void
  onReady?: (editor: Editor) => void
  onFocus?: (editor: Editor) => void
  onBlur?: (editor: Editor) => void
}

export interface ViveEditorProps extends ViveEditorOptions {
  id?: string
  className?: string
  style?: CSSProperties
}

export interface ViveEditorHandle {
  ref: RefObject<HTMLDivElement | null>
  editor: Editor | null
}

export function useViveEditor(options: ViveEditorOptions): ViveEditorHandle {
  const ref = useRef<HTMLDivElement | null>(null)
  const mount = useRef<EditorMount | null>(null)
  const latest = useRef(options)
  latest.current = options
  const [editor, setEditor] = useState<Editor | null>(null)

  useEffect(() => {
    const host = ref.current
    if (!host) return
    const { value, defaultValue, editable, extensions, ui, locale, label } = latest.current
    const created = mountEditor(host, {
      value: value ?? defaultValue ?? '',
      editable: editable ?? true,
      ...(extensions === undefined ? {} : { extensions }),
      ...(ui === undefined ? {} : { ui }),
      ...(locale === undefined ? {} : { locale }),
      ...(label === undefined ? {} : { label }),
      onChange: (html, current) => latest.current.onChange?.(html, current),
      onReady: (current) => {
        setEditor(current)
        latest.current.onReady?.(current)
      },
      onFocus: (current) => latest.current.onFocus?.(current),
      onBlur: (current) => latest.current.onBlur?.(current),
      onError: (error) => latest.current.onError?.(error),
    })
    mount.current = created
    return () => {
      created.destroy()
      mount.current = null
      setEditor(null)
    }
  }, [])

  useEffect(() => {
    if (options.value !== undefined) mount.current?.setValue(options.value)
  }, [options.value])

  useEffect(() => {
    mount.current?.setEditable(options.editable ?? true)
  }, [options.editable])

  return { ref, editor }
}

export const ViveEditor: ForwardRefExoticComponent<ViveEditorProps & RefAttributes<Editor | null>> =
  forwardRef<Editor | null, ViveEditorProps>(function ViveEditor(props, forwarded) {
    const { id, className, style, ...options } = props
    const { ref, editor } = useViveEditor(options)
    useImperativeHandle<Editor | null, Editor | null>(forwarded, () => editor, [editor])
    return createElement('div', { ref, id, className, style })
  })
