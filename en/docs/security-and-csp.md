# Security and CSP

> How viveEditor keeps unsafe markup out, why you sanitize again on the server, and the CSP settings the CDN script needs.

URL: https://editor.vivepdf.com/en/docs/security-and-csp/
Last updated: 2026-11-01

viveEditor protects you in two layers: the editor only produces a known set of HTML, and your server cleans every posted document again. This page explains both layers, the Content Security Policy settings the CDN script and its add-ons need, and how to report a vulnerability.

## What the editor checks

The document schema is an allowlist. Markup it does not know never reaches the output. Typed text, pasted HTML, opened files and templates all go through the same rules.

- Links accept only allowed protocols: `http`, `https`, `mailto` and `tel`.
- Every address is checked when content is loaded and again when it is written out, because JSON content skips the HTML parser.
- A `style` attribute only carries values the editor wrote, such as a checked colour or an alignment.
- Images need `https` addresses. `data:` addresses work only with `allowBase64`, and SVG never does. `javascript:`, `vbscript:`, `file:`, `blob:` and `filesystem:` are always refused.
- Video players never keep the address they were given. The editor stores the provider and the video id and rebuilds the player address with a fixed `sandbox`, `allow` and `referrerpolicy`.
- AI answers and mention names are shown and inserted as plain text, never as HTML. A mention id never becomes a link.

## Sanitize again on the server

The browser is not a security boundary. Anyone can post any HTML to your server, so clean it there before you store or show it. `@viveeditor/sanitize` for Node and `viveeditor/sanitizer` for PHP keep exactly what the editor produces and remove everything else.

```ts
import { sanitizeHtml } from '@viveeditor/sanitize'

const clean = sanitizeHtml(request.body.html, { embeds: true })
```

Clean when you save, and print stored HTML through a cleaning helper too, so rows written before you added cleaning stay safe. Options, limits and errors are on [Server sanitizing](https://editor.vivepdf.com/en/docs/server-sanitizing/).

## Content Security Policy

### The CDN script and its add-ons

The CDN script loads three add-ons on first use from its own folder: `viveeditor.docx.iife.js`, `viveeditor.markdown.iife.js` and `viveeditor.panels.iife.js`. Each one is checked against a `sha384` fingerprint built into the main script.

- `script-src` must allow the folder that holds the scripts, for example `https://cdn.jsdelivr.net/npm/viveeditor@x.y.z/dist/` with your exact version.
- If you use a `nonce`, put it on the main script. It is copied to the add-ons.
- With Trusted Types enforced, add the policy name `viveeditor` to the `trusted-types` directive. The policy allows only the add-on addresses.
- If you host the files yourself, keep the file names and serve them with `Access-Control-Allow-Origin`, so the fingerprint check can run.
- The folder is taken from the main script's own address, which must be named `viveeditor.classic.iife.js` and served over `http` or `https`.

```html
<script
  nonce="r4nd0m"
  src="https://cdn.jsdelivr.net/npm/viveeditor@x.y.z/dist/viveeditor.classic.iife.js"
></script>
```

Replace `x.y.z` with your exact version, and the nonce with the value your server generates for each response. With npm and a bundler there are no add-ons; the converters and panels load from your own build. The Laravel package serves the editor files from your own `public/vendor/viveeditor`, and its tags get the nonce when you use `Vite::useCspNonce()`.

### Images: `img-src`

Restrict `img-src` to the hosts that serve your uploads and the image hosts you accept. By default, images pasted from other sites keep their original address (`remoteImages: 'allow'`), and showing them tells that site who read the page and when. For a hardened setup use `'drop'` or `'rehost'`; see [Images and uploads](https://editor.vivepdf.com/en/docs/images-and-uploads/).

### Video embeds: `frame-src`

List only the providers you enabled:

- YouTube: `https://www.youtube-nocookie.com`
- Vimeo: `https://player.vimeo.com`
- Spotify: `https://open.spotify.com`

A page-wide `Referrer-Policy: no-referrer` stops YouTube players from working. On the server, never allow every `iframe`; rebuild players from `div[data-embed]`, or accept only addresses for which `isAllowedEmbedSrc()` returns true. More on [Video embeds](https://editor.vivepdf.com/en/docs/video-embeds/).

### Styles: `style-src`

Text colour, highlight, alignment and table column widths are written as `style` attributes, both in the editor and in the saved HTML. A `style-src` without `'unsafe-inline'` makes the browser ignore those attributes, so the colours and widths disappear. Allow `'unsafe-inline'` in `style-src` on pages that show or edit content, and keep `script-src` strict.

### Printing

Printing uses a hidden frame without scripts that loads only images and styles. It is sandboxed without `allow-scripts` and carries its own CSP.

## Uploads

The editor checks every image address and file before it reaches the document, but your upload endpoint must still:

- re-validate and re-encode every upload, which strips EXIF and GPS data and polyglot files, and return the real width and height;
- serve uploads from a cookieless domain with a server-set `Content-Type` and `X-Content-Type-Options: nosniff`;
- require authentication, a CSRF token and a rate limit;
- guard against SSRF if it fetches remote images.

## Report a vulnerability

Report vulnerabilities privately through GitHub's "Report a vulnerability" button on the [Security tab](https://github.com/mtvrkan/viveeditor/security) of the repository. Do not open a public issue.

1. Name the affected package and version.
2. Add a minimal reproduction.
3. Describe the impact you observed.

You will receive an acknowledgement, and the fix will be coordinated with you before public disclosure. Until 1.0, only the latest published minor version receives security fixes. The fix ships as a patch release of every package, because all packages share one version number.

Of particular interest is any way to get script execution, event handlers, `javascript:` URLs or unsanitized markup into the editor's output. The server sanitizers are in scope too. The full policy is in [SECURITY.md](https://github.com/mtvrkan/viveeditor/blob/main/SECURITY.md).
