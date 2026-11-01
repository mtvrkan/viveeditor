# @viveeditor/ext-office-paste

Clean paste from Word, Google Docs and LibreOffice for viveEditor, with real nested lists.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/ext-office-paste @viveeditor/core
```

## Usage

```ts
import { Editor } from '@viveeditor/core'
import '@viveeditor/core/style.css'
import { OfficePaste } from '@viveeditor/ext-office-paste'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [
    OfficePaste.configure({ onDropped: ({ images }) => console.warn(`${images} images left out`) }),
  ],
})
```

Turns Word's fake bullets and numbers into real nested lists, keeps title and quote styles, and fixes Google Docs list nesting.

## License

MIT
