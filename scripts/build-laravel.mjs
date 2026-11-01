import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url))

const ASSETS = [
  'viveeditor.classic.iife.js',
  'viveeditor.markdown.iife.js',
  'viveeditor.docx.iife.js',
  'viveeditor.panels.iife.js',
  'viveeditor.css',
]

const missing = ASSETS.filter((name) => !existsSync(root(`packages/viveeditor/dist/${name}`)))
if (missing.length > 0) {
  console.error(`Missing ${missing.join(', ')}. Run "pnpm build" first.`)
  process.exit(1)
}

mkdirSync(root('integrations/laravel/resources/dist'), { recursive: true })
for (const name of ASSETS) {
  cpSync(
    root(`packages/viveeditor/dist/${name}`),
    root(`integrations/laravel/resources/dist/${name}`),
  )
}
console.log('Laravel assets ready in integrations/laravel/resources/dist.')
