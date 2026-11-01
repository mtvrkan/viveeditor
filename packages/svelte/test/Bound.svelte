<script lang="ts">
import type { Editor } from 'viveeditor'
import ViveEditor from '../src/ViveEditor.svelte'

let { onready }: { onready: (editor: Editor) => void } = $props()
let value = $state('<p>a</p>')
</script>

<ViveEditor bind:value {onready} />
<output data-testid="value">{value}</output>
<button type="button" onclick={() => (value = '<p>dışarıdan</p>')}>set</button>
