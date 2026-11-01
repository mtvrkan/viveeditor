# Installation

> Add viveEditor with one CDN script or from npm, pick the packages you need and load the right stylesheets.

URL: https://editor.vivepdf.com/en/docs/installation/
Last updated: 2026-11-01

You can add viveEditor to a page with one script from a CDN, or install it from npm and build it with your bundler. This page shows both ways, which packages to choose and which stylesheets to load.

## With a CDN script

This needs no build step. Load the stylesheet and the script, then mark a textarea with `data-editor`:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/viveeditor@x.y.z/dist/viveeditor.css" />
<script src="https://cdn.jsdelivr.net/npm/viveeditor@x.y.z/dist/viveeditor.classic.iife.js"></script>

<form method="post">
  <label for="body">Article</label>
  <textarea id="body" name="body" data-editor required></textarea>
</form>
```

Replace `x.y.z` with the exact version you use. When the page is ready, the script turns every `textarea[data-editor]` into an editor with the toolbar and exposes `window.ViveEditor`. The form posts clean HTML under the textarea's name. Always sanitize it again on the server.

The script carries basic formatting, lists, alignment and colours, checklists, code blocks (without syntax colouring), tables, find and replace, images (by address, no uploader), video embeds and clean paste from Office. Mentions, emoji, formulas, footnotes, templates and the AI assistant are npm only, and so is the `<vive-editor>` element.

> **Keep the exact version and the file names**
>
> The Word and Markdown converters and the panels live in extra files next to the main script: `viveeditor.docx.iife.js`, `viveeditor.markdown.iife.js` and `viveeditor.panels.iife.js`. They load on first use from the same folder and are checked against `sha384` fingerprints built into that exact version. Short addresses such as `cdn.jsdelivr.net/npm/viveeditor`, or renamed and combined scripts, cannot find them.

If your site has a Content Security Policy, read [Security and CSP](https://editor.vivepdf.com/en/docs/security-and-csp/) before you go live.

## With npm

### Everything in one package

The `viveeditor` package holds the same editor as the CDN script:

```sh
npm install viveeditor
```

```ts
import { upgradeAll } from 'viveeditor'
import 'viveeditor/style.css'

upgradeAll()
```

With a bundler there are no CDN add-ons. To get Word and Markdown in the File menu, pass the converters as loaders; see [Open, save and print](https://editor.vivepdf.com/en/docs/open-save-print/).

### A framework component

React, Vue, Svelte and Angular each have a component package that you install next to `viveeditor`:

```sh
npm install @viveeditor/react viveeditor
```

Use `@viveeditor/vue`, `@viveeditor/svelte` or `@viveeditor/angular` in the same way. For any page there is also `@viveeditor/element`, a `<vive-editor>` form field. Details are on [Frameworks](https://editor.vivepdf.com/en/docs/frameworks/).

### Only the parts you need

Every feature is a separate package. `@viveeditor/core` is the engine and has no toolbar; add `@viveeditor/ui` for one:

```sh
npm install @viveeditor/core @viveeditor/ext-basic @viveeditor/ext-list @viveeditor/ui
```

The full list is on [Packages](https://editor.vivepdf.com/en/docs/packages/).

## Stylesheets

- CDN: `viveeditor.css` from the same version folder as the script.
- `viveeditor` and the framework components: `import 'viveeditor/style.css'` once.
- Angular: add `node_modules/viveeditor/dist/viveeditor.css` to `styles` in `angular.json`.
- Your own selection of packages: `@viveeditor/core/style.css`, `@viveeditor/ui/style.css` if you use the toolbar, and the `style.css` of each extension that has one: `ext-code-block`, `ext-embed`, `ext-footnote`, `ext-image`, `ext-math`, `ext-mention`, `ext-search`, `ext-table` and `ext-task-list`.

```ts
import '@viveeditor/core/style.css'
import '@viveeditor/ui/style.css'
import '@viveeditor/ext-table/style.css'
```

Formulas also need KaTeX's own stylesheet, `katex/dist/katex.min.css`.

## Requirements

- Node.js 20.19 or newer for your build tools. The npm packages declare it in `engines`.
- React 18 or 19, Vue 3.5, Svelte 5, or Angular 21 or 22 for the component packages.
- KaTeX 0.18.2 or newer if you use formulas. Older versions are refused.
- PHP 8.4 or newer for `viveeditor/sanitizer`, and Laravel 12 or newer for `viveeditor/laravel`.

## Pin the version

All npm packages are released together with the same version number, so install every viveEditor package at the same version. For the CDN script, always write the exact version (`viveeditor@x.y.z`); its add-ons are checked against fingerprints built into that version. Before 1.0 a minor version can contain breaking changes; see [Versioning](https://editor.vivepdf.com/en/docs/versioning/).

## Next steps

- [Your first editor](https://editor.vivepdf.com/en/docs/first-editor/): textarea, `mountEditor` or `Editor.create`.
- [Server sanitizing](https://editor.vivepdf.com/en/docs/server-sanitizing/): clean the posted HTML before you store it.
