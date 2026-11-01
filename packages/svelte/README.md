# @viveeditor/svelte

Svelte 5 component and action for viveEditor with bind:value, toolbar and every feature included.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/svelte viveeditor
```

## Usage

```svelte
<script>
  import { ViveEditor } from '@viveeditor/svelte'
  import 'viveeditor/style.css'
  let html = $state('')
</script>

<ViveEditor bind:value={html} locale="tr" label="Article body" />
```

Svelte 5. The `use:viveEditor` action works on any element.

## License

MIT
