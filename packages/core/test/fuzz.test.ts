import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ALLOWED_PROTOCOLS,
  Editor,
  type EditorContent,
  isAllowedUrl,
  ViveEditorError,
} from '../src/index.js'
import { TestMarks } from './fixtures.js'

const RUNS = Number(process.env.FUZZ_RUNS ?? 200)
const SEED = 20_261_031
const TIMEOUT = 10_000 + RUNS * 100

async function htmlOf(content: EditorContent): Promise<string> {
  const element = document.createElement('div')
  document.body.append(element)
  try {
    const editor = await Editor.create(element, { extensions: [TestMarks], content })
    const html = editor.getHTML()
    editor.destroy()
    return html
  } finally {
    element.remove()
  }
}

const TAGS = ['p', 'b', 'strong', 'i', 'em', 'span', 'div', 'h1', 'ul', 'li', 'table', 'td', 'pre']
const TEXTS = ['metin', ' ', '  ', '\n', '\t', '&amp;', '&lt;', 'ğüşıöç', ' ', '😀', '']

const { html } = fc.letrec<{ html: string; node: string }>((tie) => ({
  html: fc.array(tie('node'), { maxLength: 4 }).map((parts) => parts.join('')),
  node: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.constantFrom(...TEXTS),
    fc
      .tuple(fc.constantFrom(...TAGS), tie('html'))
      .map(([tag, inner]) => `<${tag}>${inner}</${tag}>`),
  ),
}))

const INVISIBLE = ['', ' ', '\t', '\n', '\u0000', '\u001f', '­', '​', ' ', '﻿']
const SCHEMES = ['javascript', 'JaVaScRiPt', 'vbscript', 'data', 'file', 'http', 'https', 'mailto']

const url = fc
  .tuple(
    fc.constantFrom(...INVISIBLE),
    fc.constantFrom(...SCHEMES),
    fc.array(fc.tuple(fc.nat(), fc.constantFrom(...INVISIBLE)), { maxLength: 3 }),
    fc.constantFrom(':', '&#58;', '%3a'),
    fc.constantFrom('alert(1)', '//example.com/a', 'a@example.com', ''),
  )
  .map(([lead, scheme, inserts, colon, rest]) => {
    const letters = [...scheme]
    for (const [position, character] of inserts) {
      letters.splice(position % (letters.length + 1), 0, character)
    }
    return `${lead}${letters.join('')}${colon}${rest}`
  })

describe('Editor content on generated input', () => {
  it(
    'settles on a stable HTML form after one reload',
    async () => {
      await fc.assert(
        fc.asyncProperty(html, async (input) => {
          const second = await htmlOf(await htmlOf(input))

          const third = await htmlOf(second)

          expect(third).toBe(second)
        }),
        { seed: SEED, numRuns: RUNS },
      )
    },
    TIMEOUT,
  )

  it(
    'rejects malformed JSON content only with INVALID_CONTENT',
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.jsonValue({ maxDepth: 4 }), async (value) => {
          const content = { type: 'doc', content: [value] } as never

          const outcome = await htmlOf(content).then(
            () => 'loaded',
            (error: unknown) => error,
          )

          if (outcome !== 'loaded') {
            expect(outcome).toBeInstanceOf(ViveEditorError)
            expect(outcome).toMatchObject({ code: 'INVALID_CONTENT' })
          }
        }),
        { seed: SEED, numRuns: RUNS },
      )
    },
    TIMEOUT,
  )
})

describe('isAllowedUrl on generated URLs', () => {
  it('only accepts URLs that a browser resolves to an allowed protocol', () => {
    fc.assert(
      fc.property(url, (input) => {
        const allowed = isAllowedUrl(input)

        const parsed = URL.parse(input, 'https://base.example/')

        if (allowed && parsed)
          expect(DEFAULT_ALLOWED_PROTOCOLS).toContain(parsed.protocol.slice(0, -1))
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })
})
