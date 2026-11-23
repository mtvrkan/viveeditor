# @viveeditor/ext-format

## 1.0.0-rc.0

### Minor Changes

- 96ea657: New `CleanDocument` extension (part of `formatExtensions`) with the `cleanDocument` command and the `documentCleanup` query: it removes spaces at paragraph edges, repeated spaces, line breaks at paragraph ends and extra empty paragraphs in one transaction, never touching code blocks, and reports `{ extraSpaces, trailingBreaks, emptyParagraphs }`. The File menu gets "Tidy up document", which shows the counts in a notice.
- 96ea657: New `ClearFormatting` extension (part of `formatExtensions`) with the `clearFormatting` command and Ctrl/⌘+\: removes every mark except those in `keepMarks` (default `['link']`) from the selection and resets `blockAttributes` (default `['textAlign']`) on the selected text blocks; with a collapsed cursor it clears the stored marks. The toolbar and the selection bubble get a "Clear formatting" button.
- 9f59c19: Font size can be set in points. `setFontSize` takes a point value from 6 to 96 in half points (the old size steps still work), `stepFontSize` moves through the usual sizes from 8 to 72 pt, and the new `fontSizePoints` query reads the current size. The toolbar gets a font size control that shows the current size and opens a panel where you can type a size, step it up or down, pick a common size or go back to the default. Word export and import keep point sizes. The five size items left the text style menu, so the `fontTiny`, `fontSmall`, `fontNormal`, `fontBig` and `fontHuge` message keys are gone.
- 9f59c19: More formatting for 1.0. `LineHeight` sets the line height of paragraphs and headings (1, 1.15, 1.5, 2). `FontFamily` applies a font family from a list the host can replace (`fontFamilies` option, 8 common families by default). Numbered lists take a type (`1`, `a`, `A`, `i`, `I`) and a start number, bullet lists a style (disc, circle, square), read back with the `listStyle` query. Links can open in a new tab (`setLink({ href, newTab })`, `link` query). Images can carry a link (`setImageLink`). Code blocks get a Copy button (`copyLabel`, `copiedLabel` options). Fixes `setLink` linking the whole paragraph when the cursor was already inside a link.
- 96ea657: New `FormatPainter` extension (part of `formatExtensions`) with `copyFormat`, `applyFormat`, `cancelFormat` and the `isPaintingFormat` query: copied marks are applied to the next mouse selection, or to a Shift-arrow selection when Shift is released, and Escape cancels; links in the target stay. The toolbar gets a "Format painter" button, `ToolSpec` gains `activeQuery`, and the core stylesheet shows a copy cursor while painting.
- 96ea657: New `PasteOptions` extension (part of `formatExtensions`) remembers the last formatted paste and adds `pasteAs('keep' | 'clean' | 'plain')`, `dismissPaste()` and the `lastPaste` query; switching restores the document from before the paste in the same transaction and re-runs the clipboard through the normal paste pipeline. The interface shows a paste options button next to the cursor after such a paste; Ctrl pressed on its own opens its menu and Escape hides it.
- 96ea657: Writing tools. `@viveeditor/ext-format` adds `Subscript`, `Superscript`, `FontSize` (`FONT_SIZES`, `setFontSize`, `unsetFontSize`, `stepFontSize`), `Indent` (`indent`, `outdent`, `indentLevel`), `ChangeCase` (`changeCase`, `cycleCase`, language-aware) and `Typography` (smart quotes, dashes, ellipsis and symbols), all part of `formatExtensions`; `ClearFormatting` now also resets `indent`. `@viveeditor/core` exports `textInputRule`. The interface adds a "Text style" menu, indent items in the alignment menu and a lazy special characters panel. `@viveeditor/sanitize` keeps `<sub>`, plain `<sup>`, editor font sizes on `span` and indent on paragraphs and headings, and drops nested font sizes and nested superscript or subscript; its profile gains `fontSizes` and `indents`. `@viveeditor/docx` maps superscript and subscript to `w:vertAlign`.
  
  `getJSON()` now writes `indent: null` on every paragraph and heading. Documents from 0.1.0 load unchanged, but code that compares `getJSON()` output with a stored object must allow the new attribute.

### Patch Changes

- 1a1a861: `getHTML()` writes font families exactly as the font list has them in every browser, so the saved HTML matches the sanitizer's output. A font whose first name is the first name of a list entry now maps to that entry, so fonts pasted from Word or Google Docs (`"Times New Roman",serif`, `Arial`) are kept; the Node and PHP sanitizers follow the same rule. Word's 100%, 115%, 150% and 200% line heights are read as 1, 1.15, 1.5 and 2. The font size and font family queries return `null` for a mixed selection.
- 96ea657: Image captions and positions, table cell colour and vertical alignment. `@viveeditor/ext-image` gives the image node `caption` and `align` (`'left' | 'center' | 'right'`, exported as `ImageAlign`), set through `setImageAttributes` and returned by `selectedImage`; an image with either is written as `<figure data-align><img><figcaption>`, one with neither stays a plain `<img>`. `@viveeditor/ext-table` gives cells `background` and `verticalAlign` with `setCellBackground`, `setCellVerticalAlign` and `query.cellStyle()`. `@viveeditor/core` now exports `normalizeColor` (still re-exported by `@viveeditor/ext-format`, whose highlight no longer picks up a cell background). The interface adds caption and position to the image panel and cell colour and vertical alignment to the table panel. `@viveeditor/sanitize` keeps `figure` with a checked `data-align`, `figcaption` and the two cell styles; its profile gains `imageAlign` and `verticalAlign`. Both sanitizers now also drop fully transparent `hsl()` and `hsla()` colours. `@viveeditor/docx` writes and reads cell shading and vertical alignment and writes captions as Caption paragraphs; `@viveeditor/markdown` writes a caption as an italic line under the image.
  
  `getJSON()` now writes `caption: null, align: null` on every image and `background: null, verticalAlign: null` on every table cell. Documents from 0.1.0 load unchanged and their HTML and Markdown output is identical, but code that compares `getJSON()` output with a stored object must allow the new attributes.
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
