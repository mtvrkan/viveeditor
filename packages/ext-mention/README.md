# @viveeditor/ext-mention

@mentions for viveEditor: an inline node that stores an opaque id and a plain-text label.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/ext-mention @viveeditor/core
```

## Usage

```ts
import { Editor } from '@viveeditor/core'
import '@viveeditor/core/style.css'
import { Mention } from '@viveeditor/ext-mention'
import '@viveeditor/ext-mention/style.css'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [Mention],
})

editor.commands.insertMention({ id: 'u_42', label: 'Ayşe' })
```

The menu comes from `mentionMenu` in `@viveeditor/ui/extras`. Ids must match `MENTION_ID_PATTERN`; on the server, look ids up in your own directory and build the displayed name from your data. See [Extras](https://github.com/mtvrkan/viveeditor#extras-npm).

## License

MIT
