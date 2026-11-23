---
"@viveeditor/ui": minor
"@viveeditor/core": minor
"@viveeditor/ext-embed": minor
---

Right-clicking a table, image, link, code block, video or formula opens a menu with the actions for that object, with submenus for cell, row and column actions. Plain text keeps the browser's own menu so spelling suggestions stay; Shift+right-click always shows the browser menu, Shift+F10 or the menu key opens it from the keyboard, and touch devices are left alone. The new `contextMenu` UI option (`'objects'`, `'always'` or `false`) controls it. Menus support submenus. Core gains the `selectAt` command and ext-embed the `selectedEmbedUrl` query.
