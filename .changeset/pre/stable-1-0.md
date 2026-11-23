---
"@viveeditor/core": major
---

viveEditor 1.0: the public API is stable and follows semantic versioning. Breaking changes come only in a new major version, deprecated APIs stay for at least six months, and security fixes reach the previous major for six months. Upgrading from 0.x: `Draft` is now `AutosaveDraft`, `PasteOptionsOptions` is now `PasteOptionsSettings`, and `MountDestroyedError` is a `ViveEditorError` with the code `DESTROYED`; see the versioning page for the full guide.
