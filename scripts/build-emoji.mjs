import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'emoji-data')
const require = createRequire(join(ROOT, 'package.json'))
const COMPONENT_GROUP = 2
const MAX_KEYWORDS = 12
const LOCALES = ['en']

function rowsFor(locale) {
  const emojis = require(`emojibase-data/${locale}/compact.json`)
  const shortcodes = require(`emojibase-data/${locale}/shortcodes/emojibase.json`)
  return emojis
    .filter((emoji) => emoji.group !== undefined && emoji.group !== COMPONENT_GROUP)
    .sort((a, b) => a.order - b.order)
    .map((emoji) => {
      const codes = [shortcodes[emoji.hexcode] ?? []].flat()
      const keywords = [...new Set([...codes, ...(emoji.tags ?? [])])]
        .map((keyword) => keyword.toLowerCase())
        .filter((keyword) => keyword !== emoji.label.toLowerCase())
        .slice(0, MAX_KEYWORDS)
      return [emoji.unicode, emoji.label, keywords]
    })
}

const version = require('emojibase-data/package.json').version
const dataDir = join(ROOT, 'data')
mkdirSync(dataDir, { recursive: true })
for (const locale of LOCALES) {
  const rows = rowsFor(locale)
  const body = rows.map((row) => JSON.stringify(row)).join(',\n')
  writeFileSync(join(dataDir, `${locale}.js`), `export default [\n${body}\n]\n`)
  writeFileSync(
    join(dataDir, `${locale}.d.ts`),
    'declare const rows: ReadonlyArray<readonly [emoji: string, name: string, keywords: readonly string[]]>\nexport default rows\n',
  )
  console.log(`${locale}: ${rows.length} emoji from emojibase-data ${version}`)
}
