# @viveeditor/ext-character-count

Character count and limit extension for viveEditor.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/ext-character-count @viveeditor/core
```

## Usage

```ts
import { Editor } from '@viveeditor/core'
import '@viveeditor/core/style.css'
import { CharacterCount } from '@viveeditor/ext-character-count'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [CharacterCount.configure({ limit: 280 })],
})
```

Typing stops at the limit, pasted text is trimmed to the space left, and deleting always works. Turkish letters and single emoji count as one character each; an emoji built from several code points, such as one with a skin tone or a family, counts each of them.

## License

MIT
