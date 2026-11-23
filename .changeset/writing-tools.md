---
'@viveeditor/core': minor
'@viveeditor/ext-format': minor
'@viveeditor/ui': minor
'@viveeditor/sanitize': minor
'@viveeditor/docx': minor
---

Writing tools. `@viveeditor/ext-format` adds `Subscript`, `Superscript`, `FontSize` (`FONT_SIZES`, `setFontSize`, `unsetFontSize`, `stepFontSize`), `Indent` (`indent`, `outdent`, `indentLevel`), `ChangeCase` (`changeCase`, `cycleCase`, language-aware) and `Typography` (smart quotes, dashes, ellipsis and symbols), all part of `formatExtensions`; `ClearFormatting` now also resets `indent`. `@viveeditor/core` exports `textInputRule`. The interface adds a "Text style" menu, indent items in the alignment menu and a lazy special characters panel. `@viveeditor/sanitize` keeps `<sub>`, plain `<sup>`, editor font sizes on `span` and indent on paragraphs and headings, and drops nested font sizes and nested superscript or subscript; its profile gains `fontSizes` and `indents`. `@viveeditor/docx` maps superscript and subscript to `w:vertAlign`.

`getJSON()` now writes `indent: null` on every paragraph and heading. Documents from 0.1.0 load unchanged, but code that compares `getJSON()` output with a stored object must allow the new attribute.
