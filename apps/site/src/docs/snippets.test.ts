import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SNIPPETS } from '../components/home/snippets'
import { LOCALES } from '../i18n'

const contentDir = new URL('../content/docs/', import.meta.url)
const apiDir = new URL('../../../../api/', import.meta.url)

const FENCE = /^```(ts|tsx|js|vue|svelte|html)\n([\s\S]*?)^```$/gm
const IMPORT = /import\s+(type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g

function namedImports(code: string): Array<{ from: string; names: string[] }> {
  return [...code.matchAll(IMPORT)].map((match) => ({
    from: match[3] ?? '',
    names: (match[2] ?? '')
      .split(',')
      .map((part) =>
        part
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0]
          ?.trim(),
      )
      .filter((name): name is string => Boolean(name)),
  }))
}

function reportFile(specifier: string): URL | null {
  const match = /^(?:@viveeditor\/([^/]+)|(viveeditor))(?:\/(.+))?$/.exec(specifier)
  if (!match) return null
  const pkg = match[1] ?? match[2] ?? ''
  const sub = match[3]
  const candidates = sub
    ? [`${pkg}/${sub}.d.ts`, `${pkg}/${sub}/index.d.ts`, `${pkg}/data/${sub}.d.ts`]
    : [`${pkg}/index.d.ts`, `${pkg}/index.d.mts`, `${pkg}/types/viveeditor-angular.d.ts`]
  for (const candidate of candidates) {
    const url = new URL(candidate, apiDir)
    if (existsSync(url)) return url
  }
  throw new Error(`No API report for ${specifier}`)
}

const exportCache = new Map<string, Set<string>>()

function exportedNames(specifier: string): Set<string> {
  const cached = exportCache.get(specifier)
  if (cached) return cached
  const file = reportFile(specifier)
  const names = new Set<string>()
  exportCache.set(specifier, names)
  if (!file) return names
  const source = readFileSync(file, 'utf8')
  for (const m of source.matchAll(
    /^export\s+(?:declare\s+)?(?:abstract\s+)?(?:function|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm,
  ))
    if (m[1]) names.add(m[1])
  for (const m of source.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}/gm))
    for (const part of (m[1] ?? '').split(',')) {
      const name = part
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)
        .at(-1)
        ?.trim()
      if (name) names.add(name)
    }
  for (const m of source.matchAll(/^export \* from "([^"]+)"/gm))
    for (const name of exportedNames(m[1] ?? '')) names.add(name)
  return names
}

function docFiles(): Array<{ path: string; text: string }> {
  return LOCALES.flatMap((locale) => {
    const dir = new URL(`${locale}/`, contentDir)
    return readdirSync(dir)
      .filter((f) => f.endsWith('.mdx'))
      .map((f) => ({ path: `${locale}/${f}`, text: readFileSync(new URL(f, dir), 'utf8') }))
  })
}

describe('namedImports', () => {
  it('reads names, type imports and aliases from one statement', () => {
    const found = namedImports(
      "import { Editor, type Extension, createUI as ui } from 'viveeditor'",
    )

    expect(found).toEqual([{ from: 'viveeditor', names: ['Editor', 'Extension', 'createUI'] }])
  })

  it('ignores side-effect and default imports', () => {
    const found = namedImports("import 'viveeditor/style.css'\nimport katex from 'katex'")

    expect(found).toEqual([])
  })
})

describe('exportedNames', () => {
  it('follows re-exports of the one-script package', () => {
    const names = exportedNames('viveeditor')

    expect(names.has('Editor')).toBe(true)
    expect(names.has('createUI')).toBe(true)
    expect(names.has('upgradeAll')).toBe(true)
  })

  it('throws for a package entry without an API report', () => {
    expect(() => exportedNames('@viveeditor/not-a-package')).toThrow('No API report')
  })
})

describe('code samples in the docs', () => {
  it('import only names the packages really export', () => {
    const missing: string[] = []
    for (const { path, text } of docFiles())
      for (const fence of text.matchAll(FENCE))
        for (const { from, names } of namedImports(fence[2] ?? '')) {
          if (!/^(@viveeditor\/|viveeditor($|\/))/.test(from)) continue
          const exported = exportedNames(from)
          for (const name of names)
            if (!exported.has(name)) missing.push(`${path}: ${name} from ${from}`)
        }

    expect(missing).toEqual([])
  })

  it('carry no comments', () => {
    const commented: string[] = []
    for (const { path, text } of docFiles())
      for (const fence of text.matchAll(/^```\w+\n([\s\S]*?)^```$/gm))
        if (/(^|\s)\/\/\s|\/\*|<!--|\{\{--/m.test(fence[1] ?? '')) commented.push(path)

    expect(commented).toEqual([])
  })
})

describe('install snippets on the home page', () => {
  it('import only names the packages really export', () => {
    const missing: string[] = []
    for (const [id, snippet] of Object.entries(SNIPPETS))
      for (const { from, names } of namedImports(snippet.code)) {
        const exported = exportedNames(from)
        for (const name of names)
          if (!exported.has(name)) missing.push(`${id}: ${name} from ${from}`)
      }

    expect(missing).toEqual([])
  })
})
