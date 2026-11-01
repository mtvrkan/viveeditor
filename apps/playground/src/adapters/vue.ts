import { ViveEditor } from '@viveeditor/vue'
import { createApp, defineComponent, h, ref, watchEffect } from 'vue'
import { LABEL, pageParts, SAMPLE_VALUE, START_VALUE } from './page.js'

const { host, output, sample } = pageParts()

const App = defineComponent(() => {
  const value = ref(START_VALUE)
  watchEffect(() => {
    output.textContent = value.value
  })
  sample.addEventListener('click', () => {
    value.value = SAMPLE_VALUE
  })
  return () =>
    h(ViveEditor, {
      modelValue: value.value,
      'onUpdate:modelValue': (html: string) => {
        value.value = html
      },
      locale: 'tr',
      label: LABEL,
    })
})

createApp(App).mount(host)
