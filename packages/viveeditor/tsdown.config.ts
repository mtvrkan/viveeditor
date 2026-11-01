import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineConfig, type UserConfig } from 'tsdown'

const read = (file: string): Buffer => readFileSync(new URL(file, import.meta.url))
const integrity = (file: string): string =>
  `sha384-${createHash('sha384')
    .update(read(`dist/${file}`))
    .digest('base64')}`
const { version } = JSON.parse(read('package.json').toString('utf8'))
const PANEL_KIT_STUB = '\0vive-panel-kit'
const panelsFromAddon = {
  name: 'vive-panels-from-addon',
  resolveId: (source: string, importer: string | undefined) =>
    source === './panel-kit.js' && importer?.includes('/ui/dist/') ? PANEL_KIT_STUB : null,
  load: (id: string) =>
    id === PANEL_KIT_STUB
      ? 'throw new Error("viveEditor panels load through the panels add-on")'
      : null,
}

const config: UserConfig[] = defineConfig([
  {
    entry: ['src/index.ts'],
    format: 'esm',
    platform: 'browser',
    dts: true,
    sourcemap: true,
    clean: false,
  },
  {
    entry: { 'viveeditor.classic': 'src/auto.ts' },
    format: 'iife',
    globalName: 'ViveEditor',
    platform: 'browser',
    minify: true,
    sourcemap: true,
    noExternal: [/.*/],
    plugins: [panelsFromAddon],
    define: {
      __VIVE_VERSION__: JSON.stringify(version),
      __VIVE_ADDON_INTEGRITY__: JSON.stringify({
        markdown: integrity('viveeditor.markdown.iife.js'),
        docx: integrity('viveeditor.docx.iife.js'),
        panels: integrity('viveeditor.panels.iife.js'),
      }),
    },
    clean: false,
  },
])

export default config
