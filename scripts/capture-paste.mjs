import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const NAME = /^(word|docs|libreoffice)-[a-z]+$/

const readPasteboard = (type) =>
  execFileSync(
    'osascript',
    [
      '-l',
      'JavaScript',
      '-e',
      `ObjC.import('AppKit'); const value = $.NSPasteboard.generalPasteboard.stringForType(${JSON.stringify(type)}); value.isNil() ? '' : value.js`,
    ],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
  ).replace(/\n$/, '')

const scrub = (html) =>
  html
    .replace(/<o:DocumentProperties>[\s\S]*?<\/o:DocumentProperties>/gi, '')
    .replace(/<o:CustomDocumentProperties>[\s\S]*?<\/o:CustomDocumentProperties>/gi, '')
    .replace(/<meta\s+name=["']?(author|lastauthor|company)["']?[^>]*>/gi, '')
    .replace(
      /docs-internal-guid-[0-9a-f-]+/gi,
      'docs-internal-guid-00000000-0000-0000-0000-000000000000',
    )
    .replace(/\/Users\/[^/"'\s]+\//g, '/Users/user/')
    .replace(/C:\\Users\\[^\\"'\s]+\\/gi, 'C:\\Users\\user\\')

const name = process.argv[2] ?? ''
if (!NAME.test(name)) {
  console.error('Usage: node scripts/capture-paste.mjs <word|docs|libreoffice>-<topic>')
  process.exit(1)
}

const html = readPasteboard('public.html')
if (!html) {
  console.error('The clipboard has no HTML. Copy from the office app first.')
  process.exit(1)
}
const text = readPasteboard('public.utf8-plain-text')
const base = fileURLToPath(new URL(`../tests/fixtures/paste/${name}`, import.meta.url))
writeFileSync(`${base}.html`, scrub(html))
writeFileSync(`${base}.txt`, text)
console.log(`Saved ${name}.html (${html.length} chars) and ${name}.txt`)
