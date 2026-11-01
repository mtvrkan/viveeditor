# @viveeditor/ext-basic

Basic formatting extensions for viveEditor: marks, headings, quotes, rules, links.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/ext-basic @viveeditor/core
```

## Usage

```ts
import { Editor } from '@viveeditor/core'
import '@viveeditor/core/style.css'
import { basicExtensions } from '@viveeditor/ext-basic'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [...basicExtensions],
})
```

Bold, italic, underline, strikethrough, inline code, links (only allowed protocols), headings, quotes, horizontal rules and line breaks, with Markdown shortcuts such as `**bold**` and `## `. Each extension is also exported on its own (`Bold`, `Link`, …).

## License

MIT
