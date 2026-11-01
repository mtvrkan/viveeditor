import { basicExtensions } from '@viveeditor/ext-basic'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type EditorMount, MountDestroyedError, mountEditor } from '../src/index.js'

let mounts: EditorMount[] = []

function host(): HTMLElement {
  const element = document.createElement('div')
  document.body.append(element)
  return element
}

function mount(options: Parameters<typeof mountEditor>[1] = {}): EditorMount {
  const result = mountEditor(host(), options)
  mounts.push(result)
  return result
}

afterEach(() => {
  for (const result of mounts) result.destroy()
  mounts = []
  document.body.innerHTML = ''
})

describe('mountEditor', () => {
  it('creates the editor with the classic preset and the toolbar', async () => {
    const onReady = vi.fn()
    const result = mount({ value: '<p><b>kalın</b></p>', locale: 'tr', onReady })

    const editor = await result.ready

    expect(result.getValue()).toBe('<p><strong>kalın</strong></p>')
    expect(onReady).toHaveBeenCalledWith(editor)
    expect(document.querySelector('[role="toolbar"][aria-label="Biçimlendirme"]')).not.toBeNull()
    expect(editor.schema.nodes.table).toBeDefined()
  })

  it('reports changes as HTML and an empty document as an empty string', async () => {
    const onChange = vi.fn()
    const result = mount({ value: '<p>a</p>', onChange })
    const editor = await result.ready

    editor.setContent('<p>b</p>')
    editor.setContent('')

    expect(onChange.mock.calls.map(([html]) => html)).toEqual(['<p>b</p>', ''])
  })

  it('does not echo values it is given and skips values it already shows', async () => {
    const onChange = vi.fn()
    const result = mount({ value: '<p>a</p>', onChange })
    const editor = await result.ready
    const setContent = vi.spyOn(editor, 'setContent')

    result.setValue('<p>b</p>')
    result.setValue('<p>b</p>')
    result.setValue('<b>c</b>')
    result.setValue('<b>c</b>')

    expect(result.getValue()).toBe('<p><strong>c</strong></p>')
    expect(setContent).toHaveBeenCalledTimes(2)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps a value and editable state set before the editor is ready', async () => {
    const result = mount({ value: '<p>a</p>' })

    result.setValue('<p>sonra</p>')
    result.setEditable(false)
    const editor = await result.ready

    expect(result.getValue()).toBe('<p>sonra</p>')
    expect(editor.isEditable).toBe(false)
  })

  it('destroys an editor that becomes ready after the mount was destroyed', async () => {
    const onReady = vi.fn()
    const target = host()
    const result = mountEditor(target, { onReady })

    result.destroy()
    const error = await result.ready.catch((reason: unknown) => reason)

    expect(error).toBeInstanceOf(MountDestroyedError)
    expect(onReady).not.toHaveBeenCalled()
    expect(target.innerHTML).toBe('')
  })

  it('uses the given extensions without a toolbar when ui is false', async () => {
    const result = mount({ extensions: basicExtensions, ui: false })

    const editor = await result.ready

    expect(editor.schema.nodes.table).toBeUndefined()
    expect(document.querySelector('[role="toolbar"]')).toBeNull()
  })
})
