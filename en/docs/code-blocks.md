# Code blocks

> Code blocks with a language picker, the default language list and optional Shiki syntax colouring, including a setup without WebAssembly.

URL: https://editor.vivepdf.com/en/docs/code-blocks/
Last updated: 2026-11-01

`@viveeditor/ext-code-block` adds code blocks with a language picker. Syntax colouring is optional: `CodeHighlight` loads the highlighter you give it only when the page has code, and colours never enter the saved HTML. This page covers the code block, the language list and colouring with Shiki.

## Setup

```ts
import { Editor } from '@viveeditor/core'
import { CodeBlock } from '@viveeditor/ext-code-block'
import { CodeHighlight, shikiHighlighter } from '@viveeditor/ext-code-block/highlight'
import '@viveeditor/ext-code-block/style.css'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [
    CodeBlock,
    CodeHighlight.configure({ highlighter: shikiHighlighter(() => import('shiki')) }),
  ],
})
```

The one-script build already includes the code block, without a highlighter.

| Option | Default | Description |
| --- | --- | --- |
| `languages` | `DEFAULT_LANGUAGES` | The languages in the picker. |
| `languageLabel` | `'Language'` | The accessible name of the picker. |
| `plainTextLabel` | `'Plain text'` | The option name for a block without a language. |
| `tabSize` | `2` | How many spaces `Tab` inserts. |

## Add a code block

- Type three backticks and a space at the start of a line. To set the language at once, type its name right after the backticks, such as `ts`, then a space.
- `Ctrl+Alt+C` (`⌘+⌥+C` on a Mac) turns the block on and off.
- Choose "Code block" from the block menu or the `/` menu.

If several paragraphs are selected when you turn on a code block, their lines join into one block. Turning the code block off makes each line a separate paragraph.

## Language picker

Each block has a language picker in its top corner. The first option is "Plain text", followed by the `languages` list. A valid language name that is not in the list (from pasted content, for example) is kept and appears in the picker under its own name.

A language name is made of letters, digits and `+ # . -`, is at most 32 characters long and is lowercased. The saved HTML carries the language in two places:

```html
<pre data-language="typescript"><code class="language-typescript">const a = 1</code></pre>
```

When content is loaded, the language is read from the `data-language` attribute or from a class that starts with `language-` or `lang-`.

### Default languages

`DEFAULT_LANGUAGES` holds 19 languages: JavaScript, TypeScript, HTML, CSS, JSON, Python, PHP, Java, Kotlin, Swift, C#, C++, Go, Rust, Ruby, SQL, Bash, YAML and Markdown. Their values are `javascript`, `typescript`, `html`, `css`, `json`, `python`, `php`, `java`, `kotlin`, `swift`, `csharp`, `cpp`, `go`, `rust`, `ruby`, `sql`, `bash`, `yaml` and `markdown`.

To add a language to the list:

```ts
import { CodeBlock, DEFAULT_LANGUAGES } from '@viveeditor/ext-code-block'

const codeBlock = CodeBlock.configure({
  languages: [...DEFAULT_LANGUAGES, { value: 'dart', label: 'Dart' }],
})
```

## Keyboard in a code block

- `Tab` inserts `tabSize` spaces at the cursor. With several lines selected, it indents each line.
- `Shift+Tab` removes spaces at the start of the line.
- `Enter` starts a new line inside the block. Press `Enter` three times in a row at the end of the block to remove the trailing empty lines and continue in a new paragraph.
- `Backspace` in an empty block turns it into a paragraph.
- `Esc` and then `Tab` moves focus out of the editor.

Commands: `toggleCodeBlock(language)`, `setCodeBlockLanguage(language)`. `editor.query.codeBlockLanguage()` returns the language of the block at the cursor.

## Syntax colouring

`CodeHighlight` colours only blocks that have a language. It loads the highlighter the first time such a block is on the page, caches the results and applies the colours only to the editor view, never to the saved HTML.

| Option | Default | Description |
| --- | --- | --- |
| `highlighter` | `null` | The highlighter function. Without it, nothing is coloured. |
| `delay` | `120` | How many milliseconds after a typing pause colouring runs. |
| `cacheSize` | `200` | How many blocks the cache keeps. |

`shikiHighlighter(load, options)` is a ready bridge for [Shiki](https://shiki.style). The default themes are `github-light-default` and `github-dark-default`; pass `{ themes: { light, dark } }` for others. Colours follow the light and dark theme of the interface. If Shiki does not know a language or fails, that block stays uncoloured.

You can also write your own highlighter: a function that takes `(code, language)` and returns `{ from, to, style }` pieces is enough.

### When your CSP does not allow WebAssembly

Shiki's default regular expression engine uses WebAssembly. If your page's Content Security Policy does not allow WebAssembly, set up Shiki with its JavaScript regular expression engine and pass it to `shikiHighlighter`. `shikiHighlighter` only needs a `codeToTokens` method on the loaded object:

```ts
import { CodeHighlight, shikiHighlighter } from '@viveeditor/ext-code-block/highlight'

const loadShiki = async () => {
  const { createHighlighterCore } = await import('shiki/core')
  const { createJavaScriptRegexEngine } = await import('shiki/engine/javascript')
  return createHighlighterCore({
    themes: [
      import('shiki/themes/github-light-default.mjs'),
      import('shiki/themes/github-dark-default.mjs'),
    ],
    langs: [import('shiki/langs/javascript.mjs'), import('shiki/langs/typescript.mjs')],
    engine: createJavaScriptRegexEngine(),
  })
}

const highlight = CodeHighlight.configure({ highlighter: shikiHighlighter(loadShiki) })
```

With this setup only the languages you load in `langs` are coloured; the others stay plain. The themes must be the `shikiHighlighter` defaults or match its `themes` option.

## Code blocks in files

Saving to Markdown writes code blocks as fenced blocks with their language, and opening Markdown reads them back. A Word file keeps the code but not its language. See [Open, save and print](https://editor.vivepdf.com/en/docs/open-save-print/).

To show colours on the published page, run a highlighter there as well; the language is in the `class` attribute.

## Do the colours end up in the saved HTML?

No. Colouring is shown only inside the editor. The saved HTML carries the language, not the colours.

## What happens to a language that is not in the list?

A valid language name in pasted or loaded content is kept and appears in the picker under its own name. You can also replace the list with the languages option.

## Can I use code blocks without colouring?

Yes. CodeHighlight is optional. The code block in the one-script build also comes without a highlighter.
