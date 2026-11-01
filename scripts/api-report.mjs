import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url))
const mode = process.argv[2]
if (mode !== 'check' && mode !== 'update') {
  console.error('Usage: node scripts/api-report.mjs <check|update>')
  process.exit(1)
}

const SPECIFIER = /(from\s+|import\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/g
const CHUNK_HASH = /-([A-Za-z0-9_-]{8})$/

const typesOf = (target) => {
  if (typeof target === 'string') return /\.d\.[cm]?ts$/.test(target) ? target : null
  if (!target || typeof target !== 'object') return null
  if (typeof target.types === 'string') return target.types
  for (const value of Object.values(target)) {
    const found = typesOf(value)
    if (found) return found
  }
  return null
}

const entryTypes = (manifest) => {
  if (!manifest.exports) return [manifest.types ?? manifest.typings].filter(Boolean)
  return Object.entries(manifest.exports)
    .filter(([entry]) => !/\.(css|json)$/.test(entry))
    .map(([, target]) => typesOf(target))
    .filter(Boolean)
}

const declarationFor = (fromFile, specifier) => {
  const base = posix.join(posix.dirname(fromFile), specifier)
  const candidates = [
    base.replace(/\.js$/, '.d.ts'),
    base.replace(/\.mjs$/, '.d.mts'),
    base.replace(/\.cjs$/, '.d.cts'),
    `${base}.d.ts`,
    posix.join(base, 'index.d.ts'),
  ]
  return candidates.find((candidate) => candidate !== base && existsSync(candidate)) ?? null
}

const isChunkHash = (hash) => /[A-Z0-9_]/.test(hash) && /[a-z]/.test(hash)

const reportName = (file, isEntry) => {
  const match = file.match(/^(.*?)(\.d\.[cm]?ts)$/)
  const [, stem, extension] = match
  const hash = stem.match(CHUNK_HASH)
  if (isEntry || !hash || !isChunkHash(hash[1])) return file
  return `${stem.slice(0, -hash[0].length).replace(/-$/, '')}.chunk${extension}`
}

function collect(dir) {
  const pkgRoot = root(`packages/${dir}`)
  const source = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf8'))
  if (source.private) return null
  const base = source.publishConfig?.directory
    ? join(pkgRoot, source.publishConfig.directory)
    : pkgRoot
  const manifestPath = join(base, 'package.json')
  if (!existsSync(manifestPath))
    throw new Error(`${source.name}: not built. Run "pnpm build" first.`)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const entries = entryTypes(manifest).map((path) => posix.join(base, path))
  const missing = entries.filter((path) => !existsSync(path))
  if (missing.length > 0) throw new Error(`${source.name}: missing ${missing.join(', ')}`)

  const files = new Map()
  const queue = [...entries]
  while (queue.length > 0) {
    const file = queue.shift()
    if (files.has(file)) continue
    const text = readFileSync(file, 'utf8')
    files.set(file, text)
    for (const [, , , specifier] of text.matchAll(SPECIFIER)) {
      const target = declarationFor(file, specifier)
      if (target && !files.has(target)) queue.push(target)
    }
  }

  const names = new Map()
  for (const file of files.keys()) {
    const path = relative(base, file)
      .split('\\')
      .join('/')
      .replace(/^dist\//, '')
    const name = reportName(path, entries.includes(file))
    if ([...names.values()].includes(name))
      throw new Error(`${source.name}: two files map to ${name}`)
    names.set(file, name)
  }

  const out = new Map()
  for (const [file, text] of files) {
    const rewritten = text.replace(SPECIFIER, (whole, lead, quote, specifier) => {
      const target = declarationFor(file, specifier)
      if (!target) return whole
      const from = posix.dirname(names.get(file))
      const to = names.get(target).replace(/\.d\.([cm]?)ts$/, '.$1js')
      const path = posix.relative(from, to)
      return `${lead}${quote}${path.startsWith('.') ? path : `./${path}`}${quote}`
    })
    out.set(`${dir}/${names.get(file)}`, `${rewritten.trimEnd()}\n`)
  }
  return out
}

const expected = new Map()
for (const dir of readdirSync(root('packages')).sort()) {
  for (const [path, text] of collect(dir) ?? []) expected.set(path, text)
}

const apiRoot = root('api')
const listFiles = (dir, prefix = '') =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? listFiles(join(dir, entry.name), `${prefix}${entry.name}/`)
          : [`${prefix}${entry.name}`],
      )
    : []
const actual = new Map(
  listFiles(apiRoot).map((path) => [path, readFileSync(join(apiRoot, path), 'utf8')]),
)

if (mode === 'update') {
  for (const path of actual.keys()) if (!expected.has(path)) rmSync(join(apiRoot, path))
  for (const [path, text] of expected) {
    mkdirSync(dirname(join(apiRoot, path)), { recursive: true })
    writeFileSync(join(apiRoot, path), text)
  }
  console.log(`API report written: ${expected.size} files in api/.`)
  process.exit(0)
}

const changed = [...expected.keys()].filter((path) => actual.get(path) !== expected.get(path))
const removed = [...actual.keys()].filter((path) => !expected.has(path))
if (changed.length > 0 || removed.length > 0) {
  for (const path of changed)
    console.error(`${actual.has(path) ? 'changed' : 'added'}: api/${path}`)
  for (const path of removed) console.error(`removed: api/${path}`)
  console.error(
    '\nThe public API changed. Review the difference, then run "pnpm api:update" and commit api/.',
  )
  process.exit(1)
}
console.log(`API report matches: ${expected.size} files.`)
