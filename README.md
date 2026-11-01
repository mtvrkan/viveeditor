# viveEditor

A free, open-source rich text editor that drops into any website.

> Status: 0.x, before the first stable release. The API can still change between minor versions; see [Versioning](#versioning).

## Goals

- **Everything free, MIT licensed** — image uploads, tables, embeds, Word import/export: no paid tier.
- **Drop-in** — one `<script>` and a `<textarea>`, or a typed npm package for React, Vue, Svelte and Angular.
- **Safe by default** — the document schema is an allowlist; unknown markup never reaches the output.
- **Fast and small** — every feature is a separate, tree-shakeable package; heavy features load on demand.
- **Accessible** — WCAG 2.2 AA, full keyboard control, screen reader announcements.
- **Never lose text** — crash-safe drafts and offline editing.

## Quick look

### No build step

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/viveeditor@x.y.z/dist/viveeditor.css" />
<script src="https://cdn.jsdelivr.net/npm/viveeditor@x.y.z/dist/viveeditor.classic.iife.js"></script>

<form method="post">
  <label for="body">Article</label>
  <textarea id="body" name="body" data-editor required></textarea>
</form>
```

Replace `x.y.z` with the exact version you use. The form posts clean HTML under the textarea's name. Always sanitize it again on the server.

### With a bundler

```ts
import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { listExtensions } from '@viveeditor/ext-list'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [...basicExtensions, ...listExtensions],
  content: '<p>Hello <strong>world</strong></p>',
  label: 'Article body',
})

editor.on('change', () => console.log(editor.getHTML()))
```

## Framework components

Each component gives you the same editor as the one-script build: every extension and the toolbar. Pass `extensions` to choose your own list, or `ui: false` to leave out the toolbar. The value is HTML, and an empty document is `''`. Load the styles once with `import 'viveeditor/style.css'`.

React 18 and 19:

```tsx
import { ViveEditor } from '@viveeditor/react'

;<ViveEditor value={html} onChange={setHtml} locale="tr" label="Article body" />
```

Vue 3.5:

```vue
<script setup>
import { ViveEditor } from '@viveeditor/vue'
</script>

<template>
  <ViveEditor v-model="html" locale="tr" label="Article body" />
</template>
```

Svelte 5:

```svelte
<script>
  import { ViveEditor } from '@viveeditor/svelte'
  let html = $state('')
</script>

<ViveEditor bind:value={html} locale="tr" label="Article body" />
```

Angular 21 and 22, with `ngModel` or reactive forms:

```ts
import { ViveEditorComponent } from '@viveeditor/angular'

@Component({
  imports: [ViveEditorComponent, ReactiveFormsModule],
  template: `<vive-ng-editor [formControl]="body" locale="tr" label="Article body" />`,
})
class ArticleForm {
  body = new FormControl('')
}
```

Any page, as a form field:

```html
<script type="module">
  import '@viveeditor/element/define'
</script>
<form>
  <vive-editor name="body" required locale="tr" label="Article body"></vive-editor>
</form>
```

`<vive-editor>` sends its HTML with the form, returns to its first value when the form resets and blocks submit while `required` and empty.

Server rendering (Next.js, Nuxt, SvelteKit, Angular SSR): the server renders an empty element and the editor starts in the browser. The React package is marked `'use client'`.

## Development

Requirements: Node.js 20.19+ and pnpm 10.

```sh
pnpm install
pnpm dev        # playground on http://localhost:5173
pnpm verify     # lint, typecheck, unit tests, build, size budget, e2e
```

The PHP packages run in Docker, with images pinned by digest:

```sh
scripts/php.sh sanitizer install && scripts/php.sh sanitizer test
node scripts/build-laravel.mjs   # copies the built editor files into the Laravel package
scripts/php.sh laravel install && scripts/php.sh laravel test
```

## Images and uploads

```ts
import { Image } from '@viveeditor/ext-image'
import '@viveeditor/ext-image/style.css'

const upload = async (file, { signal, onProgress }) => {
  const body = new FormData()
  body.append('file', file)
  const response = await fetch('/uploads', { method: 'POST', body, signal })
  if (!response.ok) throw new Error('Upload failed')
  const { url, width, height } = await response.json()
  return { src: url, width, height }
}

Image.configure({ upload, onError: ({ code, fileName }) => console.warn(code, fileName) })
```

The editor checks every image address and file before it reaches the document, but the browser is not a security boundary. Your server must also:
- sanitize the posted HTML again and allow only `https` image addresses you expect;
- re-validate and re-encode every upload (this strips EXIF/GPS data and polyglot files), and return the real width and height;
- serve uploads from a cookieless domain with a server-set `Content-Type` and `X-Content-Type-Options: nosniff`;
- require authentication, a CSRF token and a rate limit on the upload endpoint;
- restrict `img-src` in your Content Security Policy;
- guard against SSRF if it fetches remote images (for `remoteImages: 'rehost'`).

`remoteImages` defaults to `'allow'`, which keeps images pasted from other sites at their original address; showing them tells that site who read the page and when. For a hardened setup use `'drop'` or `'rehost'`.

Saved images carry their `width` and `height`; add `img { max-width: 100%; height: auto; }` to the pages that show the content.

## Video and audio embeds

`@viveeditor/ext-embed` turns YouTube, Vimeo and Spotify links into players. Paste a link on an empty line or use the toolbar's video button. Inside the editor a card stands in for the player, so nothing loads from the provider until someone presses play.

```ts
import { Embed } from '@viveeditor/ext-embed'
import '@viveeditor/ext-embed/style.css'

Embed.configure({ providers: ['youtube', 'vimeo'], facade: true })
```

The saved HTML never keeps the address it was given. It stores the provider and the video id, and every player address is rebuilt from them with a fixed `sandbox`, `allow` and `referrerpolicy`. With `facade: true` the saved HTML holds a link instead of a player; call `activateEmbeds()` from `@viveeditor/ext-embed/activate` on the page that shows the content to load the player on click.

On the pages that store or show the content:
- clean the HTML on the server too, but never allow every `iframe`; rebuild players from `div[data-embed]`, or accept only addresses for which `isAllowedEmbedSrc()` returns true;
- list only the providers you enabled in your Content Security Policy `frame-src`;
- tell readers that a player loads content and cookies from the provider, where your consent rules require it;
- a page-wide `Referrer-Policy: no-referrer` stops YouTube players from working.

## Open, save and print

The toolbar has a File menu. It opens `.docx`, `.md`, `.html` and `.txt` files, saves the text as Word, Markdown or HTML, and prints it (choose "Save as PDF" in the print dialog for a PDF). An opened file replaces an empty document; otherwise it goes in at the cursor, and one undo takes it back.

With the one-script build the menu is there by default; add `data-files="false"` to a textarea to hide it. With npm, pass the converters as loaders so they download only when used:

```ts
import { createUI } from '@viveeditor/ui'

createUI(editor, {
  files: {
    docx: () => import('@viveeditor/docx'),
    markdown: () => import('@viveeditor/markdown'),
    upload,
    fileName: 'Report',
  },
})
```

Without loaders the menu offers opening HTML and text files, saving as HTML and printing; `files: false` hides it. Pasted Markdown text becomes formatted content with `MarkdownPaste` from `@viveeditor/markdown/paste`, which loads the converter only when the clipboard holds Markdown and no HTML.

Every opened file goes through the same document rules as pasted content, so unknown markup never reaches the output. Sanitize the saved HTML on the server as well.

### Markdown

Headings, bold, italic, strikethrough, inline code, links, images, bullet, numbered and nested lists, checklists, quotes, rules, fenced code with its language and tables are read and written. Markdown has no form for text colour, highlight, underline and alignment, so they are left out when saving; video players are saved as links. Raw HTML inside Markdown is never let through.

### Word (`.docx`)

| Kept when opening and saving                                                                                                  | Left out                                                                |
| ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Headings (a Word title opens as a level 1 heading), bold, italic, underline, strikethrough, text colour, highlight, alignment | Comments, footnotes, headers and footers, text boxes, equations         |
| Bullet, numbered and nested lists                                                                                             | Tracked deletions (insertions are kept), hidden text                    |
| Links to web and mail addresses                                                                                               | Other links become plain text; field codes keep only their visible text |
| Tables with merged cells and header rows, quotes, code                                                                        | Code block language                                                     |
| Images (opening needs your `upload` function or `allowBase64`)                                                                | Without one, images are dropped and the menu says how many              |

Checklists are saved as ☐ and ☑ text and video players as links. The File menu writes images that live at a web address as links; `exportDocx(editor, { fetchImages: true })` downloads and embeds them. Files over 20 MB, password-protected files and files that unpack too large or too deep are refused with a message. `.doc`, `.odt` and `.rtf` are not supported.

## Paste from Word, Google Docs and LibreOffice

`@viveeditor/ext-office-paste` turns Word's fake bullets and numbers into real nested lists, keeps Word's title and quote styles and fixes lists that Google Docs nests the wrong way. Images that point at files on the copying computer cannot be pasted; `onDropped` tells you how many were left out.

```ts
import { OfficePaste } from '@viveeditor/ext-office-paste'

OfficePaste.configure({ onDropped: ({ images }) => console.warn(`${images} images left out`) })
```

## CDN add-ons and Content Security Policy

The one-script build keeps the Word and Markdown converters in two extra files next to the main script, `viveeditor.docx.iife.js` and `viveeditor.markdown.iife.js`. They load on first use from the same folder as `viveeditor.classic.iife.js`, and each is checked against a `sha384` fingerprint built into the main script.
- Load the main script with an exact version (`viveeditor@x.y.z`) and keep the file names. Short addresses such as `cdn.jsdelivr.net/npm/viveeditor` or renamed and combined scripts cannot find the add-ons.
- If you host the files yourself, serve them with `Access-Control-Allow-Origin` so the fingerprint check can run.
- `script-src` must allow the folder that holds the scripts. A `nonce` on the main script is copied to the add-ons.
- With Trusted Types enforced, allow the policy name `viveeditor` in the `trusted-types` directive.
- Printing uses a hidden frame without scripts that loads only images and styles.

## Sanitize on the server

The editor only produces a known set of HTML, but anyone can post any HTML to your server. Clean it there before you store or show it. `@viveeditor/sanitize` (Node) and `viveeditor/sanitizer` (PHP 8.4+) keep exactly what the editor produces and remove everything else. They share one allowlist and one test corpus and give the same output.

```ts
import { sanitizeHtml } from '@viveeditor/sanitize'

const clean = sanitizeHtml(request.body.html, { embeds: true })
```

```php
use Viveeditor\Sanitizer\Sanitizer;

$clean = Sanitizer::sanitize($html, ['embeds' => true]);
```

- Every element and attribute is rebuilt with a full HTML5 parser (`parse5` in Node, `Dom\HTMLDocument` in PHP), so the output reads the same way in every browser. Cleaning twice gives the same result.
- Links keep `http`, `https`, `mailto`, `tel` and relative addresses, and always get `rel="noopener noreferrer nofollow"`. Images need `https` addresses; `allowBase64` and `allowRelativeImages` widen that.
- Video and audio embeds are removed unless you pass `embeds: true`; players are then rebuilt from the provider and id, never copied.
- `style` keeps only text alignment, text and highlight colour, and table widths. `id`, `name`, `form` and event handlers never pass.
- HTML larger than `maxBytes` (2 MB by default) throws a `TOO_LARGE` error instead of being cut.
- HTML whose structure would make the parser slow or memory hungry throws a `TOO_COMPLEX` error: more than 64 attributes on one tag, nesting deeper than 512 levels, or far more elements than the input has tags. The editor never writes such HTML.
- In PHP the parser cannot be stopped from inside, so some short hostile inputs (a few tens of KB of unclosed formatting tags) can reach PHP's `memory_limit` before the check runs. PHP then ends that request with a fatal error, which is safe but not a clean exception. Keep `memory_limit` and `max_execution_time` at their usual values for the endpoints that sanitize, and limit the request body size there.
- Clean when you save, and print stored HTML through a cleaning helper too (`@viveHtml` in Laravel), so rows written before you added cleaning stay safe.
- Mentions, formulas and footnotes are kept in exactly the form the editor writes them. A mention id or formula that fails its check, or one placed inside a link or a footnote, is reduced to its text; footnotes keep only bold, italic and links.

## Laravel

`viveeditor/laravel` (Laravel 12+, PHP 8.4+) adds a Blade component, the editor files and the PHP sanitizer.

```sh
composer require viveeditor/laravel
php artisan vendor:publish --tag=viveeditor-assets
```

```blade
<head>
  @viveeditorScripts
</head>

<label for="body">Article</label>
<x-viveeditor::editor name="body" id="body" :value="old('body', $post->body)" required />

<article>@viveHtml($post->body)</article>
```

- The editor files are served from your own `public/vendor/viveeditor`; nothing loads from a CDN. When you use `Vite::useCspNonce()`, the tags get the nonce.
- Show stored HTML with `@viveHtml(...)`: it cleans while printing, so old rows and rows written outside your forms are safe too. Never print it with `{!! !!}`.
- The `ViveHtml` cast cleans on save and again on read, so rows written before the cast or by raw queries come back clean; a row it cannot clean (too large or too complex) reads as an empty string and the error goes to your exception handler. `ViveEditor::sanitize($html)` cleans anywhere. Options live in `config/viveeditor.php` (`php artisan vendor:publish --tag=viveeditor-config`).
- The editor follows `<html lang="...">` for its language.

## Extras (npm)

Mentions, emoji, formulas, footnotes, templates and an AI assistant ship as npm packages only; the one-script build does not include them. The menus and panels come from `@viveeditor/ui/extras` and plug into `createUI`:

```ts
import { Footnote } from '@viveeditor/ext-footnote'
import { MathExtension } from '@viveeditor/ext-math'
import { Mention } from '@viveeditor/ext-mention'
import { createUI } from '@viveeditor/ui'
import {
  aiAssistant,
  emojiMenu,
  footnoteTools,
  mathTools,
  mentionMenu,
  templateMenu,
} from '@viveeditor/ui/extras'
import 'katex/dist/katex.min.css'

const editor = await Editor.create(element, {
  extensions: [
    ...basicExtensions,
    Mention,
    MathExtension.configure({ load: () => import('katex') }),
    Footnote,
  ],
})

createUI(editor, {
  plugins: [
    mentionMenu({ items: (query, signal) => searchPeople(query, signal) }),
    emojiMenu({ load: () => import('@viveeditor/emoji-data/en') }),
    templateMenu([{ id: 'memo', label: 'Memo', content: '<h2>Subject</h2><p></p>' }]),
    mathTools(),
    footnoteTools(),
    aiAssistant({ provider: { generate: (request) => askMyServer(request) } }),
  ],
})
```

- **Mentions:** type `@`. The list comes from your `items` function and is shown as plain text. The editor stores `<span class="vive-mention" data-mention="id">@Name</span>`; ids must match `^[A-Za-z0-9_][A-Za-z0-9_.:@-]{0,127}$` without `..`. On the server, look the id up in your own directory, check that the writer may mention that person, build the displayed name from your data rather than the stored label, and keep ids opaque (not e-mail addresses). The search endpoint needs authentication, rate limits and tenant scoping; deduplicate and rate-limit the notifications you send.
- **Emoji:** type `:` and two letters. `@viveeditor/emoji-data/en` (about 39 KB, English names from Emojibase) loads on first use.
- **Formulas:** type `$x^2$`, or `$$` and Enter on an empty line, or pick "Formula" from the `/` menu. The editor stores the LaTeX source, never the drawing. KaTeX is yours to install and must be **0.18.2 or newer**; older versions are refused and the source is shown. On published pages, call `renderMath(root, { load: () => import('katex') })` from `@viveeditor/ext-math/render`.
- **Footnotes:** pick "Footnote" from the `/` menu and type the note in place. Notes keep bold, italic and links only. On published pages, `renderFootnotes(root)` from `@viveeditor/ext-footnote/render` numbers them and lists them at the end; printing does the same.
- **Templates:** `templateMenu` adds one `/` entry per template. Content goes through the editor schema, so scripts and unknown markup are dropped, but only offer templates you wrote or trust. Templates over 2 MB are skipped.
- **AI assistant:** select text and press the AI button in the selection bubble, Ctrl/⌘+J, or `/ai`. Your `provider.generate(request)` returns a string or an async iterable of strings. The answer is shown and inserted as plain text, never as HTML; nothing is applied until the writer chooses it, and one undo removes it. Selections over 20,000 characters, answers over 20,000 characters and requests longer than two minutes are cut off. viveEditor sends nothing anywhere itself.

### AI server checklist

The provider should call your own endpoint, never an AI vendor directly from the browser.
- Keep the API key on the server. Require a signed-in session and a CSRF token.
- Fix the system prompt, the model and `max_tokens` on the server. Accept only the actions you allow and limit the input size again.
- Set a quota and rate limit per user, and a spending cap at the AI vendor.
- Keep document text out of your logs, or mask it. Tell writers that their text is sent to a third party, as your privacy rules (KVKK, GDPR) require.
- If you later give the model tools or retrieval, prompt injection from the document becomes a serious risk; review that design separately.

## Packages

| Package                        | Description                                                        |
| ------------------------------ | ------------------------------------------------------------------ |
| `viveeditor`                   | One script that turns textareas into editors, with the toolbar     |
| `@viveeditor/core`             | Editor engine and extension system built on ProseMirror            |
| `@viveeditor/ui`               | Floating toolbar, selection bubble, `/` menu and panels            |
| `@viveeditor/ext-basic`        | Text formatting, links, headings, quotes, rules, line breaks       |
| `@viveeditor/ext-list`         | Bullet and ordered lists                                           |
| `@viveeditor/ext-format`       | Text alignment, text colour and highlight                          |
| `@viveeditor/ext-task-list`    | Checklists                                                         |
| `@viveeditor/ext-code-block`   | Code blocks with a language picker and optional syntax colouring   |
| `@viveeditor/ext-table`        | Tables with merged cells and column widths                         |
| `@viveeditor/ext-search`       | Find and replace that handles Turkish capitals                     |
| `@viveeditor/ext-image`        | Images with checked addresses, safe uploads and alt-text reminders |
| `@viveeditor/ext-embed`        | YouTube, Vimeo and Spotify players rebuilt from checked links      |
| `@viveeditor/ext-office-paste` | Clean paste from Word, Google Docs and LibreOffice with real lists |
| `@viveeditor/ext-mention`      | `@` mentions with checked ids                                      |
| `@viveeditor/ext-math`         | LaTeX formulas drawn by your own KaTeX                             |
| `@viveeditor/ext-footnote`     | Footnotes edited in place, numbered on published pages             |
| `@viveeditor/emoji-data`       | Compact emoji list for the emoji menu                              |
| `@viveeditor/markdown`         | Markdown import and export, and Markdown-aware paste               |
| `@viveeditor/docx`             | Word (`.docx`) import and export with limits for untrusted files   |
| `@viveeditor/react`            | React component and `useViveEditor` hook                           |
| `@viveeditor/vue`              | Vue component with `v-model` and `useViveEditor` composable        |
| `@viveeditor/svelte`           | Svelte component with `bind:value` and a `use:viveEditor` action   |
| `@viveeditor/angular`          | Angular component for `ngModel` and reactive forms                 |
| `@viveeditor/element`          | `<vive-editor>` form field for any page                            |
| `@viveeditor/sanitize`         | Server-side HTML cleaning for Node that matches the editor output  |
| `viveeditor/sanitizer` (PHP)   | The same sanitizer for PHP 8.4+, without dependencies              |
| `viveeditor/laravel` (PHP)     | Blade component, local editor files and `@viveHtml` for Laravel    |

## Versioning

All npm packages are released together with the same version number. viveEditor follows [semantic versioning](https://semver.org) with the usual 0.x rule:
- before 1.0, a breaking change can ship in a minor version (0.1 → 0.2) and is described in that release's notes; patch versions (0.1.0 → 0.1.1) never break;
- HTML and JSON saved by any 0.x version stay readable by every later 0.x version, so stored content never needs a migration;
- the public API of each package is recorded in `api/`, and a change there is visible in review.

Pin an exact version for the CDN script (`viveeditor@x.y.z`); its add-ons are checked against fingerprints built into that exact version.

## License

[MIT](./LICENSE)
