# @viveeditor/ext-search

Find and replace extension for viveEditor with Turkish-aware matching.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/ext-search @viveeditor/core
```

## Usage

```ts
import { Editor } from '@viveeditor/core'
import '@viveeditor/core/style.css'
import { Search } from '@viveeditor/ext-search'
import '@viveeditor/ext-search/style.css'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [Search],
})
```

Find and replace that matches Turkish capitals correctly: `istanbul` finds `İstanbul` and `ISTANBUL`. The panel comes from `@viveeditor/ui` (Ctrl/⌘+F).

## License

MIT
