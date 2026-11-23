---
'@viveeditor/ext-format': minor
'@viveeditor/ui': minor
'@viveeditor/core': minor
---

New `FormatPainter` extension (part of `formatExtensions`) with `copyFormat`, `applyFormat`, `cancelFormat` and the `isPaintingFormat` query: copied marks are applied to the next mouse selection, or to a Shift-arrow selection when Shift is released, and Escape cancels; links in the target stay. The toolbar gets a "Format painter" button, `ToolSpec` gains `activeQuery`, and the core stylesheet shows a copy cursor while painting.
