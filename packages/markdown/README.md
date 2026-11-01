# @viveeditor/markdown

Markdown import and export for viveEditor, plus Markdown-aware paste.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/markdown @viveeditor/core
```

## Usage

```ts
import { markdownToHtml, toMarkdown } from '@viveeditor/markdown'
import { MarkdownPaste } from '@viveeditor/markdown/paste'

editor.commands.replaceContent(markdownToHtml('# Title\n\nSome **bold** text'))
const markdown = toMarkdown(editor)

const extensions = [MarkdownPaste.configure({ load: () => import('@viveeditor/markdown') })]
```

Headings, emphasis, links, images, lists, checklists, quotes, fenced code and tables are read and written. Raw HTML inside Markdown is never let through. See [Markdown](https://github.com/mtvrkan/viveeditor#markdown).

## License

MIT
