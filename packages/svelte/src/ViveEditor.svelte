<script lang="ts">
import type { Editor } from 'viveeditor'
import { type ViveEditorOptions, viveEditor } from './action.js'

interface Props
  extends Pick<ViveEditorOptions, 'extensions' | 'ui' | 'locale' | 'label' | 'editable'> {
  value?: string
  editor?: Editor | null
  id?: string
  class?: string
  onchange?: (html: string, editor: Editor) => void
  onready?: (editor: Editor) => void
  onfocus?: (editor: Editor) => void
  onblur?: (editor: Editor) => void
  onerror?: (error: unknown) => void
}

let {
  value = $bindable(''),
  editor = $bindable(null),
  id,
  class: className,
  onchange,
  onready,
  onfocus,
  onblur,
  onerror,
  ...options
}: Props = $props()
</script>

<div
  {id}
  class={className}
  use:viveEditor={{
    ...options,
    value,
    onChange: (html, current) => {
      value = html
      onchange?.(html, current)
    },
    onReady: (current) => {
      editor = current
      onready?.(current)
    },
    onFocus: (current) => onfocus?.(current),
    onBlur: (current) => onblur?.(current),
    onError: (error) => onerror?.(error),
  }}
></div>
