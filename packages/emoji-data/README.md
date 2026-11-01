# @viveeditor/emoji-data

Compact emoji list for the viveEditor emoji menu, generated from Emojibase.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/emoji-data
```

## Usage

```ts
import { emojiMenu } from '@viveeditor/ui/extras'

createUI(editor, {
  plugins: [emojiMenu({ load: () => import('@viveeditor/emoji-data/en') })],
})
```

A compact English emoji list (about 39 KB) generated from [Emojibase](https://github.com/milesj/emojibase); it loads on first use. See `NOTICE` for third-party licences.

## License

MIT
