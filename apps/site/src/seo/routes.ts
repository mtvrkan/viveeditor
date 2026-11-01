import { getCollection } from 'astro:content'
import { docAlternates, entryLocale } from '../docs/pages'
import { DOCS } from '../docs/structure'
import { type Alternates, docsIndexPath, homePath } from '../i18n'

export type SiteRoute = { alternates: Alternates; lastmod: string }

const SITE_UPDATED = '2026-11-01'

export async function siteRoutes(): Promise<SiteRoute[]> {
  const entries = await getCollection('docs')
  const docs = DOCS.flatMap((doc) => {
    const own = entries.filter((e) => e.data.key === doc.key)
    if (!own.length) return []
    const alternates = docAlternates(doc)
    const present: Alternates = Object.fromEntries(
      own.map((e) => [entryLocale(e), alternates[entryLocale(e)]]),
    )
    const lastmod =
      own
        .map((e) => e.data.updated.toISOString().slice(0, 10))
        .sort()
        .at(-1) ?? SITE_UPDATED
    return [{ alternates: present, lastmod }]
  })
  return [
    { alternates: { tr: homePath('tr'), en: homePath('en') }, lastmod: SITE_UPDATED },
    { alternates: { tr: docsIndexPath('tr'), en: docsIndexPath('en') }, lastmod: SITE_UPDATED },
    ...docs,
  ]
}
