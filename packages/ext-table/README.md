# @viveeditor/ext-table

Table extension for viveEditor: merged cells, column widths, keyboard navigation.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/ext-table @viveeditor/core
```

## Usage

```ts
import { Editor } from '@viveeditor/core'
import '@viveeditor/core/style.css'
import { Table } from '@viveeditor/ext-table'
import '@viveeditor/ext-table/style.css'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [Table],
})

editor.commands.insertTable({ rows: 3, cols: 3, headerRow: true })
```

Merged cells, header rows, column widths by dragging, and Tab to the next cell. Saved HTML keeps column widths on any site.

## License

MIT
