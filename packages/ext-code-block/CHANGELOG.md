# @viveeditor/ext-code-block

## 1.0.0-rc.0

### Minor Changes

- 9f59c19: More formatting for 1.0. `LineHeight` sets the line height of paragraphs and headings (1, 1.15, 1.5, 2). `FontFamily` applies a font family from a list the host can replace (`fontFamilies` option, 8 common families by default). Numbered lists take a type (`1`, `a`, `A`, `i`, `I`) and a start number, bullet lists a style (disc, circle, square), read back with the `listStyle` query. Links can open in a new tab (`setLink({ href, newTab })`, `link` query). Images can carry a link (`setImageLink`). Code blocks get a Copy button (`copyLabel`, `copiedLabel` options). Fixes `setLink` linking the whole paragraph when the cursor was already inside a link.

### Patch Changes

- 9f59c19: Menus and panels no longer show a horizontal and a vertical scrollbar on systems that always show scrollbars: the gradient edge is now drawn inside the border instead of one pixel outside it. The code block language picker and the special character category picker share one look in every browser (same height, a drawn arrow, hover and focus ring) and keep the native picker on phones.
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
