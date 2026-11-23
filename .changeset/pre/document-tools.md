---
'@viveeditor/core': minor
'@viveeditor/ui': minor
'viveeditor': minor
---

Document tools and drafts. `@viveeditor/core` adds the queries `findNodes(names)` and `findMarks(names)`, which return `FoundItem { name, attrs, text, from, to }` in document order (at most 2000). `@viveeditor/ui` adds outline, accessibility check, keyboard shortcut list (Alt+0) and full screen to the toolbar, the `exclude` option to leave tools out, and autosave: `createAutosave(editor, options)` or `autosave` on `createUI` keeps a draft under `viveeditor:draft:<key>`, shows a bar to restore or delete it, and can call your own `save` function; `EditorUI` gains `autosave`. `messages` also accepts the new `DocumentMessages` keys. The panel kit exports `createOutlinePanel`, `createCheckPanel`, `createShortcutsPanel` and `documentMessages`. `viveeditor` reads `data-autosave="key"` on a textarea and clears the draft after a submit, and its panels add-on now carries the special characters panel and the new panels.
