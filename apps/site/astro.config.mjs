import mdx from '@astrojs/mdx'
import { defineConfig } from 'astro/config'
import { cspConfig } from './src/seo/csp.ts'

export default defineConfig({
  site: 'https://editor.vivepdf.com',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [mdx()],
  vite: { build: { assetsInlineLimit: 0 } },
  security: { csp: cspConfig() },
  i18n: {
    locales: ['tr', 'en'],
    defaultLocale: 'tr',
    routing: { prefixDefaultLocale: false },
  },
})
