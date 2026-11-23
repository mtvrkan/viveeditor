---
"@viveeditor/ext-format": minor
"@viveeditor/ext-list": minor
"@viveeditor/ext-basic": minor
"@viveeditor/ext-image": minor
"@viveeditor/ext-code-block": minor
---

More formatting for 1.0. `LineHeight` sets the line height of paragraphs and headings (1, 1.15, 1.5, 2). `FontFamily` applies a font family from a list the host can replace (`fontFamilies` option, 8 common families by default). Numbered lists take a type (`1`, `a`, `A`, `i`, `I`) and a start number, bullet lists a style (disc, circle, square), read back with the `listStyle` query. Links can open in a new tab (`setLink({ href, newTab })`, `link` query). Images can carry a link (`setImageLink`). Code blocks get a Copy button (`copyLabel`, `copiedLabel` options). Fixes `setLink` linking the whole paragraph when the cursor was already inside a link.
