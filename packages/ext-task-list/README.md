# @viveeditor/ext-task-list

Task list (checklist) extension for viveEditor.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/ext-task-list @viveeditor/core
```

## Usage

```ts
import { Editor } from '@viveeditor/core'
import '@viveeditor/core/style.css'
import { taskListExtensions } from '@viveeditor/ext-task-list'
import '@viveeditor/ext-task-list/style.css'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [...taskListExtensions],
})
```

Type `[ ]` or `[x]` to start a checklist; Ctrl/⌘+Enter ticks an item. Saved HTML shows a disabled checkbox on any site.

## License

MIT
