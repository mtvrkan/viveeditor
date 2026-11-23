---
"@viveeditor/ui": patch
"@viveeditor/ext-code-block": patch
---

Menus and panels no longer show a horizontal and a vertical scrollbar on systems that always show scrollbars: the gradient edge is now drawn inside the border instead of one pixel outside it. The code block language picker and the special character category picker share one look in every browser (same height, a drawn arrow, hover and focus ring) and keep the native picker on phones.
