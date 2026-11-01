# @viveeditor/core

Core engine of viveEditor, an open-source rich text editor.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/core
```

## Usage

```ts
import { Editor } from '@viveeditor/core'
import '@viveeditor/core/style.css'
import { basicExtensions } from '@viveeditor/ext-basic'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: basicExtensions,
  content: '<p>Hello <strong>world</strong></p>',
  label: 'Article body',
})

editor.on('change', () => console.log(editor.getHTML()))
```

The core holds the document schema, the extension system (`defineExtension`), commands (`editor.commands`, `editor.can`, `editor.isActive`), HTML and JSON input and output, and paste cleaning. It has no toolbar; add `@viveeditor/ui` for one, or use the `viveeditor` package for everything at once.

## License

MIT
