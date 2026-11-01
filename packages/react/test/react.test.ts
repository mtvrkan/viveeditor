import { act, cleanup, render, waitFor } from '@testing-library/react'
import { createElement, StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ViveEditor, type ViveEditorProps } from '../src/index.js'

const editorCount = (container: HTMLElement): number =>
  container.querySelectorAll('.vive-content').length

function renderEditor(props: ViveEditorProps) {
  const onReady = vi.fn(props.onReady)
  const view = render(
    createElement(StrictMode, null, createElement(ViveEditor, { ...props, onReady })),
  )
  return { ...view, onReady }
}

afterEach(() => {
  cleanup()
})

describe('ViveEditor for React', () => {
  it('mounts one editor with the toolbar even in StrictMode', async () => {
    const { container, onReady } = renderEditor({ defaultValue: '<p>Merhaba</p>', locale: 'tr' })

    await waitFor(() => expect(onReady).toHaveBeenCalled())

    expect(editorCount(container)).toBe(1)
    expect(container.querySelector('[role="toolbar"]')).not.toBeNull()
    expect(container.querySelector('.vive-content')?.innerHTML).toContain('Merhaba')
  })

  it('reports changes through onChange', async () => {
    const onChange = vi.fn()
    const { onReady } = renderEditor({ value: '<p>a</p>', onChange })
    await waitFor(() => expect(onReady).toHaveBeenCalled())
    const editor = onReady.mock.calls.at(-1)?.[0]

    act(() => editor?.setContent('<p>b</p>'))

    expect(onChange).toHaveBeenLastCalledWith('<p>b</p>', editor)
  })

  it('follows a new value from the parent without echoing it back', async () => {
    const onChange = vi.fn()
    const { onReady, rerender, container } = renderEditor({ value: '<p>a</p>', onChange })
    await waitFor(() => expect(onReady).toHaveBeenCalled())

    rerender(
      createElement(
        StrictMode,
        null,
        createElement(ViveEditor, { value: '<p>yeni</p>', onChange }),
      ),
    )

    expect(container.querySelector('.vive-content')?.innerHTML).toBe('<p>yeni</p>')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('removes the editor when it unmounts', async () => {
    const { onReady, unmount, container } = renderEditor({})
    await waitFor(() => expect(onReady).toHaveBeenCalled())
    const editor = onReady.mock.calls.at(-1)?.[0]

    unmount()

    expect(editor?.isDestroyed).toBe(true)
    expect(editorCount(container)).toBe(0)
  })
})
