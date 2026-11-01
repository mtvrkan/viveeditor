# @viveeditor/ext-code-block

Code block extension for viveEditor, with optional lazy syntax highlighting.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/ext-code-block @viveeditor/core
```

## Usage

```ts
import { Editor } from '@viveeditor/core'
import '@viveeditor/core/style.css'
import { CodeBlock } from '@viveeditor/ext-code-block'
import { CodeHighlight, shikiHighlighter } from '@viveeditor/ext-code-block/highlight'
import '@viveeditor/ext-code-block/style.css'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [
    CodeBlock,
    CodeHighlight.configure({ highlighter: shikiHighlighter(() => import('shiki')) }),
  ],
})
```

Type three backticks to start a block. Syntax colouring is optional: `CodeHighlight` loads your highlighter only when the page has code, and colours never enter the saved HTML.

## License

MIT
