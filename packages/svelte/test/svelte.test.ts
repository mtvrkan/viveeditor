import { cleanup, fireEvent, render, screen } from '@testing-library/svelte'
import { flushSync } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from 'viveeditor'
import { ViveEditor, viveEditor } from '../src/index.js'
import Bound from './Bound.svelte'

async function readyEditor(onReady: ReturnType<typeof vi.fn<(editor: Editor) => void>>) {
  await vi.waitFor(() => expect(onReady).toHaveBeenCalled())
  const editor = onReady.mock.calls[0]?.[0]
  if (!editor) throw new Error('Missing editor')
  return editor
}

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

describe('ViveEditor for Svelte', () => {
  it('mounts with the toolbar and the first value', async () => {
    const onready = vi.fn<(editor: Editor) => void>()
    const { container } = render(ViveEditor, { value: '<p>Merhaba</p>', locale: 'tr', onready })
    await readyEditor(onready)

    const contents = container.querySelectorAll('.vive-content')

    expect(contents).toHaveLength(1)
    expect(container.querySelector('[role="toolbar"]')).not.toBeNull()
    expect(contents[0]?.innerHTML).toContain('Merhaba')
  })

  it('keeps bind:value in step in both directions', async () => {
    const onready = vi.fn<(editor: Editor) => void>()
    const { container } = render(Bound, { onready })
    const editor = await readyEditor(onready)

    editor.setContent('<p>b</p>')
    flushSync()
    const typed = screen.getByTestId('value').textContent
    await fireEvent.click(screen.getByRole('button', { name: 'set' }))

    expect(typed).toBe('<p>b</p>')
    expect(container.querySelector('.vive-content')?.innerHTML).toBe('<p>dışarıdan</p>')
  })

  it('stops editing when editable turns false', async () => {
    const onready = vi.fn<(editor: Editor) => void>()
    const { rerender } = render(ViveEditor, { onready })
    const editor = await readyEditor(onready)

    await rerender({ editable: false })

    expect(editor.isEditable).toBe(false)
  })

  it('destroys the editor when the component unmounts', async () => {
    const onready = vi.fn<(editor: Editor) => void>()
    const { unmount } = render(ViveEditor, { onready })
    const editor = await readyEditor(onready)

    unmount()

    expect(editor.isDestroyed).toBe(true)
    expect(document.querySelector('.vive-content')).toBeNull()
  })

  it('works as an action on any element', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const onReady = vi.fn<(editor: Editor) => void>()
    const action = viveEditor(host, { value: '<p>x</p>', ui: false, onReady })
    const editor = await readyEditor(onReady)

    action.update({ value: '<p>y</p>', editable: false })

    expect(host.querySelector('.vive-content')?.innerHTML).toBe('<p>y</p>')
    expect(editor.isEditable).toBe(false)
    expect(host.querySelector('[role="toolbar"]')).toBeNull()
    action.destroy()
    expect(editor.isDestroyed).toBe(true)
  })
})
