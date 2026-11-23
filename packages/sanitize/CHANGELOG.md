# @viveeditor/sanitize

## 1.0.0-rc.0

### Minor Changes

- 96ea657: Image captions and positions, table cell colour and vertical alignment. `@viveeditor/ext-image` gives the image node `caption` and `align` (`'left' | 'center' | 'right'`, exported as `ImageAlign`), set through `setImageAttributes` and returned by `selectedImage`; an image with either is written as `<figure data-align><img><figcaption>`, one with neither stays a plain `<img>`. `@viveeditor/ext-table` gives cells `background` and `verticalAlign` with `setCellBackground`, `setCellVerticalAlign` and `query.cellStyle()`. `@viveeditor/core` now exports `normalizeColor` (still re-exported by `@viveeditor/ext-format`, whose highlight no longer picks up a cell background). The interface adds caption and position to the image panel and cell colour and vertical alignment to the table panel. `@viveeditor/sanitize` keeps `figure` with a checked `data-align`, `figcaption` and the two cell styles; its profile gains `imageAlign` and `verticalAlign`. Both sanitizers now also drop fully transparent `hsl()` and `hsla()` colours. `@viveeditor/docx` writes and reads cell shading and vertical alignment and writes captions as Caption paragraphs; `@viveeditor/markdown` writes a caption as an italic line under the image.
  
  `getJSON()` now writes `caption: null, align: null` on every image and `background: null, verticalAlign: null` on every table cell. Documents from 0.1.0 load unchanged and their HTML and Markdown output is identical, but code that compares `getJSON()` output with a stored object must allow the new attributes.
- 9f59c19: The sanitizer keeps the new 1.0 formatting in one canonical form, with the same rules in the PHP sanitizer: font sizes from 6 to 96 pt in half points, line height (1, 1.15, 1.5, 2), font families from a list (new `fontFamilies` option, 8 common families by default; a malformed entry throws a `TypeError`), horizontal alignment in table cells, table width, alignment, borders, border colour and striped rows, numbered list types (`a`, `A`, `i`, `I`) and bullet styles (disc, circle, square).
- 9509e79: `sanitizeHtml` refuses HTML with more than `maxTags` opening tags (100 000 by default, set it with the new `maxTags` option) and HTML that contains a `<template>` tag, both with `TOO_COMPLEX`. The number of elements a parse may create is now capped by `maxTags` as well.
- 05a641f: Table rows get a height. Drag a row's bottom edge to set it (double-click the handle to reset), or use "Make row taller", "Make row shorter" and "Reset row height" in the table panel and the Row submenu of the context menu. New `setRowHeight` and `resizeRow` commands and a `rowHeight` query; the height is a minimum, saved as `<tr style="height: Npx">` (24 to 2000 px). Both sanitizers keep it within the new `maxRowHeight` limit, and Word files write and read it as an at-least row height.
- 96ea657: Writing tools. `@viveeditor/ext-format` adds `Subscript`, `Superscript`, `FontSize` (`FONT_SIZES`, `setFontSize`, `unsetFontSize`, `stepFontSize`), `Indent` (`indent`, `outdent`, `indentLevel`), `ChangeCase` (`changeCase`, `cycleCase`, language-aware) and `Typography` (smart quotes, dashes, ellipsis and symbols), all part of `formatExtensions`; `ClearFormatting` now also resets `indent`. `@viveeditor/core` exports `textInputRule`. The interface adds a "Text style" menu, indent items in the alignment menu and a lazy special characters panel. `@viveeditor/sanitize` keeps `<sub>`, plain `<sup>`, editor font sizes on `span` and indent on paragraphs and headings, and drops nested font sizes and nested superscript or subscript; its profile gains `fontSizes` and `indents`. `@viveeditor/docx` maps superscript and subscript to `w:vertAlign`.
  
  `getJSON()` now writes `indent: null` on every paragraph and heading. Documents from 0.1.0 load unchanged, but code that compares `getJSON()` output with a stored object must allow the new attribute.

### Patch Changes

- 1a1a861: `getHTML()` writes font families exactly as the font list has them in every browser, so the saved HTML matches the sanitizer's output. A font whose first name is the first name of a list entry now maps to that entry, so fonts pasted from Word or Google Docs (`"Times New Roman",serif`, `Arial`) are kept; the Node and PHP sanitizers follow the same rule. Word's 100%, 115%, 150% and 200% line heights are read as 1, 1.15, 1.5 and 2. The font size and font family queries return `null` for a mixed selection.

## 0.1.0

### Minor Changes

- 7f36bb3: First public release of viveEditor: the one-script editor, the core engine and its extensions, the toolbar, React, Vue, Svelte, Angular and custom-element components, Markdown and Word conversion, and the Node sanitizer.
