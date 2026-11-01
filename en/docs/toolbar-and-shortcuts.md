# Toolbar and shortcuts

> The floating toolbar, selection bubble, / menu, block menu, word count, readability score and every keyboard shortcut.

URL: https://editor.vivepdf.com/en/docs/toolbar-and-shortcuts/
Last updated: 2026-11-01

The viveEditor interface comes from `@viveeditor/ui`: a floating toolbar below the text, a small bubble when you select text, a block menu that opens with `/`, and a word count. This page explains what each part does, how to turn it off and which keyboard shortcuts exist. The one-script build and the framework components show the toolbar already; with the npm packages you call `createUI` yourself.

## Set up the interface

```ts
import { createUI } from '@viveeditor/ui'
import '@viveeditor/ui/style.css'

const ui = createUI(editor, { locale: 'en', theme: 'auto' })
```

`createUI` mounts into the element that holds the editor and removes itself when the editor is destroyed. It only shows tools whose commands are registered: without the table extension there is no table button. The interface talks to the editor only through commands and queries.

| Option | What it does |
| --- | --- |
| `locale` | `'tr'` or `'en'`. Without it, the page's `lang` decides: Turkish if it starts with `tr`, English otherwise. |
| `messages` | Replaces some of the labels with your own text. |
| `theme` | `'light'` (default), `'dark'` or `'auto'`. Use the `--ve-accent` CSS variable for your brand colour. |
| `readability` | `'atesman'`, `'flesch'` or `false`. The default follows the language. |
| `bubble` | `false` turns off the selection bubble. |
| `slash` | `false` turns off the `/` menu. |
| `source` | `false` removes the HTML source button. |
| `files` | The File menu; `false` hides it. See [Open, save and print](https://editor.vivepdf.com/en/docs/open-save-print/). |
| `plugins` | Extra menus such as mentions, emoji and templates plug in here from `@viveeditor/ui/extras`. |
| `onError` | Receives errors raised in the interface. |

## Floating toolbar

The toolbar sits below the text and stays at the bottom of the screen while you scroll a long article. On phones it moves above the on-screen keyboard.

From left to right: the block type button; bold, italic, underline, strikethrough and inline code; text colour and highlight; bulleted list, numbered list, task list, quote, table, image and video; alignment; link and find and replace; undo, redo, File and HTML source. The word count sits at the end.

Below 560 pixels only bold, italic and link stay in place, and the other tools move to the "More tools" menu. In wider spaces, tools that do not fit move into that menu in a fixed order; the menu shows only the tools that moved.

The HTML source button opens the document's HTML in an editable text area. While it is open the other tools are disabled; when you close it, your changes are applied to the editor.

## Selection bubble

When you select text, a small toolbar opens just above the selection. On touch screens it opens below the selection, so your finger does not cover it. It holds bold, italic, link and inline code; plugins such as the [AI assistant](https://editor.vivepdf.com/en/docs/ai-assistant/) add their own buttons. The bubble does not open while an image is selected. `Esc` closes it, and `bubble: false` removes it.

## The / menu

Type `/` at the start of a paragraph to open the block menu. The letters you type next filter the list. Search ignores Turkish letter marks, and English keywords also work (`/table`, `/video`).

The entries are: Heading 1, 2 and 3, bulleted list, numbered list, task list, quote, code block, table (3×3 with a header row), image, video and divider. Image and video do not insert anything directly; they open their panel.

Move with `↑` and `↓`, choose with `Enter` or `Tab`, and close with `Esc`. Focus stays in the text, and screen readers announce the active entry. The mention, emoji, formula, footnote and template plugins add their own entries.

## Block menu

The button at the start of the toolbar shows the type of the block at the cursor, such as Paragraph, Heading 2 or Quote. Open it to switch between paragraph, Heading 1–3, the lists, quote and code block. Choosing Paragraph also removes a list or quote around the block.

## Word count and readability

The count at the end of the toolbar shows how many words the document has. If you set a [character limit](https://editor.vivepdf.com/en/docs/character-limit/), it shows the characters used and the limit instead. The count updates when you pause typing.

Click the count to open the "Text statistics" panel:

- the readability score (0–100) and its band,
- the number of words and sentences,
- the average sentence length,
- the reading time (based on 200 words per minute).

The Turkish interface uses the Ateşman formula and the English interface uses Flesch. Pass `readability` to choose another formula; `false` hides the score and keeps the statistics. The score needs at least 10 words.

| Band | Ateşman | Flesch |
| --- | --- | --- |
| Very easy | 90 and above | 80 and above |
| Easy | 70–89 | 60–79 |
| Fair | 50–69 | 50–59 |
| Hard | 30–49 | 30–49 |
| Very hard | below 30 | below 30 |

To use the same measure in your own code, call `measureText(text, 'flesch')` from `@viveeditor/ui`.

## Keyboard shortcuts

On a Mac, use `⌘` instead of `Ctrl` and `⌥` instead of `Alt`. The toolbar hints show each shortcut for your operating system. A shortcut works when its extension is loaded.

| Action | Windows and Linux | Mac |
| --- | --- | --- |
| Bold | `Ctrl+B` | `⌘+B` |
| Italic | `Ctrl+I` | `⌘+I` |
| Underline | `Ctrl+U` | `⌘+U` |
| Strikethrough | `Ctrl+Shift+S` | `⌘+⇧+S` |
| Inline code | `Ctrl+E` | `⌘+E` |
| Highlight | `Ctrl+Shift+H` | `⌘+⇧+H` |
| Heading 1–6 | `Ctrl+Alt+1` … `6` | `⌘+⌥+1` … `6` |
| Bulleted list | `Ctrl+Shift+8` | `⌘+⇧+8` |
| Numbered list | `Ctrl+Shift+7` | `⌘+⇧+7` |
| Task list | `Ctrl+Shift+9` | `⌘+⇧+9` |
| Quote | `Ctrl+Shift+B` | `⌘+⇧+B` |
| Code block | `Ctrl+Alt+C` | `⌘+⌥+C` |
| Align left | `Ctrl+Shift+L` | `⌘+⇧+L` |
| Align center | `Ctrl+Shift+E` | `⌘+⇧+E` |
| Align right | `Ctrl+Shift+R` | `⌘+⇧+R` |
| Justify | `Ctrl+Shift+J` | `⌘+⇧+J` |
| Link | `Ctrl+K` | `⌘+K` |
| Find and replace | `Ctrl+F` | `⌘+F` |
| Undo | `Ctrl+Z` | `⌘+Z` |
| Redo | `Ctrl+Shift+Z` or `Ctrl+Y` | `⌘+⇧+Z` or `⌘+Y` |
| New line in the same paragraph | `Shift+Enter` | `⇧+Enter` |
| Move to the toolbar | `Alt+F10` | `⌥+F10` |
| AI assistant | `Ctrl+J` | `⌘+J` |

The AI shortcut works only when the [AI assistant](https://editor.vivepdf.com/en/docs/ai-assistant/) plugin is added.

### Moving around

- In the toolbar, `←` and `→` move between buttons, and `Home` and `End` jump to the first and last. `Esc` takes you back to the text.
- In a list, `Tab` indents the item and `Shift+Tab` outdents it.
- In a table, `Tab` moves to the next cell and adds a row in the last cell; `Shift+Tab` goes back.
- In a code block, `Tab` indents and `Shift+Tab` outdents.
- To leave a table or code block with the keyboard, press `Esc` and then `Tab`; focus moves to the next element after the editor.
- Panels and menus close with `Esc`, and focus returns to their button or to the text.

### Typing shortcuts

Some marks typed at the start of a line turn into blocks:

| Type | Result |
| --- | --- |
| `#` to `######` and a space | Heading 1–6 |
| `-`, `*` or `+` and a space | Bulleted list |
| `1.` and a space | Numbered list (another number starts from that number) |
| `[ ]` and a space | Task list (`[x]` starts checked) |
| `>` and a space | Quote |
| `` ``` `` and a space | Code block (you can add a language name) |
| `---` | Divider |

Inside text, `**bold**` or `__bold__`, `*italic*` or `_italic_`, `~~strikethrough~~` and backticks for inline code are formatted as you type.

## Can I turn the toolbar off completely?

Yes. Pass ui false to the framework components or mountEditor; with the npm packages, do not call createUI. Keyboard shortcuts come from the extensions, so they still work without the toolbar.

## Why does the readability score show a dash?

The score needs at least 10 words. For shorter text the panel says "Write at least 10 words for a score." Words, sentences and reading time are still shown.

## Why is a tool missing?

The toolbar only shows tools whose commands are registered. Without the table extension there is no table button, for example. In narrow spaces some tools move to the More tools menu.
