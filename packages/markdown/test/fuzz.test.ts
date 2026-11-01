import { Editor, type Extension } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { CodeBlock } from '@viveeditor/ext-code-block'
import { formatExtensions } from '@viveeditor/ext-format'
import { Image } from '@viveeditor/ext-image'
import { listExtensions } from '@viveeditor/ext-list'
import { Table } from '@viveeditor/ext-table'
import { taskListExtensions } from '@viveeditor/ext-task-list'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { markdownToHtml, toMarkdown } from '../src/index.js'

const RUNS = Number(process.env.FUZZ_RUNS ?? 200)
const SEED = 20_261_031
const TIMEOUT = 10_000 + RUNS * 100

const rich: readonly Extension[] = [
  ...basicExtensions,
  ...listExtensions,
  ...formatExtensions,
  ...taskListExtensions,
  CodeBlock,
  Table,
  Image,
]

const OUTPUT_TAGS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'strong',
  'em',
  's',
  'a',
  'img',
  'hr',
  'br',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
])
const OUTPUT_ATTRIBUTES = new Set([
  'href',
  'src',
  'alt',
  'title',
  'start',
  'class',
  'style',
  'data-type',
  'data-checked',
])
const UNSAFE_URL = /^\s*(?:javascript|vbscript|data):/i

const PREFIXES = ['', '', '# ', '### ', '- ', '* ', '1. ', '3) ', '> ', '- [ ] ', '- [x] ', '    ']
const PIECES = [
  'metin',
  'ğüşıöç',
  ' ',
  '**kalın**',
  '_italik_',
  '~~eski~~',
  '`kod`',
  '[bağ](https://example.com)',
  '[kötü](javascript:alert(1))',
  '![g](https://example.com/a.png)',
  '![g](data:image/svg+xml;base64,PHN2Zz4=)',
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '|a|b|',
  '| --- | --- |',
  '```js',
  '```',
  '---',
  '\\',
  '*',
  '_',
  '`',
  '$x$',
  '[^1]',
  '&amp;',
  '&#0;',
]

const line = fc
  .tuple(fc.constantFrom(...PREFIXES), fc.array(fc.constantFrom(...PIECES), { maxLength: 4 }))
  .map(([prefix, pieces]) => `${prefix}${pieces.join('')}`)
const markdown = fc.array(line, { maxLength: 8 }).map((lines) => lines.join('\n'))

async function exported(source: string): Promise<string> {
  const root = document.createElement('div')
  document.body.append(root)
  const editor = await Editor.create(root, { extensions: rich, content: markdownToHtml(source) })
  const output = toMarkdown(editor)
  editor.destroy()
  root.remove()
  return output
}

function strayParts(html: string): string[] {
  const body = new DOMParser().parseFromString(html, 'text/html').body
  return [...body.querySelectorAll('*')].flatMap((element) => [
    ...(OUTPUT_TAGS.has(element.localName) ? [] : [`tag ${element.localName}`]),
    ...element
      .getAttributeNames()
      .filter(
        (name) =>
          !OUTPUT_ATTRIBUTES.has(name) ||
          ((name === 'href' || name === 'src') &&
            UNSAFE_URL.test(element.getAttribute(name) ?? '')),
      )
      .map((name) => `${name} on ${element.localName}`),
  ])
}

describe('markdown on generated input', () => {
  it(
    'renders only known tags, attributes and safe URLs',
    () => {
      fc.assert(
        fc.property(markdown, (source) => {
          const html = markdownToHtml(source)

          expect(strayParts(html)).toEqual([])
        }),
        { seed: SEED, numRuns: RUNS },
      )
    },
    TIMEOUT,
  )

  it(
    'settles on stable Markdown after one export and import',
    async () => {
      await fc.assert(
        fc.asyncProperty(markdown, async (source) => {
          const second = await exported(await exported(source))

          const third = await exported(second)

          expect(third).toBe(second)
        }),
        { seed: SEED, numRuns: RUNS },
      )
    },
    TIMEOUT,
  )
})
