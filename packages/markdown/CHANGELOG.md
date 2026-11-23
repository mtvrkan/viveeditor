# @viveeditor/markdown

## 1.0.0-rc.0

### Minor Changes

- 96ea657: Image captions and positions, table cell colour and vertical alignment. `@viveeditor/ext-image` gives the image node `caption` and `align` (`'left' | 'center' | 'right'`, exported as `ImageAlign`), set through `setImageAttributes` and returned by `selectedImage`; an image with either is written as `<figure data-align><img><figcaption>`, one with neither stays a plain `<img>`. `@viveeditor/ext-table` gives cells `background` and `verticalAlign` with `setCellBackground`, `setCellVerticalAlign` and `query.cellStyle()`. `@viveeditor/core` now exports `normalizeColor` (still re-exported by `@viveeditor/ext-format`, whose highlight no longer picks up a cell background). The interface adds caption and position to the image panel and cell colour and vertical alignment to the table panel. `@viveeditor/sanitize` keeps `figure` with a checked `data-align`, `figcaption` and the two cell styles; its profile gains `imageAlign` and `verticalAlign`. Both sanitizers now also drop fully transparent `hsl()` and `hsla()` colours. `@viveeditor/docx` writes and reads cell shading and vertical alignment and writes captions as Caption paragraphs; `@viveeditor/markdown` writes a caption as an italic line under the image.
  
  `getJSON()` now writes `caption: null, align: null` on every image and `background: null, verticalAlign: null` on every table cell. Documents from 0.1.0 load unchanged and their HTML and Markdown output is identical, but code that compares `getJSON()` output with a stored object must allow the new attributes.

### Patch Changes

- 96ea657: Fixes before 1.0. `@viveeditor/core` keeps leading, trailing and repeated spaces inside footnotes when the document is saved and loaded again. `@viveeditor/markdown` writes complete video links: the Vimeo private link part and the YouTube or Vimeo start time are kept. `@viveeditor/ui` applies the HTML typed in the source view before its form is submitted, also when a script calls `form.requestSubmit()`. `viveeditor`: `MountDestroyedError` is now a `ViveEditorError` with the code `DESTROYED`.
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
