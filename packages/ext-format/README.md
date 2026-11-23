# @viveeditor/ext-format

Text alignment, indent, colour, highlight, font size, superscript and subscript, letter case, smart typography and clear formatting extensions for viveEditor.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/ext-format @viveeditor/core
```

## Usage

```ts
import { Editor } from '@viveeditor/core'
import '@viveeditor/core/style.css'
import { formatExtensions } from '@viveeditor/ext-format'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [...formatExtensions],
})
```

Alignment uses Ctrl/⌘+Shift+L, E, R and J. Ctrl/⌘+\ (`editor.commands.clearFormatting()`) removes every mark except links from the selection and resets alignment; `ClearFormatting.configure({ keepMarks })` chooses which marks stay. `FormatPainter` adds `copyFormat()`, `applyFormat()`, `cancelFormat()` and the `isPaintingFormat` query: the copied marks are applied to the next mouse selection, or to a Shift-arrow selection when Shift is released; Escape cancels. `CleanDocument` adds `cleanDocument()` and the `documentCleanup` query: it removes spaces at paragraph edges, repeated spaces, line breaks at paragraph ends and extra empty paragraphs, never touching code blocks, and reports the counts. `PasteOptions` remembers the last formatted paste and adds `pasteAs('keep' | 'clean' | 'plain')`, `dismissPaste()` and the `lastPaste` query; switching restores the document from before the paste and runs the clipboard through the normal paste pipeline again. `Indent` moves paragraphs and headings in 2 em steps (`indent()`, `outdent()`, Ctrl/⌘+] and [, up to `max: 8`); the server sanitizer keeps the indent only on paragraphs and headings, so other `types` lose it there. `FontSize` sets one of `FONT_SIZES` (`setFontSize('tiny' | 'small' | 'big' | 'huge')`, `unsetFontSize()`, `stepFontSize(1 | -1)`, Ctrl/⌘+Shift+. and ,). `Subscript` and `Superscript` toggle with Ctrl/⌘+, and . and exclude each other. `ChangeCase` adds `changeCase('upper' | 'lower' | 'title' | 'sentence')` and `cycleCase()` (Shift+F3) using the language of the text, so Turkish `i` becomes `İ`; with only a cursor it changes the word under it. `Typography` turns quotes, `--`, `...`, `(c)`, `(r)`, `(tm)`, `->` and `<-` into typographic characters as you type; Backspace takes a replacement back, and `quotes: null`, `dashes: false` or `symbols: false` turn parts off. Colours are checked on paste and on output, so a `style` attribute never carries anything but a colour.

## License

MIT
