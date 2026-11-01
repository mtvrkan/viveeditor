# @viveeditor/ext-math

LaTeX formulas for viveEditor, rendered with a KaTeX copy the site loads on demand.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/ext-math @viveeditor/core katex
```

## Usage

```ts
import { Editor } from '@viveeditor/core'
import '@viveeditor/core/style.css'
import { MathExtension } from '@viveeditor/ext-math'
import '@viveeditor/ext-math/style.css'
import 'katex/dist/katex.min.css'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [MathExtension.configure({ load: () => import('katex') })],
})
```

The editor stores the LaTeX source. KaTeX **0.18.2 or newer** is required; older versions are refused. On published pages call `renderMath(root, { load: () => import('katex') })` from `@viveeditor/ext-math/render`.

## License

MIT
