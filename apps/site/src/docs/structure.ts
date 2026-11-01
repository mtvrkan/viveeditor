import type { Locale } from '../i18n'

export type DocGroupKey = 'start' | 'features' | 'extras' | 'server' | 'reference'

export type DocKey =
  | 'install'
  | 'firstEditor'
  | 'frameworks'
  | 'toolbar'
  | 'images'
  | 'video'
  | 'tables'
  | 'code'
  | 'search'
  | 'characterCount'
  | 'files'
  | 'officePaste'
  | 'mentions'
  | 'emoji'
  | 'math'
  | 'footnotes'
  | 'templates'
  | 'ai'
  | 'sanitize'
  | 'laravel'
  | 'packages'
  | 'security'
  | 'accessibility'
  | 'versioning'
  | 'faq'
  | 'troubleshooting'

export type DocEntry = {
  key: DocKey
  group: DocGroupKey
  icon: string
  slug: Record<Locale, string>
}

export type Faq = Array<{ q: string; a: string }>

export const DOC_GROUPS: DocGroupKey[] = ['start', 'features', 'extras', 'server', 'reference']

export const DOCS: DocEntry[] = [
  { key: 'install', group: 'start', icon: 'i-down', slug: { tr: 'kurulum', en: 'installation' } },
  {
    key: 'firstEditor',
    group: 'start',
    icon: 'i-edit',
    slug: { tr: 'ilk-editor', en: 'first-editor' },
  },
  {
    key: 'frameworks',
    group: 'start',
    icon: 'i-code',
    slug: { tr: 'cerceveler', en: 'frameworks' },
  },
  {
    key: 'toolbar',
    group: 'features',
    icon: 'i-key',
    slug: { tr: 'arac-cubugu-ve-kisayollar', en: 'toolbar-and-shortcuts' },
  },
  {
    key: 'images',
    group: 'features',
    icon: 'i-pages',
    slug: { tr: 'gorseller-ve-yukleme', en: 'images-and-uploads' },
  },
  { key: 'video', group: 'features', icon: 'i-present', slug: { tr: 'video', en: 'video-embeds' } },
  { key: 'tables', group: 'features', icon: 'i-board', slug: { tr: 'tablolar', en: 'tables' } },
  {
    key: 'code',
    group: 'features',
    icon: 'i-code',
    slug: { tr: 'kod-bloklari', en: 'code-blocks' },
  },
  {
    key: 'search',
    group: 'features',
    icon: 'i-search',
    slug: { tr: 'bul-ve-degistir', en: 'find-and-replace' },
  },
  {
    key: 'characterCount',
    group: 'features',
    icon: 'i-min',
    slug: { tr: 'karakter-siniri', en: 'character-limit' },
  },
  {
    key: 'files',
    group: 'features',
    icon: 'i-convert',
    slug: { tr: 'dosya-ac-kaydet-yazdir', en: 'open-save-print' },
  },
  {
    key: 'officePaste',
    group: 'features',
    icon: 'i-merge',
    slug: { tr: 'word-den-yapistirma', en: 'paste-from-office' },
  },
  { key: 'mentions', group: 'extras', icon: 'i-pen', slug: { tr: 'bahsetme', en: 'mentions' } },
  { key: 'emoji', group: 'extras', icon: 'i-gift', slug: { tr: 'emoji', en: 'emoji' } },
  { key: 'math', group: 'extras', icon: 'i-form', slug: { tr: 'formul', en: 'formulas' } },
  { key: 'footnotes', group: 'extras', icon: 'i-book', slug: { tr: 'dipnot', en: 'footnotes' } },
  {
    key: 'templates',
    group: 'extras',
    icon: 'i-archive',
    slug: { tr: 'sablonlar', en: 'templates' },
  },
  { key: 'ai', group: 'extras', icon: 'i-hl', slug: { tr: 'yapay-zeka', en: 'ai-assistant' } },
  {
    key: 'sanitize',
    group: 'server',
    icon: 'i-lock',
    slug: { tr: 'sunucuda-temizleme', en: 'server-sanitizing' },
  },
  { key: 'laravel', group: 'server', icon: 'i-code', slug: { tr: 'laravel', en: 'laravel' } },
  {
    key: 'packages',
    group: 'reference',
    icon: 'i-archive',
    slug: { tr: 'paketler', en: 'packages' },
  },
  {
    key: 'security',
    group: 'reference',
    icon: 'i-lock',
    slug: { tr: 'guvenlik-ve-csp', en: 'security-and-csp' },
  },
  {
    key: 'accessibility',
    group: 'reference',
    icon: 'i-a11y',
    slug: { tr: 'erisilebilirlik', en: 'accessibility' },
  },
  {
    key: 'versioning',
    group: 'reference',
    icon: 'i-gift',
    slug: { tr: 'surum-politikasi', en: 'versioning' },
  },
  { key: 'faq', group: 'reference', icon: 'i-book', slug: { tr: 'sss', en: 'faq' } },
  {
    key: 'troubleshooting',
    group: 'reference',
    icon: 'i-life',
    slug: { tr: 'sorun-giderme', en: 'troubleshooting' },
  },
]

export function docByKey(key: DocKey): DocEntry {
  const entry = DOCS.find((d) => d.key === key)
  if (!entry) throw new Error(`Unknown doc key: ${key}`)
  return entry
}

export function docBySlug(locale: Locale, slug: string): DocEntry | undefined {
  return DOCS.find((d) => d.slug[locale] === slug)
}
