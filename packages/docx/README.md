# @viveeditor/docx

Word (.docx) import and export for viveEditor, with limits for untrusted files.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/docx @viveeditor/core
```

## Usage

```ts
import { exportDocx, importDocx } from '@viveeditor/docx'

const { html, warnings } = await importDocx(file, { upload })
editor.commands.replaceContent(html)

const blob = await exportDocx(editor, { title: 'Report' })
```

Files over 20 MB, password-protected files and files that unpack too large or too deep are refused with a `DocxError`. See [Word (.docx)](https://github.com/mtvrkan/viveeditor#word-docx) for what is kept.

## License

MIT
