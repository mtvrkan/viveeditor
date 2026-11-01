import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { listExtensions } from '@viveeditor/ext-list'
import fc from 'fast-check'
import type { EditorView } from 'prosemirror-view'
import { describe, expect, it } from 'vitest'
import { cleanOfficeHtml, OfficePaste } from '../src/index.js'

const RUNS = Number(process.env.FUZZ_RUNS ?? 200)
const SEED = 20_261_031
const TIMEOUT = 10_000 + RUNS * 100

const WORD_HEAD =
  '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta name=Generator content="Microsoft Word 15"><style>'
const STYLE_RULES = [
  '@list l0:level1 {mso-level-number-format:bullet;}',
  '@list l1:level2 {mso-level-start-at:7;}',
  '@list l2:level1 {mso-level-number-format:alpha-lower;}',
  '@list l3:level9 {',
  'p.MsoNormal {margin:0cm;}',
  '}',
]
const MARKERS = ['·', 'o', '§', '1.', '7)', 'a.', 'iv.', '-', '']
const TEXTS = [
  'Bir',
  'ğüşıöç',
  '&nbsp;',
  '<b>kalın</b>',
  '<i>eğik</i>',
  '<span style="color:red">x</span>',
  '',
]
const OPENERS = ['<![if !supportLists]>', '<!--[if !supportLists]-->']
const CLOSERS = ['<![endif]>', '<!--[endif]-->', '']

const listItem = fc
  .record({
    list: fc.constantFrom('l0', 'l1', 'l2', 'l3', 'l9'),
    level: fc.integer({ min: 0, max: 12 }),
    tag: fc.constantFrom('p', 'h2', 'p'),
    marker: fc.constantFrom(...MARKERS),
    opener: fc.constantFrom(...OPENERS),
    closer: fc.constantFrom(...CLOSERS),
    ignore: fc.boolean(),
    text: fc.constantFrom(...TEXTS),
  })
  .map(({ list, level, tag, marker, opener, closer, ignore, text }) => {
    const markerHtml = ignore ? `<span style='mso-list:Ignore'>${marker}</span>` : marker
    return `<${tag} class=MsoListParagraph style='mso-list:${list} level${level} lfo1'>${opener}<span>${markerHtml}</span>${closer}${text}</${tag}>`
  })

const plain = fc
  .tuple(
    fc.constantFrom('p class=MsoNormal', 'p class=MsoTitle', 'p class=MsoQuote', 'ul', 'li'),
    fc.constantFrom(...TEXTS),
  )
  .map(([open, text]) => `<${open}>${text}</${open.split(' ')[0]}>`)

const wordHtml = fc
  .tuple(
    fc.array(fc.constantFrom(...STYLE_RULES), { maxLength: 6 }),
    fc.array(fc.oneof(listItem, plain), { maxLength: 10 }),
  )
  .map(
    ([rules, body]) =>
      `${WORD_HEAD}${rules.join('\n')}</style></head><body>${body.join('')}</body></html>`,
  )

const docsHtml = fc
  .array(
    fc.constantFrom(
      '<ul><li><p>bir</p></li><ul><li><p>iki</p></li></ul></ul>',
      '<p><span style="text-decoration:underline line-through">çizik</span></p>',
      '<ol><ol><li>derin</li></ol></ol>',
      '<p dir="ltr"><span style="font-weight:700">kalın</span></p>',
    ),
    { maxLength: 6 },
  )
  .map((parts) => `<meta charset="utf-8"><b id="docs-internal-guid-1a2b">${parts.join('')}</b>`)

async function pasted(html: string): Promise<string> {
  const root = document.createElement('div')
  document.body.append(root)
  const editor = await Editor.create(root, {
    extensions: [...basicExtensions, ...listExtensions, OfficePaste],
  })
  try {
    const view = (editor as unknown as { view: EditorView }).view
    view.pasteHTML(html, new Event('paste') as ClipboardEvent)
    view.state.doc.check()
    return editor.getHTML()
  } finally {
    editor.destroy()
    root.remove()
  }
}

describe('Office paste on generated clipboard HTML', () => {
  it('cleans Word and Docs HTML without throwing', () => {
    fc.assert(
      fc.property(fc.oneof(wordHtml, docsHtml), (html) => {
        expect(typeof cleanOfficeHtml(html)).toBe('string')
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  it(
    'pastes Word and Docs HTML into a document that fits the schema',
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.oneof(wordHtml, docsHtml), async (html) => {
          const result = await pasted(html)

          expect(result).not.toMatch(/mso-|<!--|\[if /i)
        }),
        { seed: SEED, numRuns: RUNS },
      )
    },
    TIMEOUT,
  )
})
