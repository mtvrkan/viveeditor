# @viveeditor/ext-table

## 1.0.0-rc.0

### Minor Changes

- 96ea657: Image captions and positions, table cell colour and vertical alignment. `@viveeditor/ext-image` gives the image node `caption` and `align` (`'left' | 'center' | 'right'`, exported as `ImageAlign`), set through `setImageAttributes` and returned by `selectedImage`; an image with either is written as `<figure data-align><img><figcaption>`, one with neither stays a plain `<img>`. `@viveeditor/ext-table` gives cells `background` and `verticalAlign` with `setCellBackground`, `setCellVerticalAlign` and `query.cellStyle()`. `@viveeditor/core` now exports `normalizeColor` (still re-exported by `@viveeditor/ext-format`, whose highlight no longer picks up a cell background). The interface adds caption and position to the image panel and cell colour and vertical alignment to the table panel. `@viveeditor/sanitize` keeps `figure` with a checked `data-align`, `figcaption` and the two cell styles; its profile gains `imageAlign` and `verticalAlign`. Both sanitizers now also drop fully transparent `hsl()` and `hsla()` colours. `@viveeditor/docx` writes and reads cell shading and vertical alignment and writes captions as Caption paragraphs; `@viveeditor/markdown` writes a caption as an italic line under the image.
  
  `getJSON()` now writes `caption: null, align: null` on every image and `background: null, verticalAlign: null` on every table cell. Documents from 0.1.0 load unchanged and their HTML and Markdown output is identical, but code that compares `getJSON()` output with a stored object must allow the new attributes.
- 9f59c19: Tables get richer properties. Cells take a horizontal alignment (`setCellTextAlign`) next to the background and vertical alignment, and every cell command now changes all selected cells. Tables take full width, centring, borders (all, rows only or none), striped rows and a border colour (`setTableWidth`, `setTableAlign`, `setTableBorder`, `setTableStriped`, `setTableBorderColor`, read with the `tableStyle` query). New `selectRow`, `selectColumn`, `selectTable` and `distributeColumns` commands. The `cellStyle` query also returns `textAlign`.
- 05a641f: Table rows get a height. Drag a row's bottom edge to set it (double-click the handle to reset), or use "Make row taller", "Make row shorter" and "Reset row height" in the table panel and the Row submenu of the context menu. New `setRowHeight` and `resizeRow` commands and a `rowHeight` query; the height is a minimum, saved as `<tr style="height: Npx">` (24 to 2000 px). Both sanitizers keep it within the new `maxRowHeight` limit, and Word files write and read it as an at-least row height.
- bd7fb9c: On touch screens, tapping a table cell shows grips on its right and bottom edges; dragging them with a finger or pen sets the column width and the row height in one undoable step. Mice keep the hover handles, the grips stay hidden while typing or scrolling, in read-only mode and with `resizable: false`, and page scrolling outside the grips is unchanged.

### Patch Changes

- 05a641f: Table rows no longer grow when the pointer reaches a column border: the resize handle no longer brings back the bottom margin of the last paragraph in the cell.
- Updated dependencies [9f59c19]
- Updated dependencies [e8c82d0]
- Updated dependencies [96ea657]
- Updated dependencies [1a1a861]
- Updated dependencies [96ea657]
- Updated dependencies [96ea657]
- Updated dependencies [319b968]
- Updated dependencies [96ea657]
- Updated dependencies [96ea657]
- Updated dependencies [96ea657]
- Updated dependencies [095b69b]
- Updated dependencies [96ea657]
  - @viveeditor/core@1.0.0-rc.0

## 0.1.0

### Minor Changes

- 7f36bb3: First public release of viveEditor: the one-script editor, the core engine and its extensions, the toolbar, React, Vue, Svelte, Angular and custom-element components, Markdown and Word conversion, and the Node sanitizer.

### Patch Changes

- Updated dependencies [7f36bb3]
  - @viveeditor/core@0.1.0
