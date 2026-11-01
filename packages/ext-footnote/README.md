# @viveeditor/ext-footnote

Footnotes for viveEditor: inline notes edited in place and numbered on the published page.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/ext-footnote @viveeditor/core
```

## Usage

```ts
import { Editor } from '@viveeditor/core'
import '@viveeditor/core/style.css'
import { Footnote } from '@viveeditor/ext-footnote'
import '@viveeditor/ext-footnote/style.css'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [Footnote],
})
```

Notes are edited in place and keep bold, italic and links only. On published pages, `renderFootnotes(root)` from `@viveeditor/ext-footnote/render` numbers them and lists them at the end.

## License

MIT
