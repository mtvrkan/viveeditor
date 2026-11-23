---
"@viveeditor/ext-format": minor
"@viveeditor/ui": minor
"@viveeditor/docx": minor
---

Font size can be set in points. `setFontSize` takes a point value from 6 to 96 in half points (the old size steps still work), `stepFontSize` moves through the usual sizes from 8 to 72 pt, and the new `fontSizePoints` query reads the current size. The toolbar gets a font size control that shows the current size and opens a panel where you can type a size, step it up or down, pick a common size or go back to the default. Word export and import keep point sizes. The five size items left the text style menu, so the `fontTiny`, `fontSmall`, `fontNormal`, `fontBig` and `fontHuge` message keys are gone.
