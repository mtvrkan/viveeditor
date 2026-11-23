---
"@viveeditor/sanitize": minor
---

The sanitizer keeps the new 1.0 formatting in one canonical form, with the same rules in the PHP sanitizer: font sizes from 6 to 96 pt in half points, line height (1, 1.15, 1.5, 2), font families from a list (new `fontFamilies` option, 8 common families by default; a malformed entry throws a `TypeError`), horizontal alignment in table cells, table width, alignment, borders, border colour and striped rows, numbered list types (`a`, `A`, `i`, `I`) and bullet styles (disc, circle, square).
