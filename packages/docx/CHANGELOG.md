# @viveeditor/docx

## 1.0.0-rc.0

### Minor Changes

- 9f59c19: Word export and import carry the new formatting: cell alignment, full-width and centred tables, row-only or no borders, border colour, striped rows, line height, font families (new `fontFamilies` import option), numbered list types and start numbers, bullet styles, links that open in a new tab and linked images.
  Images read from a Word file no longer bring an empty paragraph with them.
- 9f59c19: Font size can be set in points. `setFontSize` takes a point value from 6 to 96 in half points (the old size steps still work), `stepFontSize` moves through the usual sizes from 8 to 72 pt, and the new `fontSizePoints` query reads the current size. The toolbar gets a font size control that shows the current size and opens a panel where you can type a size, step it up or down, pick a common size or go back to the default. Word export and import keep point sizes. The five size items left the text style menu, so the `fontTiny`, `fontSmall`, `fontNormal`, `fontBig` and `fontHuge` message keys are gone.
- 96ea657: Image captions and positions, table cell colour and vertical alignment. `@viveeditor/ext-image` gives the image node `caption` and `align` (`'left' | 'center' | 'right'`, exported as `ImageAlign`), set through `setImageAttributes` and returned by `selectedImage`; an image with either is written as `<figure data-align><img><figcaption>`, one with neither stays a plain `<img>`. `@viveeditor/ext-table` gives cells `background` and `verticalAlign` with `setCellBackground`, `setCellVerticalAlign` and `query.cellStyle()`. `@viveeditor/core` now exports `normalizeColor` (still re-exported by `@viveeditor/ext-format`, whose highlight no longer picks up a cell background). The interface adds caption and position to the image panel and cell colour and vertical alignment to the table panel. `@viveeditor/sanitize` keeps `figure` with a checked `data-align`, `figcaption` and the two cell styles; its profile gains `imageAlign` and `verticalAlign`. Both sanitizers now also drop fully transparent `hsl()` and `hsla()` colours. `@viveeditor/docx` writes and reads cell shading and vertical alignment and writes captions as Caption paragraphs; `@viveeditor/markdown` writes a caption as an italic line under the image.
  
  `getJSON()` now writes `caption: null, align: null` on every image and `background: null, verticalAlign: null` on every table cell. Documents from 0.1.0 load unchanged and their HTML and Markdown output is identical, but code that compares `getJSON()` output with a stored object must allow the new attributes.
- 05a641f: Table rows get a height. Drag a row's bottom edge to set it (double-click the handle to reset), or use "Make row taller", "Make row shorter" and "Reset row height" in the table panel and the Row submenu of the context menu. New `setRowHeight` and `resizeRow` commands and a `rowHeight` query; the height is a minimum, saved as `<tr style="height: Npx">` (24 to 2000 px). Both sanitizers keep it within the new `maxRowHeight` limit, and Word files write and read it as an at-least row height.
- 96ea657: Writing tools. `@viveeditor/ext-format` adds `Subscript`, `Superscript`, `FontSize` (`FONT_SIZES`, `setFontSize`, `unsetFontSize`, `stepFontSize`), `Indent` (`indent`, `outdent`, `indentLevel`), `ChangeCase` (`changeCase`, `cycleCase`, language-aware) and `Typography` (smart quotes, dashes, ellipsis and symbols), all part of `formatExtensions`; `ClearFormatting` now also resets `indent`. `@viveeditor/core` exports `textInputRule`. The interface adds a "Text style" menu, indent items in the alignment menu and a lazy special characters panel. `@viveeditor/sanitize` keeps `<sub>`, plain `<sup>`, editor font sizes on `span` and indent on paragraphs and headings, and drops nested font sizes and nested superscript or subscript; its profile gains `fontSizes` and `indents`. `@viveeditor/docx` maps superscript and subscript to `w:vertAlign`.
  
  `getJSON()` now writes `indent: null` on every paragraph and heading. Documents from 0.1.0 load unchanged, but code that compares `getJSON()` output with a stored object must allow the new attribute.

### Patch Changes

- Updated dependencies [96ea657]
- Updated dependencies [96ea657]
- Updated dependencies [9f59c19]
- Updated dependencies [e8c82d0]
- Updated dependencies [96ea657]
- Updated dependencies [1a1a861]
- Updated dependencies [9f59c19]
- Updated dependencies [9f59c19]
- Updated dependencies [96ea657]
- Updated dependencies [96ea657]
- Updated dependencies [bd7fb9c]
- Updated dependencies [319b968]
- Updated dependencies [96ea657]
- Updated dependencies [96ea657]
- Updated dependencies [96ea657]
- Updated dependencies [96ea657]
- Updated dependencies [095b69b]
- Updated dependencies [96ea657]
  - @viveeditor/ext-format@1.0.0-rc.0
  - @viveeditor/core@1.0.0-rc.0
  - @viveeditor/ext-image@1.0.0-rc.0

## 0.1.0

### Minor Changes

- 7f36bb3: First public release of viveEditor: the one-script editor, the core engine and its extensions, the toolbar, React, Vue, Svelte, Angular and custom-element components, Markdown and Word conversion, and the Node sanitizer.

### Patch Changes

- Updated dependencies [7f36bb3]
  - @viveeditor/core@0.1.0
  - @viveeditor/ext-format@0.1.0
  - @viveeditor/ext-image@0.1.0
