# viveeditor

Free, open-source rich text editor that drops into any website. One script tag turns a textarea into an editor.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install viveeditor
```

## Usage

No build step:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/viveeditor@x.y.z/dist/viveeditor.css" />
<script src="https://cdn.jsdelivr.net/npm/viveeditor@x.y.z/dist/viveeditor.classic.iife.js"></script>

<textarea name="body" data-editor required></textarea>
```

Replace `x.y.z` with the exact version you use. With a bundler:

```ts
import { upgradeAll } from 'viveeditor'
import 'viveeditor/style.css'

upgradeAll()
```

Every `<textarea data-editor>` becomes an editor with the toolbar; forms post clean HTML under the textarea's name. Always sanitize it again on the server.

## License

MIT
