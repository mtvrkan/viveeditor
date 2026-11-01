import { type Editor, type EditorMount, mountEditor, resolveLocale } from 'viveeditor'

const REQUIRED_MESSAGES = {
  tr: 'Bu alan boş bırakılamaz.',
  en: 'This field is required.',
} as const

export class ViveEditorElement extends HTMLElement {
  static readonly formAssociated: boolean = true
  static readonly observedAttributes: readonly string[] = ['readonly', 'disabled', 'required']

  readonly #internals: ElementInternals
  #mount: EditorMount | null = null
  #value: string | null = null
  #initial: string | null = null
  #formDisabled = false
  #focusValue = ''
  #ready: Promise<Editor>
  #resolveReady: (editor: Editor) => void = () => undefined

  constructor() {
    super()
    this.#internals = this.attachInternals()
    this.#ready = new Promise((resolve) => {
      this.#resolveReady = resolve
    })
  }

  get value(): string {
    if (this.#mount) return this.#mount.getValue()
    return this.#value ?? this.getAttribute('value') ?? ''
  }

  set value(html: string) {
    this.#value = String(html)
    this.#mount?.setValue(this.#value)
    this.#sync()
  }

  get editor(): Editor | null {
    return this.#mount?.editor ?? null
  }

  get ready(): Promise<Editor> {
    return this.#ready
  }

  get form(): HTMLFormElement | null {
    return this.#internals.form
  }

  get name(): string {
    return this.getAttribute('name') ?? ''
  }

  get validity(): ValidityState {
    return this.#internals.validity
  }

  get validationMessage(): string {
    return this.#internals.validationMessage
  }

  checkValidity(): boolean {
    return this.#internals.checkValidity()
  }

  reportValidity(): boolean {
    return this.#internals.reportValidity()
  }

  override focus(options?: FocusOptions): void {
    if (this.editor) this.editor.focus()
    else super.focus(options)
  }

  connectedCallback(): void {
    if (this.#mount) return
    this.#initial ??= this.getAttribute('value') ?? ''
    const locale = this.getAttribute('locale') ?? undefined
    const label = this.getAttribute('label') ?? this.getAttribute('aria-label') ?? undefined
    this.#mount = mountEditor(this, {
      value: this.#value ?? this.#initial,
      editable: this.#editable(),
      ...(locale === undefined ? {} : { locale }),
      ...(label === undefined ? {} : { label }),
      ...(this.getAttribute('toolbar') === 'false' ? { ui: false as const } : {}),
      onChange: () => {
        this.#sync()
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
      },
      onFocus: () => {
        this.#focusValue = this.value
      },
      onBlur: () => {
        if (this.value !== this.#focusValue) {
          this.dispatchEvent(new Event('change', { bubbles: true }))
        }
      },
      onReady: (editor) => {
        this.#sync()
        this.#resolveReady(editor)
      },
    })
    this.#sync()
  }

  disconnectedCallback(): void {
    if (!this.#mount) return
    this.#value = this.#mount.getValue()
    this.#mount.destroy()
    this.#mount = null
  }

  attributeChangedCallback(): void {
    this.#mount?.setEditable(this.#editable())
    this.#sync()
  }

  formResetCallback(): void {
    this.value = this.#initial ?? this.getAttribute('value') ?? ''
  }

  formDisabledCallback(disabled: boolean): void {
    this.#formDisabled = disabled
    this.#mount?.setEditable(this.#editable())
  }

  formStateRestoreCallback(state: unknown): void {
    if (typeof state === 'string') this.value = state
  }

  #editable(): boolean {
    return !this.#formDisabled && !this.hasAttribute('readonly') && !this.hasAttribute('disabled')
  }

  #sync(): void {
    const value = this.value
    this.#internals.setFormValue(value)
    if (this.hasAttribute('required') && value === '') {
      const message = REQUIRED_MESSAGES[resolveLocale(this.getAttribute('locale') ?? undefined)]
      const anchor = this.editor?.dom
      this.#internals.setValidity({ valueMissing: true }, message, anchor)
    } else {
      this.#internals.setValidity({})
    }
  }
}

export function defineViveEditor(tag = 'vive-editor'): CustomElementConstructor {
  const existing = customElements.get(tag)
  if (existing) return existing
  const element = class extends ViveEditorElement {}
  customElements.define(tag, element)
  return element
}

declare global {
  interface HTMLElementTagNameMap {
    'vive-editor': ViveEditorElement
  }
}
