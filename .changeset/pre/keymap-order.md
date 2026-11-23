---
"@viveeditor/core": patch
---

Keyboard shortcuts from all extensions are looked up in one table, so an exact match such as Ctrl+Shift+E (center) wins over another extension's shortcut without Shift (Ctrl+E, inline code). With Caps Lock on in Windows and Linux, Ctrl+Shift+E used to turn the selection into inline code. Bindings for the same key from several extensions still run in priority order until one handles the key.
