# @viveeditor/ext-image

## 1.0.0-rc.0

### Minor Changes

- 9f59c19: More formatting for 1.0. `LineHeight` sets the line height of paragraphs and headings (1, 1.15, 1.5, 2). `FontFamily` applies a font family from a list the host can replace (`fontFamilies` option, 8 common families by default). Numbered lists take a type (`1`, `a`, `A`, `i`, `I`) and a start number, bullet lists a style (disc, circle, square), read back with the `listStyle` query. Links can open in a new tab (`setLink({ href, newTab })`, `link` query). Images can carry a link (`setImageLink`). Code blocks get a Copy button (`copyLabel`, `copiedLabel` options). Fixes `setLink` linking the whole paragraph when the cursor was already inside a link.
- bd7fb9c: Selected images get four corner handles with a live size badge. Dragging a corner keeps the aspect ratio, stays between 16 px and the content width, and saves whole-pixel `width` and `height` in one undo step; double-clicking a handle returns to the natural size. Touch targets are 44 px and only the handles stop scrolling. The new `resizable` option turns the handles off, and the new `resizeImage`, `resetImageSize` and `replaceImage` commands and the `imageReplaceMode` query are available in code. The image panel adds width and height fields with "Keep aspect ratio" and "Reset size", and a "Crop" button that also sits in the image's right-click menu. The crop dialog, loaded with the other panels, offers Free, 1:1, 4:3, 16:9 and Original presets, works with mouse, touch and keyboard, and sends the cropped file through the `upload` function or embeds it when `allowBase64` is on. Cross-origin images without CORS show an explanation instead of failing.
- 96ea657: Image captions and positions, table cell colour and vertical alignment. `@viveeditor/ext-image` gives the image node `caption` and `align` (`'left' | 'center' | 'right'`, exported as `ImageAlign`), set through `setImageAttributes` and returned by `selectedImage`; an image with either is written as `<figure data-align><img><figcaption>`, one with neither stays a plain `<img>`. `@viveeditor/ext-table` gives cells `background` and `verticalAlign` with `setCellBackground`, `setCellVerticalAlign` and `query.cellStyle()`. `@viveeditor/core` now exports `normalizeColor` (still re-exported by `@viveeditor/ext-format`, whose highlight no longer picks up a cell background). The interface adds caption and position to the image panel and cell colour and vertical alignment to the table panel. `@viveeditor/sanitize` keeps `figure` with a checked `data-align`, `figcaption` and the two cell styles; its profile gains `imageAlign` and `verticalAlign`. Both sanitizers now also drop fully transparent `hsl()` and `hsla()` colours. `@viveeditor/docx` writes and reads cell shading and vertical alignment and writes captions as Caption paragraphs; `@viveeditor/markdown` writes a caption as an italic line under the image.
  
  `getJSON()` now writes `caption: null, align: null` on every image and `background: null, verticalAlign: null` on every table cell. Documents from 0.1.0 load unchanged and their HTML and Markdown output is identical, but code that compares `getJSON()` output with a stored object must allow the new attributes.

### Patch Changes

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
