import { readFileSync } from 'node:fs'
import { defineConfig, type UserConfig } from 'tsdown'

const { version } = JSON.parse(readFileSync(new URL('package.json', import.meta.url), 'utf8'))

const SHARED = ['@viveeditor/core', '@viveeditor/ext-format', '@viveeditor/ext-image']

const addon = (name: string, clean: boolean): UserConfig => ({
  entry: { [`viveeditor.${name}`]: `src/addon-entries/${name}.ts` },
  format: 'iife',
  platform: 'browser',
  minify: true,
  sourcemap: true,
  external: SHARED,
  noExternal: (id) => !SHARED.includes(id),
  outputOptions: { globals: Object.fromEntries(SHARED.map((id) => [id, 'ViveEditor'])) },
  define: { __VIVE_VERSION__: JSON.stringify(version) },
  clean,
})

const config: UserConfig[] = defineConfig([
  addon('markdown', true),
  addon('docx', false),
  addon('panels', false),
])

export default config
