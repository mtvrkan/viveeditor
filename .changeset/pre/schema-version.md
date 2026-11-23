---
"@viveeditor/core": minor
---

`editor.getJSON()` writes `schemaVersion` (exported as `SCHEMA_VERSION`) at the root of the document. JSON without it loads as 0.x content; JSON with a newer version is refused with `ViveEditorError` code `SCHEMA_TOO_NEW`, and `replaceContent`/`insertContent` return `false` for it. Code that compares `getJSON()` output with a stored object must allow the new root key.
