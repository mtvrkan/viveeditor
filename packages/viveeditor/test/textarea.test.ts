import { Image } from '@viveeditor/ext-image'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setDropInDefaults } from '../src/defaults.js'
import {
  classicPreset,
  type TextareaEditor,
  type TextareaEditorOptions,
  upgradeAll,
  upgradeTextarea,
} from '../src/index.js'

let handles: TextareaEditor[] = []

function render(html: string): void {
  document.body.innerHTML = html
}

function field(selector = 'textarea'): HTMLTextAreaElement {
  const element = document.querySelector<HTMLTextAreaElement>(selector)
  if (!element) throw new Error(`Missing ${selector}`)
  return element
}

async function upgrade(
  textarea = field(),
  options: TextareaEditorOptions = {},
): Promise<TextareaEditor> {
  const handle = await upgradeTextarea(textarea, options)
  handles.push(handle)
  return handle
}

function submit(form: HTMLFormElement): SubmitEvent {
  const event = new SubmitEvent('submit', { bubbles: true, cancelable: true })
  form.dispatchEvent(event)
  return event
}

afterEach(() => {
  for (const handle of handles) handle.destroy()
  handles = []
  document.body.innerHTML = ''
})

describe('upgradeTextarea', () => {
  it('loads the textarea value and hides the textarea', async () => {
    render('<form><textarea name="body"><p>Merhaba <b>dünya</b></p></textarea></form>')

    const { editor, textarea } = await upgrade()

    expect(editor.getHTML()).toBe('<p>Merhaba <strong>dünya</strong></p>')
    expect(textarea.hidden).toBe(true)
    expect(document.querySelector('.vive-editor .vive-content')).not.toBeNull()
  })

  it('writes editor changes back to the textarea and fires input', async () => {
    render('<form><textarea name="body"></textarea></form>')
    const onInput = vi.fn()
    field().addEventListener('input', onInput)
    const { editor, textarea } = await upgrade()

    editor.setContent('<p>yeni içerik</p>')

    expect(textarea.value).toBe('<p>yeni içerik</p>')
    expect(onInput).toHaveBeenCalledTimes(1)
  })

  it('sanitizes hostile initial HTML coming from the server', async () => {
    render('<textarea><p onclick="x()">a<script>alert(1)</script></p></textarea>')

    const { editor } = await upgrade()

    expect(editor.getHTML()).toBe('<p>a</p>')
  })

  it('returns the same editor when upgraded twice concurrently', async () => {
    render('<textarea></textarea>')

    const [first, second] = await Promise.all([upgradeTextarea(field()), upgradeTextarea(field())])
    if (first) handles.push(first)

    expect(first).toBe(second)
    expect(document.querySelectorAll('.vive-editor')).toHaveLength(1)
  })

  it('takes its accessible name from the associated label', async () => {
    render('<label for="b">Makale metni</label><textarea id="b"></textarea>')

    await upgrade()

    const surface = document.querySelector('.vive-content')
    expect(surface?.getAttribute('aria-label')).toBe('Makale metni')
  })

  it('stays read-only for a disabled textarea', async () => {
    render('<textarea disabled><p>kilitli</p></textarea>')

    const { editor } = await upgrade()

    expect(editor.isEditable).toBe(false)
  })
})

describe('form integration', () => {
  it('blocks submit of an empty required field and marks it invalid', async () => {
    render('<form><textarea name="body" required></textarea></form>')
    const form = document.querySelector('form') as HTMLFormElement
    const onInvalid = vi.fn()
    field().addEventListener('vive:invalid', onInvalid)
    await upgrade()

    const event = submit(form)

    expect(event.defaultPrevented).toBe(true)
    expect(onInvalid).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.vive-content')?.getAttribute('aria-invalid')).toBe('true')
  })

  it('lets a filled required field submit and clears the invalid mark', async () => {
    render('<form><textarea name="body" required></textarea></form>')
    const form = document.querySelector('form') as HTMLFormElement
    const { editor } = await upgrade()
    submit(form)
    editor.setContent('<p>dolu</p>')

    const event = submit(form)

    expect(event.defaultPrevented).toBe(false)
    expect(document.querySelector('.vive-content')?.hasAttribute('aria-invalid')).toBe(false)
    expect(new FormData(form).get('body')).toBe('<p>dolu</p>')
  })

  it('restores the original content on form reset', async () => {
    render('<form><textarea name="body"><p>ilk</p></textarea></form>')
    const form = document.querySelector('form') as HTMLFormElement
    const { editor } = await upgrade()
    editor.setContent('<p>değişti</p>')

    form.reset()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(editor.getHTML()).toBe('<p>ilk</p>')
  })

  it('restores the textarea exactly on destroy', async () => {
    render('<form><textarea name="body" required><p>a</p></textarea></form>')
    const handle = await upgradeTextarea(field())

    handle.editor.setContent('<p>son</p>')
    handle.destroy()

    const textarea = field()
    expect(textarea.hidden).toBe(false)
    expect(textarea.required).toBe(true)
    expect(textarea.value).toBe('<p>son</p>')
    expect(document.querySelector('.vive-editor')).toBeNull()
  })
})

describe('pending image uploads', () => {
  const settle = async (): Promise<void> => {
    for (let index = 0; index < 5; index++) await new Promise((resolve) => setTimeout(resolve, 0))
  }

  const pngFile = (): File => {
    const bytes = new Uint8Array(33)
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52])
    new DataView(bytes.buffer).setUint32(16, 4)
    new DataView(bytes.buffer).setUint32(20, 3)
    return new File([bytes], 'photo.png', { type: 'image/png' })
  }

  async function uploading() {
    render(
      '<form><textarea name="body"><p>Metin</p></textarea><button name="action" value="save">Kaydet</button></form>',
    )
    const form = document.querySelector('form') as HTMLFormElement
    const button = document.querySelector('button') as HTMLButtonElement
    const uploads: Array<{ resolve: (src: string) => void; reject: (error: Error) => void }> = []
    const upload = vi.fn(
      () =>
        new Promise<string>((resolve, reject) => {
          uploads.push({ resolve, reject })
        }),
    )
    const extensions = [
      ...classicPreset('en').filter((extension) => extension.name !== 'image'),
      Image.configure({ upload }),
    ]
    const handle = await upgrade(field(), { extensions })
    const requestSubmit = vi.spyOn(form, 'requestSubmit').mockImplementation(() => undefined)
    handle.editor.commands.uploadImages([pngFile()])
    await settle()
    return { form, button, uploads, handle, requestSubmit }
  }

  function submitWith(form: HTMLFormElement, submitter: HTMLElement): SubmitEvent {
    const event = new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter })
    form.dispatchEvent(event)
    return event
  }

  it('holds the submit until the upload finishes, then sends it with the same button', async () => {
    const { form, button, uploads, requestSubmit } = await uploading()

    const event = submitWith(form, button)
    const notice = document.querySelector<HTMLElement>('.vive-notice')
    expect(event.defaultPrevented).toBe(true)
    expect(notice?.hidden).toBe(false)
    expect(notice?.getAttribute('role')).toBe('status')
    expect(requestSubmit).not.toHaveBeenCalled()
    uploads[0]?.resolve('https://cdn.example.com/u/1.png')
    await settle()

    expect(requestSubmit).toHaveBeenCalledTimes(1)
    expect(requestSubmit).toHaveBeenCalledWith(button)
    expect(notice?.hidden).toBe(true)
    expect(field().value).toContain('https://cdn.example.com/u/1.png')
  })

  it('does not send the form and announces it when the upload fails', async () => {
    const { form, button, uploads, requestSubmit } = await uploading()
    const onInvalid = vi.fn()
    field().addEventListener('vive:invalid', onInvalid)
    submitWith(form, button)

    uploads[0]?.reject(new Error('offline'))
    await settle()

    const notice = document.querySelector<HTMLElement>('.vive-notice')
    expect(requestSubmit).not.toHaveBeenCalled()
    expect(notice?.hidden).toBe(false)
    expect(notice?.classList.contains('vive-error')).toBe(true)
    expect(onInvalid.mock.calls[0]?.[0].detail).toEqual({ reason: 'upload' })
  })

  it('swallows repeated submits while waiting and sends only once', async () => {
    const { form, button, uploads, requestSubmit } = await uploading()
    submitWith(form, button)

    const again = submitWith(form, button)
    uploads[0]?.resolve('https://cdn.example.com/u/1.png')
    await settle()

    expect(again.defaultPrevented).toBe(true)
    expect(requestSubmit).toHaveBeenCalledTimes(1)
  })

  it('stops waiting when the editor is destroyed', async () => {
    const { form, button, uploads, handle, requestSubmit } = await uploading()
    submitWith(form, button)

    handle.destroy()
    uploads[0]?.resolve('https://cdn.example.com/u/1.png')
    await settle()

    expect(requestSubmit).not.toHaveBeenCalled()
    expect(document.querySelector('.vive-notice')).toBeNull()
  })
})

describe('required message', () => {
  it('shows a visible message tied to the editor when a required field is empty', async () => {
    render('<form><textarea name="body" required></textarea></form>')
    const form = document.querySelector('form') as HTMLFormElement
    await upgrade()

    submit(form)

    const message = document.querySelector<HTMLElement>('.vive-error')
    const surface = document.querySelector('.vive-content')
    expect(message?.hidden).toBe(false)
    expect(message?.textContent).toBe('This field is required.')
    expect(surface?.getAttribute('aria-describedby')).toBe(message?.id)
  })

  it('uses the message from data-required-message and hides it once filled', async () => {
    render(
      '<form><textarea name="body" required data-required-message="Makale boş olamaz."></textarea></form>',
    )
    const form = document.querySelector('form') as HTMLFormElement
    const { editor } = await upgrade()
    submit(form)

    editor.setContent('<p>dolu</p>')

    const message = document.querySelector<HTMLElement>('.vive-error')
    expect(message?.textContent).toBe('Makale boş olamaz.')
    expect(message?.hidden).toBe(true)
    expect(document.querySelector('.vive-content')?.hasAttribute('aria-describedby')).toBe(false)
  })

  it('adds no message element to optional fields', async () => {
    render('<form><textarea name="body"></textarea></form>')

    await upgrade()

    expect(document.querySelector('.vive-error')).toBeNull()
  })
})

describe('interface', () => {
  it('mounts the floating toolbar by default', async () => {
    render('<textarea></textarea>')

    const { ui } = await upgrade()

    expect(ui?.toolbar.getAttribute('role')).toBe('toolbar')
    expect(document.querySelector('.vive-editor.ve-root .ve-dock')).not.toBeNull()
  })

  it('leaves the bare editor when ui is false', async () => {
    render('<textarea></textarea>')

    const { ui } = await upgrade(field(), { ui: false })

    expect(ui).toBeNull()
    expect(document.querySelector('.ve-dock')).toBeNull()
  })

  it('offers the rich content tools and the HTML source view', async () => {
    render('<textarea></textarea>')

    const { ui } = await upgrade(field(), { ui: { locale: 'en' } })

    for (const id of ['table', 'image', 'embed', 'taskList', 'search', 'source']) {
      expect(ui?.toolbar.querySelector(`[data-tool="${id}"]`), id).not.toBeNull()
    }
  })

  it('keeps tables, checklists, code and players from the server HTML', async () => {
    const html = [
      '<table><tbody><tr><th><p>A</p></th></tr></tbody></table>',
      '<pre><code class="language-js">x</code></pre>',
      '<div data-embed="youtube" data-id="dQw4w9WgXcQ"></div>',
    ].join('')
    render(`<textarea>${html}</textarea>`)

    const { editor } = await upgrade()

    expect(editor.getHTML()).toContain('<th')
    expect(editor.getHTML()).toContain('language-js')
    expect(editor.getHTML()).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('labels checkboxes in Turkish when the interface is Turkish', async () => {
    render(
      '<textarea><ul data-type="taskList"><li data-checked="false"><p>iş</p></li></ul></textarea>',
    )

    await upgrade(field(), { ui: { locale: 'tr' } })

    expect(
      document.querySelector('.vive-content input[type="checkbox"]')?.getAttribute('aria-label'),
    ).toBe('Tamamlandı')
  })
})

describe('upgradeAll', () => {
  it('upgrades only textareas marked with data-editor', async () => {
    render(
      '<textarea data-editor></textarea><textarea data-editor="classic"></textarea><textarea></textarea>',
    )

    const result = await upgradeAll()
    handles.push(...result)

    expect(result).toHaveLength(2)
    expect(document.querySelectorAll('.vive-editor')).toHaveLength(2)
  })
})

describe('drop-in defaults', () => {
  const markdown = async () => ({ markdownToHtml: () => '', toMarkdown: () => '' })
  const fileItems = (): string[] =>
    [...document.querySelectorAll('[role="menu"][aria-label="Dosya"] button')].map(
      (button) => button.textContent ?? '',
    )

  afterEach(() => setDropInDefaults({}))

  it('gives every upgraded textarea the default file loaders', async () => {
    setDropInDefaults({ files: { markdown } })
    render('<textarea></textarea>')

    await upgrade(field(), { ui: { locale: 'tr' } })

    expect(fileItems()).toContain('Markdown olarak kaydet (.md)')
  })

  it('leaves the File menu out for data-files="false"', async () => {
    setDropInDefaults({ files: { markdown } })
    render('<textarea data-files="false"></textarea>')

    await upgrade(field(), { ui: { locale: 'tr' } })

    expect(document.querySelector('[data-tool="file"]')).toBeNull()
  })
})
