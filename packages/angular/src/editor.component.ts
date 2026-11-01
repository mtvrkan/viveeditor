import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  effect,
  forwardRef,
  type InputSignal,
  type InputSignalWithTransform,
  inject,
  input,
  type OutputEmitterRef,
  output,
  type Signal,
  signal,
  type WritableSignal,
} from '@angular/core'
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms'
import { type Editor, type EditorMount, type MountOptions, mountEditor } from 'viveeditor'

@Component({
  selector: 'vive-ng-editor',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ViveEditorComponent),
      multi: true,
    },
  ],
})
export class ViveEditorComponent implements ControlValueAccessor {
  readonly extensions: InputSignal<MountOptions['extensions']> = input<MountOptions['extensions']>()
  readonly ui: InputSignal<MountOptions['ui']> = input<MountOptions['ui']>()
  readonly locale: InputSignal<string | undefined> = input<string>()
  readonly label: InputSignal<string | undefined> = input<string>()
  readonly readonly: InputSignalWithTransform<boolean, unknown> = input(false, {
    transform: booleanAttribute,
  })

  readonly ready: OutputEmitterRef<Editor> = output<Editor>()
  readonly editorFocus: OutputEmitterRef<Editor> = output<Editor>()
  readonly editorBlur: OutputEmitterRef<Editor> = output<Editor>()

  readonly #host: ElementRef<HTMLElement> = inject(ElementRef)
  readonly #disabled: WritableSignal<boolean> = signal(false)
  readonly #editable: Signal<boolean> = computed(() => !this.readonly() && !this.#disabled())
  #mount: EditorMount | null = null
  #value = ''
  #onChange: (html: string) => void = () => undefined
  #onTouched: () => void = () => undefined

  constructor() {
    afterNextRender(() => {
      const extensions = this.extensions()
      const ui = this.ui()
      const locale = this.locale()
      const label = this.label()
      this.#mount = mountEditor(this.#host.nativeElement, {
        value: this.#value,
        editable: this.#editable(),
        ...(extensions === undefined ? {} : { extensions }),
        ...(ui === undefined ? {} : { ui }),
        ...(locale === undefined ? {} : { locale }),
        ...(label === undefined ? {} : { label }),
        onChange: (html) => {
          this.#value = html
          this.#onChange(html)
        },
        onReady: (editor) => this.ready.emit(editor),
        onFocus: (editor) => this.editorFocus.emit(editor),
        onBlur: (editor) => {
          this.#onTouched()
          this.editorBlur.emit(editor)
        },
      })
    })
    effect(() => {
      const editable = this.#editable()
      this.#mount?.setEditable(editable)
    })
    inject(DestroyRef).onDestroy(() => {
      this.#mount?.destroy()
      this.#mount = null
    })
  }

  get editor(): Editor | null {
    return this.#mount?.editor ?? null
  }

  writeValue(value: unknown): void {
    this.#value = typeof value === 'string' ? value : ''
    this.#mount?.setValue(this.#value)
  }

  registerOnChange(fn: (html: string) => void): void {
    this.#onChange = fn
  }

  registerOnTouched(fn: () => void): void {
    this.#onTouched = fn
  }

  setDisabledState(disabled: boolean): void {
    this.#disabled.set(disabled)
  }
}
