import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from 'viveeditor'
import { defineComponent, h, nextTick, ref } from 'vue'
import { ViveEditor, type ViveEditorProps } from '../src/index.js'

const mounted: { unmount(): void }[] = []

async function mountEditor(props: ViveEditorProps) {
  const onReady = vi.fn<(editor: Editor) => void>()
  const wrapper = mount(ViveEditor, { props: { ...props, onReady }, attachTo: document.body })
  mounted.push(wrapper)
  await vi.waitFor(() => expect(onReady).toHaveBeenCalled())
  const editor = onReady.mock.calls[0]?.[0]
  if (!editor) throw new Error('Missing editor')
  return { wrapper, editor }
}

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount()
})

describe('ViveEditor for Vue', () => {
  it('mounts with the toolbar and the first value', async () => {
    const { wrapper } = await mountEditor({ modelValue: '<p>Merhaba</p>', locale: 'tr' })

    const content = wrapper.find('.vive-content')

    expect(wrapper.findAll('.vive-content')).toHaveLength(1)
    expect(wrapper.find('[role="toolbar"]').exists()).toBe(true)
    expect(content.html()).toContain('Merhaba')
  })

  it('updates v-model when the text changes', async () => {
    const text = ref('<p>a</p>')
    const Parent = defineComponent(
      () => () =>
        h(ViveEditor, {
          modelValue: text.value,
          'onUpdate:modelValue': (html: string) => {
            text.value = html
          },
        }),
    )
    const wrapper = mount(Parent, { attachTo: document.body })
    mounted.push(wrapper)
    await vi.waitFor(() => expect(wrapper.find('.vive-content').exists()).toBe(true))
    const { vm } = wrapper.findComponent(ViveEditor)
    const editor = (vm as unknown as { editor: Editor | null }).editor

    editor?.setContent('<p>b</p>')

    expect(text.value).toBe('<p>b</p>')
  })

  it('follows a new model value without emitting it back', async () => {
    const { wrapper } = await mountEditor({ modelValue: '<p>a</p>' })

    await wrapper.setProps({ modelValue: '<p>yeni</p>' })

    expect(wrapper.find('.vive-content').element.innerHTML).toBe('<p>yeni</p>')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('stops editing when editable turns false', async () => {
    const { wrapper, editor } = await mountEditor({})

    await wrapper.setProps({ editable: false })
    await nextTick()

    expect(editor.isEditable).toBe(false)
  })

  it('destroys the editor when it unmounts', async () => {
    const { wrapper, editor } = await mountEditor({})

    wrapper.unmount()
    mounted.length = 0

    expect(editor.isDestroyed).toBe(true)
    expect(document.querySelector('.vive-content')).toBeNull()
  })
})
