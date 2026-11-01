# Footnotes

> Add footnotes that writers edit in place, then number them and list them at the end of published pages with renderFootnotes.

URL: https://editor.vivepdf.com/en/docs/footnotes/
Last updated: 2026-11-01

The footnote extension lets a writer add a note at any point in the text and type it right there, without jumping to the end of the page. The note is stored where it belongs in the sentence. On the published page `renderFootnotes` numbers the notes and lists them at the end.

Footnotes ship as npm packages only. The one-script build does not include them.

## Set it up

1. Install the extension and the UI: `npm install @viveeditor/ext-footnote @viveeditor/ui @viveeditor/core`.
2. Add `Footnote` to the editor's extensions and import its stylesheet.
3. Add `footnoteTools()` to the `plugins` of `createUI` for the `/` menu entry.

```ts
import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { Footnote } from '@viveeditor/ext-footnote'
import { createUI } from '@viveeditor/ui'
import { footnoteTools } from '@viveeditor/ui/extras'
import '@viveeditor/ext-footnote/style.css'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [...basicExtensions, Footnote],
})

createUI(editor, { plugins: [footnoteTools()] })
```

## Writing footnotes

- Pick "Footnote" from the `/` menu. A numbered marker appears at the cursor and a small box opens under it.
- Type the note in the box. `Enter` or `Esc` returns to the main text.
- Select the marker again to edit the note.

From code, `editor.commands.insertFootnote()` inserts an empty note at the cursor.

Notes keep bold, italic and links only. Other formatting is removed, and a note cannot sit inside a link. A note holds at most 5,000 characters (`MAX_FOOTNOTE_LENGTH`). Inside the editor the markers are numbered in order as you write.

## What is stored

```html
<p>The study ran for two years.<sup data-footnote="">Results were published in <em>2025</em>.</sup></p>
```

[The server sanitizer](https://editor.vivepdf.com/en/docs/server-sanitizing/) keeps footnotes in exactly this form. Inside a footnote only text, bold, italic and links survive. A footnote, mention or formula nested where it cannot live is reduced to its text.

## Published pages

Call `renderFootnotes` on the element that holds the content:

```ts
import { renderFootnotes } from '@viveeditor/ext-footnote/render'

const article = document.querySelector('article')
if (article) renderFootnotes(article, { backLabel: 'Back to text' })
```

- Each note in the text becomes a number that links to its entry.
- The notes are listed in an `<ol class="vive-footnotes">` appended to the end of that element.
- Each entry gets a ↩ link back to its place in the text. `backLabel` is its accessible name and defaults to "Back to text".
- A note that sits inside a link becomes a plain number, without a link of its own.
- Notes already handled are skipped, so calling it again is safe. It returns the number of notes it handled.

## Printing and saving

When the writer prints from the File menu, the notes are numbered and listed at the end of the printed page in the same way.

Saving as Markdown writes footnotes as `[^n]` with the definitions at the end. Saving as Word writes superscript numbers with the notes at the end. Opening a Word file does not bring its footnotes in.

## Related pages

- [Open, save and print](https://editor.vivepdf.com/en/docs/open-save-print/)
- [Formulas](https://editor.vivepdf.com/en/docs/formulas/)
- [Server sanitizing](https://editor.vivepdf.com/en/docs/server-sanitizing/)

## Are footnote numbers stored in the HTML?

No. The note text is stored where it belongs in the sentence. Numbers are added by renderFootnotes on the published page and by printing.

## What formatting can a footnote hold?

Bold, italic and links only. Other formatting is removed.
