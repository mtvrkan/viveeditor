import { type Editor, type EditorMount, type MountOptions, mountEditor } from 'viveeditor'
import {
  type DefineSetupFnComponent,
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  type ShallowRef,
  shallowRef,
  watch,
} from 'vue'

export interface ViveEditorOptions
  extends Pick<MountOptions, 'extensions' | 'ui' | 'locale' | 'label' | 'onError'> {
  value?: string
  editable?: boolean
  onChange?: (html: string, editor: Editor) => void
  onReady?: (editor: Editor) => void
  onFocus?: (editor: Editor) => void
  onBlur?: (editor: Editor) => void
}

export interface ViveEditorHandle {
  el: ShallowRef<HTMLElement | null>
  editor: ShallowRef<Editor | null>
}

export function useViveEditor(options: () => ViveEditorOptions): ViveEditorHandle {
  const el = shallowRef<HTMLElement | null>(null)
  const editor = shallowRef<Editor | null>(null)
  let mount: EditorMount | null = null

  onMounted(() => {
    const host = el.value
    if (!host) return
    const { value, editable, extensions, ui, locale, label } = options()
    mount = mountEditor(host, {
      value: value ?? '',
      editable: editable ?? true,
      ...(extensions === undefined ? {} : { extensions }),
      ...(ui === undefined ? {} : { ui }),
      ...(locale === undefined ? {} : { locale }),
      ...(label === undefined ? {} : { label }),
      onChange: (html, current) => options().onChange?.(html, current),
      onReady: (current) => {
        editor.value = current
        options().onReady?.(current)
      },
      onFocus: (current) => options().onFocus?.(current),
      onBlur: (current) => options().onBlur?.(current),
      onError: (error) => options().onError?.(error),
    })
  })

  onBeforeUnmount(() => {
    mount?.destroy()
    mount = null
    editor.value = null
  })

  watch(
    () => options().value,
    (value) => {
      if (value !== undefined) mount?.setValue(value)
    },
  )

  watch(
    () => options().editable ?? true,
    (editable) => mount?.setEditable(editable),
  )

  return { el, editor }
}

export interface ViveEditorProps
  extends Pick<ViveEditorOptions, 'extensions' | 'ui' | 'locale' | 'label' | 'editable'> {
  modelValue?: string
}

export type ViveEditorEmits = {
  'update:modelValue': (html: string) => boolean
  ready: (editor: Editor) => boolean
  focus: (editor: Editor) => boolean
  blur: (editor: Editor) => boolean
  error: (error: unknown) => boolean
}

const isEditor = (editor: Editor): boolean => editor !== null
const emits: ViveEditorEmits = {
  'update:modelValue': (html) => typeof html === 'string',
  ready: isEditor,
  focus: isEditor,
  blur: isEditor,
  error: () => true,
}

export const ViveEditor: DefineSetupFnComponent<ViveEditorProps, ViveEditorEmits> = defineComponent(
  (props: ViveEditorProps, { emit, expose }) => {
    const { el, editor } = useViveEditor(() => ({
      ...(props.modelValue === undefined ? {} : { value: props.modelValue }),
      ...(props.editable === undefined ? {} : { editable: props.editable }),
      ...(props.extensions === undefined ? {} : { extensions: props.extensions }),
      ...(props.ui === undefined ? {} : { ui: props.ui }),
      ...(props.locale === undefined ? {} : { locale: props.locale }),
      ...(props.label === undefined ? {} : { label: props.label }),
      onChange: (html) => emit('update:modelValue', html),
      onReady: (current) => emit('ready', current),
      onFocus: (current) => emit('focus', current),
      onBlur: (current) => emit('blur', current),
      onError: (error) => emit('error', error),
    }))
    expose({ editor })
    return () => h('div', { ref: el })
  },
  {
    name: 'ViveEditor',
    props: {
      modelValue: String,
      extensions: Array,
      ui: null,
      locale: String,
      label: String,
      editable: { type: Boolean, default: undefined },
    },
    emits,
  },
)
