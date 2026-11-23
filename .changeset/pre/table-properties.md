---
"@viveeditor/ext-table": minor
---

Tables get richer properties. Cells take a horizontal alignment (`setCellTextAlign`) next to the background and vertical alignment, and every cell command now changes all selected cells. Tables take full width, centring, borders (all, rows only or none), striped rows and a border colour (`setTableWidth`, `setTableAlign`, `setTableBorder`, `setTableStriped`, `setTableBorderColor`, read with the `tableStyle` query). New `selectRow`, `selectColumn`, `selectTable` and `distributeColumns` commands. The `cellStyle` query also returns `textAlign`.
