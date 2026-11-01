# @viveeditor/ext-format

Text alignment, text colour and highlight extensions for viveEditor.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/ext-format @viveeditor/core
```

## Usage

```ts
import { Editor } from '@viveeditor/core'
import '@viveeditor/core/style.css'
import { formatExtensions } from '@viveeditor/ext-format'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [...formatExtensions],
})
```

Alignment uses Ctrl/⌘+Shift+L, E, R and J. Colours are checked on paste and on output, so a `style` attribute never carries anything but a colour.

## License

MIT
