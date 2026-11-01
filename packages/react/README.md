# @viveeditor/react

React component for viveEditor with value/onChange, toolbar and every feature included.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/react viveeditor
```

## Usage

```tsx
import { ViveEditor } from '@viveeditor/react'
import 'viveeditor/style.css'

export function ArticleForm() {
  const [html, setHtml] = useState('')
  return <ViveEditor value={html} onChange={setHtml} locale="tr" label="Article body" />
}
```

React 18 and 19. The component is marked `'use client'`; `useViveEditor` gives you the editor instance for your own markup.

## License

MIT
