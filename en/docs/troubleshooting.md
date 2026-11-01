# Troubleshooting

> Fixes for common viveEditor problems, from CDN add-ons that fail to load to refused files, blocked players and sanitizer errors.

URL: https://editor.vivepdf.com/en/docs/troubleshooting/
Last updated: 2026-11-01

This page lists the problems people run into most often with viveEditor and what causes them. Find the symptom, check the causes in order, and follow the link if you need the full setup.

## CDN script and add-ons

### Word, Markdown or a panel does not load

The CDN script loads `viveeditor.docx.iife.js`, `viveeditor.markdown.iife.js` and `viveeditor.panels.iife.js` from its own folder on first use. The File menu then says "The converter could not be loaded", or a panel shows "This panel could not be loaded" with a Try again button. Check these causes:

- The script address has no exact version, such as `cdn.jsdelivr.net/npm/viveeditor`. Use `viveeditor@x.y.z` with your exact version.
- The files were renamed or combined. The main script must keep the name `viveeditor.classic.iife.js`, and the add-ons must sit next to it with their own names.
- You host the files yourself without `Access-Control-Allow-Origin`, so the fingerprint check cannot run.
- Your Content Security Policy blocks the folder in `script-src`, or Trusted Types is enforced without the `viveeditor` policy name in `trusted-types`.

A failed add-on is removed, so the next use tries again. Loading gives up after 30 seconds. See [Security and CSP](https://editor.vivepdf.com/en/docs/security-and-csp/).

### The integrity check fails

Each add-on is checked against a `sha384` fingerprint built into that exact version of the main script, and it is accepted only when its version matches. Load every file from the same version folder, and do not change the files after the build.

### A warning about a second copy

The main script was loaded twice. The second copy warns and passes add-ons it does not own to the first one. Remove the extra `<script>` tag.

### Word and Markdown are missing with npm

With a bundler there are no CDN add-ons. Without loaders, the File menu opens only HTML and text files. Pass the converters in `files`; see [Open, save and print](https://editor.vivepdf.com/en/docs/open-save-print/).

## Files and pasted content

### A file is refused

- Word files over 20 MB and text files over 5 MB are refused.
- Password-protected files cannot be opened. Remove the password and try again.
- Word files that unpack too large or too deep are refused with "The file is too large or too complex."
- `.doc`, `.odt` and `.rtf` are not supported. Save the file as `.docx` first.

### Images disappear when a Word file is opened

Opening images from a Word file needs your `upload` function or `allowBase64` in the File menu options. Without one, images are dropped and the menu says how many.

### Images are missing after a paste from Word

Images that point at files on the copying computer cannot be pasted. The `onDropped` callback of `OfficePaste` tells you how many were left out. Insert those images through the image panel.

### An image or link address is refused

- Images need an `https` address. `data:` addresses work only with `allowBase64`, and SVG images never do.
- Links accept `http`, `https`, `mailto` and `tel` only.

## Video embeds

### A link does not turn into a player

- The provider is not in your `providers` list. Built-in providers are YouTube, Vimeo and Spotify.
- The link comes from a link shortener. The editor never follows redirects or short links.
- When you paste, the clipboard must hold the link alone, on an empty line. Otherwise use the video button in the toolbar.
- The document already holds the maximum number of players (`maxEmbeds`, 50 by default).

### Players do not work on the published page

- A page-wide `Referrer-Policy: no-referrer` stops YouTube players from working.
- Your `frame-src` does not list the provider.
- You use `facade: true` but do not call `activateEmbeds()` from `@viveeditor/ext-embed/activate` on the page.
- Your server sanitizer removed the players, because `embeds: true` was not passed.

See [Video embeds](https://editor.vivepdf.com/en/docs/video-embeds/).

## Extras

### Formulas show their LaTeX source

KaTeX older than 0.18.2 is refused with the error code `KATEX_OUTDATED`, and the source is shown instead. Update KaTeX. If KaTeX fails to load, the code is `KATEX_LOAD`. On published pages, call `renderMath(root, { load: () => import('katex') })` from `@viveeditor/ext-math/render`, and load `katex/dist/katex.min.css`.

### Footnotes are not numbered on the published page

Call `renderFootnotes(root)` from `@viveeditor/ext-footnote/render` on the page that shows the content.

## Server sanitizing

### `TOO_LARGE` or `TOO_COMPLEX`

`sanitizeHtml` throws a `SanitizeError` instead of returning cut or partial output:

- `TOO_LARGE`: the HTML is larger than `maxBytes`, 2 MB by default.
- `TOO_COMPLEX`: the structure would make the parser slow or memory hungry, such as more than 64 attributes on one tag or nesting deeper than 512 levels. The editor never writes such HTML.

```ts
import { SanitizeError, sanitizeHtml } from '@viveeditor/sanitize'

function cleanOrNull(html: string): string | null {
  try {
    return sanitizeHtml(html)
  } catch (error) {
    if (error instanceof SanitizeError) return null
    throw error
  }
}
```

Reject the request when you get `null`.

### PHP ends the request with a fatal error

Some short hostile inputs can reach PHP's `memory_limit` before the check runs. That is safe but not a clean exception. Keep `memory_limit` and `max_execution_time` at their usual values for the endpoints that sanitize, and limit the request body size there.

### A Laravel field reads as an empty string

The `ViveHtml` cast could not clean that row because it is too large or too complex. The error goes to your exception handler. See [Laravel](https://editor.vivepdf.com/en/docs/laravel/).

## Forms and setup

### The form does not submit

- A `required` editor is empty. The textarea fires `vive:invalid` with `detail.reason` set to `'required'`.
- Images are still uploading. The form sends once they finish. If an upload fails while waiting, the send is cancelled and `vive:invalid` fires with `detail.reason` set to `'upload'`.

```ts
document.querySelector('#body').addEventListener('vive:invalid', (event) => {
  console.log((event as CustomEvent).detail.reason)
})
```

### A toolbar button is missing

The toolbar shows only tools whose commands are registered. If you pass your own `extensions`, add the extension for the tool you miss. The File menu is hidden by `data-files="false"` on a textarea or `files: false` in `createUI`.

### `Editor.create` throws a `ViveEditorError`

- `DUPLICATE_EXTENSION`: the same extension is in the list twice.
- `INVALID_SCHEMA`: a dependency is missing, such as the list item for a list.
- `SCHEMA_CONFLICT`: two extensions define the same thing.
- `DESTROYED`: you used the editor after `destroy()`.
- `UNKNOWN_COMMAND`: the command's extension is not loaded.

### The interface is in the wrong language

Pass `locale`. Without it, the editor follows `<html lang="...">` and then the browser language.

### Images are too wide on the published page

Saved images carry their `width` and `height`. Add `img { max-width: 100%; height: auto; }` to the pages that show the content.
