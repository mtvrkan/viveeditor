import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineViveEditor, type ViveEditorElement } from '../src/index.js'

interface FakeInternals {
  readonly form: HTMLFormElement | null
  value: unknown
  invalid: boolean
  message: string
  setFormValue(value: unknown): void
  setValidity(flags: ValidityStateFlags, message?: string): void
  checkValidity(): boolean
}

const internals = new WeakMap<HTMLElement, FakeInternals>()

HTMLElement.prototype.attachInternals = function attachInternals(this: HTMLElement) {
  const host = this
  const fake: FakeInternals = {
    get form() {
      return host.closest('form')
    },
    value: null,
    invalid: false,
    message: '',
    setFormValue(value) {
      fake.value = value
    },
    setValidity(flags, message = '') {
      fake.invalid = Object.values(flags).some(Boolean)
      fake.message = message
    },
    checkValidity: () => !fake.invalid,
  }
  internals.set(host, fake)
  return fake as unknown as ElementInternals
}

defineViveEditor()

const formValue = (element: HTMLElement): unknown => internals.get(element)?.value

async function render(html: string): Promise<ViveEditorElement> {
  document.body.innerHTML = html
  const element = document.querySelector('vive-editor')
  if (!element) throw new Error('Missing vive-editor')
  await element.ready
  return element
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('<vive-editor>', () => {
  it('starts from the value attribute with the toolbar', async () => {
    const element = await render(
      '<vive-editor value="<p><b>Merhaba</b></p>" locale="tr"></vive-editor>',
    )

    expect(element.value).toBe('<p><strong>Merhaba</strong></p>')
    expect(formValue(element)).toBe('<p><strong>Merhaba</strong></p>')
    expect(element.querySelector('[role="toolbar"]')).not.toBeNull()
  })

  it('fires input and updates the form value when the text changes', async () => {
    const element = await render('<vive-editor name="body"></vive-editor>')
    const onInput = vi.fn()
    element.addEventListener('input', onInput)

    element.editor?.setContent('<p>yeni</p>')

    expect(onInput).toHaveBeenCalledTimes(1)
    expect(formValue(element)).toBe('<p>yeni</p>')
  })

  it('returns to the first value when the form resets it', async () => {
    const element = await render('<vive-editor value="<p>ilk</p>"></vive-editor>')
    element.value = '<p>sonraki</p>'

    element.formResetCallback()

    expect(element.value).toBe('<p>ilk</p>')
  })

  it('is invalid while required and empty, with a message in the page language', async () => {
    const element = await render('<vive-editor required locale="tr"></vive-editor>')

    const before = element.checkValidity()
    const message = internals.get(element)?.message
    element.value = '<p>dolu</p>'

    expect(before).toBe(false)
    expect(message).toBe('Bu alan boş bırakılamaz.')
    expect(element.checkValidity()).toBe(true)
  })

  it('stops editing when readonly or disabled by its form', async () => {
    const element = await render('<vive-editor></vive-editor>')

    element.setAttribute('readonly', '')
    const readonly = element.editor?.isEditable
    element.removeAttribute('readonly')
    element.formDisabledCallback(true)

    expect(readonly).toBe(false)
    expect(element.editor?.isEditable).toBe(false)
  })

  it('keeps its value when it is moved to another place in the page', async () => {
    const element = await render('<div id="a"><vive-editor></vive-editor></div><div id="b"></div>')
    element.value = '<p>taşındı</p>'

    document.querySelector('#b')?.append(element)
    await vi.waitFor(() => expect(element.editor).not.toBeNull())

    expect(element.querySelectorAll('.vive-editor')).toHaveLength(1)
    expect(element.value).toBe('<p>taşındı</p>')
  })
})
