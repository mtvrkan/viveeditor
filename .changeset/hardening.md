---
'@viveeditor/core': patch
'@viveeditor/markdown': patch
'@viveeditor/ui': patch
'viveeditor': patch
---

Fixes before 1.0. `@viveeditor/core` keeps leading, trailing and repeated spaces inside footnotes when the document is saved and loaded again. `@viveeditor/markdown` writes complete video links: the Vimeo private link part and the YouTube or Vimeo start time are kept. `@viveeditor/ui` applies the HTML typed in the source view before its form is submitted, also when a script calls `form.requestSubmit()`. `viveeditor`: `MountDestroyedError` is now a `ViveEditorError` with the code `DESTROYED`.
