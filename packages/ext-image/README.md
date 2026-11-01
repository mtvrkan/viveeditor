# @viveeditor/ext-image

Image extension for viveEditor with validated sources, safe uploads and alt-text checks.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/ext-image @viveeditor/core
```

## Usage

```ts
import { Editor } from '@viveeditor/core'
import '@viveeditor/core/style.css'
import { Image } from '@viveeditor/ext-image'
import '@viveeditor/ext-image/style.css'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [Image.configure({ upload })],
})
```

`upload(file, { signal, onProgress })` returns `{ src, width, height }`. Addresses and file bytes are checked before they reach the document; your server must still re-validate uploads. See [Images and uploads](https://github.com/mtvrkan/viveeditor#images-and-uploads).

## License

MIT
