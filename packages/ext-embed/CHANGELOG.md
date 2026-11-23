# @viveeditor/ext-embed

## 1.0.0-rc.0

### Minor Changes

- 9f59c19: Right-clicking a table, image, link, code block, video or formula opens a menu with the actions for that object, with submenus for cell, row and column actions. Plain text keeps the browser's own menu so spelling suggestions stay; Shift+right-click always shows the browser menu, Shift+F10 or the menu key opens it from the keyboard, and touch devices are left alone. The new `contextMenu` UI option (`'objects'`, `'always'` or `false`) controls it. Menus support submenus. Core gains the `selectAt` command and ext-embed the `selectedEmbedUrl` query.

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
