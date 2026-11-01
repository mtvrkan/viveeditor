# @viveeditor/ui

Floating toolbar, selection bubble, slash menu, link panel and readability meter for viveEditor.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/ui @viveeditor/core
```

## Usage

```ts
import { createUI } from '@viveeditor/ui'
import '@viveeditor/ui/style.css'

const ui = createUI(editor, { locale: 'tr', theme: 'auto' })
```

A floating toolbar that stays on screen while long articles scroll, a selection bubble, a `/` block menu, link, image, video, table, colour and find panels, a File menu and a readability meter. Turkish and English labels, light, dark and auto themes, `--ve-accent` for your brand colour. Mentions, emoji, formulas, footnotes, templates and the AI assistant plug in from `@viveeditor/ui/extras`.

## License

MIT
