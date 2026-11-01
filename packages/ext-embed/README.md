# @viveeditor/ext-embed

Video and audio embeds for viveEditor with a provider allowlist and privacy-first previews.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/ext-embed @viveeditor/core
```

## Usage

```ts
import { Editor } from '@viveeditor/core'
import '@viveeditor/core/style.css'
import { Embed } from '@viveeditor/ext-embed'
import '@viveeditor/ext-embed/style.css'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [Embed.configure({ providers: ['youtube', 'vimeo'], facade: true })],
})
```

YouTube, Vimeo and Spotify players from a pasted link. Nothing loads from the provider until play is pressed, and saved HTML stores only the provider and id. With `facade: true`, call `activateEmbeds()` from `@viveeditor/ext-embed/activate` on the page that shows the content. See [Video and audio embeds](https://github.com/mtvrkan/viveeditor#video-and-audio-embeds).

## License

MIT
