import { Editor, type Extension } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { formatExtensions } from '@viveeditor/ext-format'
import { listExtensions } from '@viveeditor/ext-list'
import fc from 'fast-check'
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { DocxError, exportDocx, importDocx } from '../src/index.js'

const RUNS = Number(process.env.FUZZ_RUNS ?? 200)
const SEED = 20_261_031
const TIMEOUT = 10_000 + RUNS * 100

const extensions: readonly Extension[] = [
  ...basicExtensions,
  ...listExtensions,
  ...formatExtensions,
]
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

const WORDS = [
  'metin',
  'ğüşıöç',
  'İSTANBUL',
  '😀',
  '&',
  '<b>',
  '"',
  "'",
  ']]>',
  '1.',
  '-',
  ' ',
  '  ',
]
const MARKS = [[], ['strong'], ['em'], ['u'], ['s'], ['strong', 'em']]
const BLOCKS = ['p', 'h1', 'h3', 'blockquote', 'ul', 'ol']

const escapeHtml = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const inline = fc
  .tuple(
    fc.array(fc.constantFrom(...WORDS), { minLength: 1, maxLength: 4 }),
    fc.constantFrom(...MARKS),
  )
  .map(([words, marks]) =>
    marks.reduceRight((inner, mark) => `<${mark}>${inner}</${mark}>`, escapeHtml(words.join(''))),
  )

const block = fc
  .tuple(fc.constantFrom(...BLOCKS), fc.array(inline, { minLength: 1, maxLength: 3 }))
  .map(([tag, parts]) => {
    const paragraph = `<p>${parts.join('')}</p>`
    if (tag === 'p') return paragraph
    if (tag === 'blockquote') return `<blockquote>${paragraph}</blockquote>`
    if (tag === 'ul' || tag === 'ol') return `<${tag}><li>${paragraph}</li></${tag}>`
    return `<${tag}>${parts.join('')}</${tag}>`
  })

const html = fc.array(block, { minLength: 1, maxLength: 5 }).map((blocks) => blocks.join(''))

async function withEditor<T>(content: string, use: (editor: Editor) => Promise<T>): Promise<T> {
  const root = document.createElement('div')
  document.body.append(root)
  const editor = await Editor.create(root, { extensions, content })
  try {
    return await use(editor)
  } finally {
    editor.destroy()
    root.remove()
  }
}

function sampleDocx(): Uint8Array {
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types/>'),
    '_rels/.rels': strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/></Relationships>`,
    ),
    'word/document.xml': strToU8(
      `<w:document xmlns:w="${W}" xmlns:r="${R}"><w:body><w:p><w:r><w:t>Merhaba</w:t></w:r></w:p></w:body></w:document>`,
    ),
  })
}

async function outcome(bytes: Uint8Array): Promise<unknown> {
  try {
    await importDocx(new Blob([bytes as BlobPart]))
    return 'loaded'
  } catch (error) {
    return error
  }
}

describe('Word export and import on generated documents', () => {
  it(
    'keeps the text of the document after writing and reading it',
    async () => {
      await fc.assert(
        fc.asyncProperty(html, async (source) => {
          const [text, file] = await withEditor(source, async (editor) => [
            editor.getText(),
            await exportDocx(editor),
          ])

          const result = await importDocx(file)

          expect(await withEditor(result.html, async (editor) => editor.getText())).toBe(text)
        }),
        { seed: SEED, numRuns: RUNS },
      )
    },
    TIMEOUT,
  )
})

describe('importDocx on broken files', () => {
  it(
    'rejects random bytes only with DocxError',
    async () => {
      await fc.assert(
        fc.asyncProperty(fc.uint8Array({ maxLength: 2048 }), async (bytes) => {
          const result = await outcome(bytes)

          if (result !== 'loaded') expect(result).toBeInstanceOf(DocxError)
        }),
        { seed: SEED, numRuns: RUNS },
      )
    },
    TIMEOUT,
  )

  it(
    'reads or rejects a damaged zip with DocxError',
    async () => {
      const original = sampleDocx()
      const damage = fc.array(
        fc.tuple(fc.nat(original.length - 1), fc.integer({ min: 0, max: 255 })),
        {
          minLength: 1,
          maxLength: 8,
        },
      )
      const cut = fc.integer({ min: 0, max: original.length })

      await fc.assert(
        fc.asyncProperty(damage, cut, async (changes, length) => {
          const bytes = original.slice(0, Math.max(length, 1))
          for (const [position, value] of changes) {
            if (position < bytes.length) bytes[position] = value
          }

          const result = await outcome(bytes)

          if (result !== 'loaded') expect(result).toBeInstanceOf(DocxError)
        }),
        { seed: SEED, numRuns: RUNS },
      )
    },
    TIMEOUT,
  )
})
