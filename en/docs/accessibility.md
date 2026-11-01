# Accessibility

> How viveEditor meets WCAG 2.2 AA, which keys control it, what screen readers hear, and what you still need to provide.

URL: https://editor.vivepdf.com/en/docs/accessibility/
Last updated: 2026-11-01

viveEditor targets WCAG 2.2 AA: every tool works from the keyboard, status changes are announced to screen readers, and the editor helps writers describe their images. This page lists what the editor does and the few things you still need to provide, such as a label.

## How it is tested

Every test page, every panel and both themes are checked with axe against WCAG 2.2 AA; a failure blocks the build. The `/` menu and the suggestion lists keep the focus in the text while you pick an option, following the combobox pattern, and a keyboard test proves that every option can be reached.

## Give the editor a name

Screen readers need a name for the editing area. Pass `label` everywhere you create an editor:

```ts
import { mountEditor } from 'viveeditor'

mountEditor(document.querySelector('#editor'), { label: 'Article body' })
```

The components take the same `label` prop, and `<vive-editor>` takes a `label` attribute. With a textarea, keep a visible `<label for>` that points at it; the editor uses that text when you pass no `label`.

Set `locale` too, or a correct `<html lang="...">`, so the toolbar names and messages are read in the page's language. The interface has Turkish and English text.

## Keyboard

| Keys | What they do |
| --- | --- |
| `Alt+F10` | Move the focus from the text to the toolbar |
| `Ctrl+K` | Open the link panel |
| `Ctrl+F` | Open find and replace |
| `/` | Open the block menu |
| `Esc` | Close the selection bubble or a loading panel |
| `Tab` / `Shift+Tab` | Change the level of a list item |
| `Tab` | In a table, move to the next cell |
| `Ctrl+Enter` | Tick a checklist item |
| `Ctrl+Shift+L`, `E`, `R`, `J` | Align left, centre, right or justify |
| `Ctrl+J` | Open the AI assistant, when you added it |

On a Mac, use `⌘` where the table says `Ctrl`. Markdown shortcuts also work while typing, such as `## ` for a heading, `- ` for a list or `[ ]` for a checklist. The full list is on [Toolbar and shortcuts](https://editor.vivepdf.com/en/docs/toolbar-and-shortcuts/).

## What screen readers hear

- File menu progress is announced through a `role="status"` region, and errors appear in a visible `role="alert"` notice.
- While a panel loads, a placeholder with `role="status"` sits in its place. If it fails, a message with a Try again button replaces it.
- When a form waits for uploads, a notice with `role="status"` says it will send, and the editor is marked `aria-busy`.
- When a required editor is empty on submit, the editor is marked `aria-invalid="true"`, takes the focus and fires a `vive:invalid` event that you can use to show your own message.

## Images and alt text

The image panel asks for alt text, with the hint "Briefly describe the image for people who cannot see it". A writer can also mark an image as decorative.

- In the saved document, `alt: null` means the description is missing and `alt: ''` means the image is decorative.
- The `requireAlt` option of `Image` (`'off'`, `'warn'` or `'block'`) sets how the alt-text reminder behaves.
- The `imagesWithoutAlt` query lists the images that still need a description, for example before you publish.

## Colours and layout

- Light, dark and auto themes are available. In the dark theme, text colours chosen by the writer are lifted on screen so they stay readable; the saved HTML keeps the stored colour.
- On narrow screens, below 560 px, most tools move into the "More tools" menu.
- Pages that show the content should add `img { max-width: 100%; height: auto; }` so images fit small screens.

## Readability meter

The interface includes a readability meter that shows words, sentences, average sentence length, reading time and a readability score. The score uses the Ateşman or the Flesch formula; set it with `readability: 'atesman'` or `readability: 'flesch'` in `createUI`, or hide the meter with `readability: false`.
