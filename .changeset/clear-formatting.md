---
"@viveeditor/ext-format": minor
"@viveeditor/ui": minor
---

New `ClearFormatting` extension (part of `formatExtensions`) with the `clearFormatting` command and Ctrl/⌘+\: removes every mark except those in `keepMarks` (default `['link']`) from the selection and resets `blockAttributes` (default `['textAlign']`) on the selected text blocks; with a collapsed cursor it clears the stored marks. The toolbar and the selection bubble get a "Clear formatting" button.
