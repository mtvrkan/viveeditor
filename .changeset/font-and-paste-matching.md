---
"@viveeditor/core": patch
"@viveeditor/ext-format": patch
"@viveeditor/sanitize": patch
---

`getHTML()` writes font families exactly as the font list has them in every browser, so the saved HTML matches the sanitizer's output. A font whose first name is the first name of a list entry now maps to that entry, so fonts pasted from Word or Google Docs (`"Times New Roman",serif`, `Arial`) are kept; the Node and PHP sanitizers follow the same rule. Word's 100%, 115%, 150% and 200% line heights are read as 1, 1.15, 1.5 and 2. The font size and font family queries return `null` for a mixed selection.
