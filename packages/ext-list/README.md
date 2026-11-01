# @viveeditor/ext-list

Bullet and ordered list extensions for viveEditor.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/ext-list @viveeditor/core
```

## Usage

```ts
import { Editor } from '@viveeditor/core'
import '@viveeditor/core/style.css'
import { listExtensions } from '@viveeditor/ext-list'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [...listExtensions],
})
```

Enter continues a list, Tab and Shift+Tab change its level, and `- ` or `1. ` start one.

## License

MIT
