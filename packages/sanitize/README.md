# @viveeditor/sanitize

Server-side sanitizer that keeps exactly the HTML viveEditor produces and removes everything else.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/sanitize
```

## Usage

```ts
import { sanitizeHtml } from '@viveeditor/sanitize'

const clean = sanitizeHtml(request.body.html, { embeds: true })
```

Keeps exactly the HTML viveEditor produces and removes everything else, using a full HTML5 parser. HTML over `maxBytes` (2 MB by default) throws `TOO_LARGE`, hostile structure throws `TOO_COMPLEX`. The PHP package `viveeditor/sanitizer` shares the same allowlist and test corpus. See [Sanitize on the server](https://github.com/mtvrkan/viveeditor#sanitize-on-the-server).

## License

MIT
