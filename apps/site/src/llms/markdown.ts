import { DOC_GROUPS, type DocEntry, type Faq } from '../docs/structure'
import {
  absoluteUrl,
  docPath,
  docsIndexPath,
  homePath,
  ISSUES_URL,
  type Locale,
  NPM_URL,
  REPO_URL,
} from '../i18n'
import { UI } from '../i18n/ui'

export type DocSource = {
  doc: DocEntry
  title: string
  description: string
  updated: Date
  faq: Faq
  body: string
}

export const LLMS_FULL_PATH: Record<Locale, string> = {
  tr: '/llms-full-tr.txt',
  en: '/llms-full.txt',
}

export function docMarkdownPath(locale: Locale, slug: string): string {
  return docPath(locale, slug).replace(/\/$/, '.md')
}

const keys = (text: string) =>
  text.replace(
    /<kbd>[^<]*<\/kbd>(?:\+<kbd>[^<]*<\/kbd>)*/g,
    (run) => `\`${run.replace(/<\/?kbd>/g, '')}\``,
  )
const siteLinks = (text: string) =>
  text.replace(/\]\((\/[^)\s]*)\)/g, (_, path: string) => `](${absoluteUrl(path)})`)
const isoDate = (date: Date) => date.toISOString().slice(0, 10)

export function mdxToMarkdown(body: string): string {
  const out: string[] = []
  let fenced = false
  let callout = false
  for (const line of body.trim().split('\n')) {
    if (!fenced) {
      if (/^import\s.+from\s.+$/.test(line)) continue
      if (/^<\/?Steps>\s*$/.test(line)) continue
      if (/^<Callout\b.*>\s*$/.test(line)) {
        const title = /title="([^"]*)"/.exec(line)?.[1]
        if (title) out.push(`> **${title}**`, '>')
        callout = true
        continue
      }
      if (/^<\/Callout>\s*$/.test(line)) {
        callout = false
        continue
      }
    }
    const fence = /^\s*(```|~~~)/.test(line)
    const text = fenced || fence ? line : siteLinks(keys(line))
    if (fence) fenced = !fenced
    out.push(callout ? (text ? `> ${text}` : '>') : text)
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function docMarkdown(source: DocSource, locale: Locale): string {
  const url = absoluteUrl(docPath(locale, source.doc.slug[locale]))
  return [
    `# ${source.title}`,
    `> ${source.description}`,
    `URL: ${url}\n${UI[locale].docs.updated}: ${isoDate(source.updated)}`,
    mdxToMarkdown(source.body),
    source.faq.map((f) => `## ${f.q}\n\n${f.a}`).join('\n\n'),
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function llmsFull(locale: Locale, sources: DocSource[]): string {
  const copy = UI[locale].docs
  const head = `# viveEditor · ${copy.title}\n\n> ${copy.description}\n\nURL: ${absoluteUrl(docsIndexPath(locale))}`
  return `${[head, ...sources.map((s) => docMarkdown(s, locale))].join('\n\n---\n\n')}\n`
}

const docLink = (source: DocSource, locale: Locale) =>
  `- [${source.title}](${absoluteUrl(docMarkdownPath(locale, source.doc.slug[locale]))}): ${source.description}`

export function llmsIndex(sources: Record<Locale, DocSource[]>): string {
  const groups = DOC_GROUPS.flatMap((group) => {
    const items = sources.en.filter((s) => s.doc.group === group)
    return items.length
      ? [`## ${UI.en.docs.groups[group]}\n\n${items.map((s) => docLink(s, 'en')).join('\n')}`]
      : []
  })
  return `${[
    '# viveEditor',
    '> viveEditor is a free, open-source (MIT) rich text editor that drops into any website. One script tag turns a textarea into an editor, and typed npm packages cover React, Vue, Svelte, Angular and a custom element.',
    [
      'Key facts:',
      '',
      '- Price: free. Image uploads, tables, video embeds and Word import and export are included; there is no paid tier.',
      '- Engine: built on ProseMirror. The document schema is an allowlist, so unknown markup never reaches the output.',
      '- Server side: `@viveeditor/sanitize` (Node) and `viveeditor/sanitizer` (PHP 8.4+) keep exactly the HTML the editor produces; a Laravel package adds a Blade component.',
      '- Accessibility: tested against WCAG 2.2 AA in light and dark themes, with full keyboard control.',
      '- Interface languages: Turkish and English.',
      '- Status: 0.x, before the first stable release; breaking changes ship only in minor versions.',
      `- Source code: ${REPO_URL} · npm: ${NPM_URL}`,
      `- Website: English at ${absoluteUrl(homePath('en'))} (default) and Turkish at ${absoluteUrl(homePath('tr'))}. Every documentation page below is also available as plain Markdown.`,
    ].join('\n'),
    ...groups,
    `## Türkçe belgeler\n\n${sources.tr.map((s) => docLink(s, 'tr')).join('\n')}`,
    [
      '## Source and help',
      '',
      `- [Source code on GitHub](${REPO_URL}): every package and this website, under MIT`,
      `- [Report a bug or ask a question](${ISSUES_URL})`,
    ].join('\n'),
    [
      '## Optional',
      '',
      `- [Full English documentation in one file](${absoluteUrl(LLMS_FULL_PATH.en)})`,
      `- [Full Turkish documentation in one file](${absoluteUrl(LLMS_FULL_PATH.tr)})`,
      `- [Sitemap](${absoluteUrl('/sitemap.xml')})`,
    ].join('\n'),
  ].join('\n\n')}\n`
}
