---
"@viveeditor/ext-table": minor
"@viveeditor/ui": minor
"@viveeditor/sanitize": minor
"@viveeditor/docx": minor
---

Table rows get a height. Drag a row's bottom edge to set it (double-click the handle to reset), or use "Make row taller", "Make row shorter" and "Reset row height" in the table panel and the Row submenu of the context menu. New `setRowHeight` and `resizeRow` commands and a `rowHeight` query; the height is a minimum, saved as `<tr style="height: Npx">` (24 to 2000 px). Both sanitizers keep it within the new `maxRowHeight` limit, and Word files write and read it as an at-least row height.
