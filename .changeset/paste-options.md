---
'@viveeditor/ext-format': minor
'@viveeditor/ui': minor
---

New `PasteOptions` extension (part of `formatExtensions`) remembers the last formatted paste and adds `pasteAs('keep' | 'clean' | 'plain')`, `dismissPaste()` and the `lastPaste` query; switching restores the document from before the paste in the same transaction and re-runs the clipboard through the normal paste pipeline. The interface shows a paste options button next to the cursor after such a paste; Ctrl pressed on its own opens its menu and Escape hides it.
