# viveeditor

## 1.0.0-rc.0

### Minor Changes

- 96ea657: Document tools and drafts. `@viveeditor/core` adds the queries `findNodes(names)` and `findMarks(names)`, which return `FoundItem { name, attrs, text, from, to }` in document order (at most 2000). `@viveeditor/ui` adds outline, accessibility check, keyboard shortcut list (Alt+0) and full screen to the toolbar, the `exclude` option to leave tools out, and autosave: `createAutosave(editor, options)` or `autosave` on `createUI` keeps a draft under `viveeditor:draft:<key>`, shows a bar to restore or delete it, and can call your own `save` function; `EditorUI` gains `autosave`. `messages` also accepts the new `DocumentMessages` keys. The panel kit exports `createOutlinePanel`, `createCheckPanel`, `createShortcutsPanel` and `documentMessages`. `viveeditor` reads `data-autosave="key"` on a textarea and clears the draft after a submit, and its panels add-on now carries the special characters panel and the new panels.
- 9f59c19: New toolbar controls: a font family menu that shows each font in its own face, a line height menu (single, 1.15, 1.5, double) and a list style panel for the bullet shape, the numbering type and the start number. The link panel can make a link open in a new tab, the image panel can link an image, and the code block Copy button is translated. The CDN build now also loads the font size panel.
  Opening a Word file from the File menu passes the editor's font family list to the reader.
- bd7fb9c: Selected images get four corner handles with a live size badge. Dragging a corner keeps the aspect ratio, stays between 16 px and the content width, and saves whole-pixel `width` and `height` in one undo step; double-clicking a handle returns to the natural size. Touch targets are 44 px and only the handles stop scrolling. The new `resizable` option turns the handles off, and the new `resizeImage`, `resetImageSize` and `replaceImage` commands and the `imageReplaceMode` query are available in code. The image panel adds width and height fields with "Keep aspect ratio" and "Reset size", and a "Crop" button that also sits in the image's right-click menu. The crop dialog, loaded with the other panels, offers Free, 1:1, 4:3, 16:9 and Original presets, works with mouse, touch and keyboard, and sends the cropped file through the `upload` function or embeds it when `allowBase64` is on. Cross-origin images without CORS show an explanation instead of failing.

### Patch Changes

- 96ea657: Fixes before 1.0. `@viveeditor/core` keeps leading, trailing and repeated spaces inside footnotes when the document is saved and loaded again. `@viveeditor/markdown` writes complete video links: the Vimeo private link part and the YouTube or Vimeo start time are kept. `@viveeditor/ui` applies the HTML typed in the source view before its form is submitted, also when a script calls `form.requestSubmit()`. `viveeditor`: `MountDestroyedError` is now a `ViveEditorError` with the code `DESTROYED`.
- 1a1a861: Menus show the current item with accent text and a check mark, and keyboard focus as one inset ring. Headings 1, 2 and 3 have their own icons. The text colour, highlight and table colour panels have a built-in colour picker (colour area, hue slider, colour code, and an eyedropper where the browser has one) instead of the browser's colour window, start from the current colour, and work with touch and the keyboard. The `colorHue` and `colorEyedropper` message keys are new.
- Updated dependencies [96ea657]
- Updated dependencies [96ea657]
- Updated dependencies [9f59c19]
- Updated dependencies [e8c82d0]
- Updated dependencies [9f59c19]
- Updated dependencies [bd7fb9c]
- Updated dependencies [96ea657]
- Updated dependencies [9f59c19]
- Updated dependencies [1a1a861]
- Updated dependencies [9f59c19]
- Updated dependencies [9f59c19]
- Updated dependencies [9f59c19]
- Updated dependencies [96ea657]
- Updated dependencies [96ea657]
- Updated dependencies [bd7fb9c]
- Updated dependencies [319b968]
- Updated dependencies [96ea657]
- Updated dependencies [1a1a861]
- Updated dependencies [bd7fb9c]
- Updated dependencies [96ea657]
- Updated dependencies [96ea657]
- Updated dependencies [9f59c19]
- Updated dependencies [96ea657]
- Updated dependencies [095b69b]
- Updated dependencies [9f59c19]
- Updated dependencies [9f59c19]
- Updated dependencies [05a641f]
- Updated dependencies [05a641f]
- Updated dependencies [bd7fb9c]
- Updated dependencies [15de121]
- Updated dependencies [96ea657]
  - @viveeditor/ext-format@1.0.0-rc.0
  - @viveeditor/ui@1.0.0-rc.0
  - @viveeditor/core@1.0.0-rc.0
  - @viveeditor/ext-embed@1.0.0-rc.0
  - @viveeditor/docx@1.0.0-rc.0
  - @viveeditor/ext-list@1.0.0-rc.0
  - @viveeditor/ext-basic@1.0.0-rc.0
  - @viveeditor/ext-image@1.0.0-rc.0
  - @viveeditor/ext-code-block@1.0.0-rc.0
  - @viveeditor/markdown@1.0.0-rc.0
  - @viveeditor/ext-table@1.0.0-rc.0
  - @viveeditor/ext-office-paste@1.0.0-rc.0
  - @viveeditor/ext-search@1.0.0-rc.0
  - @viveeditor/ext-task-list@1.0.0-rc.0

## 0.1.0

### Minor Changes

- 7f36bb3: First public release of viveEditor: the one-script editor, the core engine and its extensions, the toolbar, React, Vue, Svelte, Angular and custom-element components, Markdown and Word conversion, and the Node sanitizer.

### Patch Changes

- Updated dependencies [7f36bb3]
  - @viveeditor/core@0.1.0
  - @viveeditor/docx@0.1.0
  - @viveeditor/ext-basic@0.1.0
  - @viveeditor/ext-code-block@0.1.0
  - @viveeditor/ext-embed@0.1.0
  - @viveeditor/ext-format@0.1.0
  - @viveeditor/ext-image@0.1.0
  - @viveeditor/ext-list@0.1.0
  - @viveeditor/ext-office-paste@0.1.0
  - @viveeditor/ext-search@0.1.0
  - @viveeditor/ext-table@0.1.0
  - @viveeditor/ext-task-list@0.1.0
  - @viveeditor/markdown@0.1.0
  - @viveeditor/ui@0.1.0
