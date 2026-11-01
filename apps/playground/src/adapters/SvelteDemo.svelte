<script lang="ts">
import { ViveEditor } from '@viveeditor/svelte'
import { LABEL, SAMPLE_VALUE, START_VALUE } from './page.js'

let { output, sample }: { output: HTMLElement; sample: HTMLButtonElement } = $props()
let value = $state(START_VALUE)

$effect(() => {
  output.textContent = value
})

$effect(() => {
  const load = () => {
    value = SAMPLE_VALUE
  }
  sample.addEventListener('click', load)
  return () => sample.removeEventListener('click', load)
})
</script>

<ViveEditor bind:value locale="tr" label={LABEL} />
