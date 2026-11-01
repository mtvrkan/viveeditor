# Tables

> Tables with merged cells, header rows, column widths you can drag, and the table tools in the toolbar.

URL: https://editor.vivepdf.com/en/docs/tables/
Last updated: 2026-11-01

`@viveeditor/ext-table` adds tables to the editor: merged cells, header rows, column widths set by dragging, and `Tab` to move between cells. The saved HTML carries the column widths, so a table looks the same on any site. This page covers setup, the table tools and keyboard use.

## Setup

```ts
import { Editor } from '@viveeditor/core'
import { Table } from '@viveeditor/ext-table'
import '@viveeditor/ext-table/style.css'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [Table],
})

editor.commands.insertTable({ rows: 3, cols: 3, headerRow: true })
```

The one-script build already includes the table extension.

| Option | Default | Description |
| --- | --- | --- |
| `resizable` | `true` | Lets writers drag a column edge to set its width. |
| `cellMinWidth` | `48` | The smallest column width, in pixels. |
| `maxSize` | `20` | The most rows and columns `insertTable` can add. |

## Insert a table

- The table button in the toolbar opens a 6×6 grid. Choose the size with the mouse or the arrow keys, then click or press `Enter`. The table gets a header row.
- The "Table" entry in the `/` menu inserts a 3×3 table with a header row (`/table`).
- In code, use `insertTable({ rows, cols, headerRow })`. Without values the table is 3×3 and starts with a header row.

A table inserted in an empty paragraph replaces that paragraph. You cannot insert a table inside another table.

## Table tools

While the cursor is inside a table, the table button in the toolbar opens the table tools instead of the grid:

| Group | Tools |
| --- | --- |
| Insert | Insert row above, Insert row below, Insert column left, Insert column right |
| Arrange | Merge cells, Split cell, Header row, Widen column, Narrow column |
| Delete | Delete row, Delete column, Delete table |

Tools that cannot run at that moment are shown as disabled. For example, "Merge cells" is not available while a single cell is selected. `Esc` closes the panel.

## Merged cells

Drag with the mouse to select several cells, then choose "Merge cells". To undo a merge, click inside the merged cell and choose "Split cell". Merged cells are kept when you save as Word.

## Header row and column

"Header row" turns the first row into header cells, or back. Header cells are written as `th` in the HTML, so screen readers can announce the column headings. The interface has no button for a header column; use the `editor.commands.toggleHeaderColumn()` command.

## Column widths

With `resizable` on, drag the right edge of a column to change its width. From the keyboard, "Widen column" and "Narrow column" in the table tools change the column at the cursor by 40 pixels. A column cannot be narrower than `cellMinWidth`.

A table with set widths carries a `colgroup` and a `width` style per column in the saved HTML. The table itself gets the total width; if some columns have no width, that total is used as a minimum width. Tables without any set width carry no style.

## Keyboard

- `Tab` moves to the next cell. In the last cell it adds a new row.
- `Shift+Tab` moves to the previous cell.
- `Esc` and then `Tab` moves focus out of the table and the editor.

## Commands

| Command | What it does |
| --- | --- |
| `insertTable(options)` | Inserts a table. |
| `addRowBefore()`, `addRowAfter()` | Adds a row. |
| `addColumnBefore()`, `addColumnAfter()` | Adds a column. |
| `deleteRow()`, `deleteColumn()`, `deleteTable()` | Deletes the row, column or table. |
| `mergeCells()`, `splitCell()` | Merges or splits cells. |
| `toggleHeaderRow()`, `toggleHeaderColumn()` | Turns the header row or column on or off. |
| `resizeColumn(delta)` | Widens or narrows the column at the cursor, in pixels. |

`editor.query.inTable()` returns `true` while the cursor is inside a table. To test a command first, use the `can` form, such as `editor.can.mergeCells()`.

Tables are also saved to Markdown and Word files; see [Open, save and print](https://editor.vivepdf.com/en/docs/open-save-print/).

## Do column widths survive on the published page?

Yes. Widths are written into the saved HTML as a colgroup and styles, so the table looks the same on any site. The server sanitizer keeps table widths.

## Can I put a table inside a table?

No. While the cursor is inside a table, the insert command does nothing; the toolbar's table button opens the table tools instead.

## How do I leave a table with the keyboard?

Press Esc and then Tab. Tab alone moves between cells, so this order moves focus to the next element after the editor.
