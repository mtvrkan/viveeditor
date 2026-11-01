# @viveeditor/vue

Vue 3 component for viveEditor with v-model, toolbar and every feature included.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/vue viveeditor
```

## Usage

```vue
<script setup>
import { ref } from 'vue'
import { ViveEditor } from '@viveeditor/vue'
import 'viveeditor/style.css'

const html = ref('')
</script>

<template>
  <ViveEditor v-model="html" locale="tr" label="Article body" />
</template>
```

Vue 3.5. `useViveEditor` gives you the editor instance for your own markup.

## License

MIT
