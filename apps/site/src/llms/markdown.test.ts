import { describe, expect, it } from 'vitest'
import { DOCS, docByKey } from '../docs/structure'
import { LOCALES, type Locale } from '../i18n'
import {
  type DocSource,
  docMarkdown,
  docMarkdownPath,
  llmsFull,
  llmsIndex,
  mdxToMarkdown,
} from './markdown'

const source = (
  key: DocSource['doc']['key'],
  body = 'Text.',
  faq: DocSource['faq'] = [],
): DocSource => ({
  doc: docByKey(key),
  title: key,
  description: `About ${key}.`,
  updated: new Date('2026-11-01T00:00:00Z'),
  faq,
  body,
})

const allSources = Object.fromEntries(
  LOCALES.map((l) => [l, DOCS.map((d) => source(d.key))]),
) as Record<Locale, DocSource[]>

describe('mdxToMarkdown', () => {
  it('drops the Steps wrapper and turns a Callout into a titled blockquote', () => {
    const body =
      '<Steps>\n1. One\n2. Two\n</Steps>\n\n<Callout type="tip" title="Uploads">\nReturn a URL.\n\nThen save.\n</Callout>'

    const md = mdxToMarkdown(body)

    expect(md).toBe('1. One\n2. Two\n\n> **Uploads**\n>\n> Return a URL.\n>\n> Then save.')
  })

  it('drops MDX imports', () => {
    const md = mdxToMarkdown("import Callout from '../Callout.astro'\n\nAfter.")

    expect(md).toBe('After.')
  })

  it('writes key runs as inline code and makes site links absolute', () => {
    const md = mdxToMarkdown(
      'Press <kbd>Ctrl</kbd>+<kbd>B</kbd> or <kbd>?</kbd>, see [Tables](/en/docs/tables/#merge).',
    )

    expect(md).toBe(
      'Press `Ctrl+B` or `?`, see [Tables](https://editor.vivepdf.com/en/docs/tables/#merge).',
    )
  })

  it('leaves fenced code untouched', () => {
    const body =
      "```js\n<Steps>\nimport { createEditor } from 'viveeditor'\n<kbd>x</kbd> [a](/b)\n```"

    const md = mdxToMarkdown(body)

    expect(md).toBe(body)
  })
})

describe('docMarkdown', () => {
  it('heads a page with its title, summary, address and date', () => {
    const md = docMarkdown(source('tables'), 'en')

    expect(
      md.startsWith(
        '# tables\n\n> About tables.\n\nURL: https://editor.vivepdf.com/en/docs/tables/\nLast updated: 2026-11-01\n\nText.',
      ),
    ).toBe(true)
  })

  it('appends the questions of a page', () => {
    const md = docMarkdown(source('faq', 'Intro.', [{ q: 'Is it free?', a: 'Yes.' }]), 'en')

    expect(md).toContain('## Is it free?\n\nYes.')
  })

  it('leaves the question block out when a page has none', () => {
    const md = docMarkdown(source('faq', 'Intro.'), 'tr')

    expect(md.endsWith('Intro.')).toBe(true)
  })
})

describe('llms.txt', () => {
  it('links the Markdown copy of every page in both languages', () => {
    const index = llmsIndex(allSources)

    for (const locale of LOCALES)
      for (const doc of DOCS)
        expect(index).toContain(
          `(https://editor.vivepdf.com${docMarkdownPath(locale, doc.slug[locale])})`,
        )
  })

  it('starts with the title and a one-line summary as the format expects', () => {
    const index = llmsIndex(allSources)

    expect(index).toMatch(/^# viveEditor\n\n> .+\n\n/)
  })

  it('puts the Markdown copy next to the page', () => {
    expect(docMarkdownPath('tr', 'tablolar')).toBe('/dokumantasyon/tablolar.md')
    expect(docMarkdownPath('en', 'tables')).toBe('/en/docs/tables.md')
  })

  it('joins every page of one language into the full file', () => {
    const full = llmsFull('en', allSources.en)

    expect(full.split('\n---\n')).toHaveLength(DOCS.length + 1)
  })
})
