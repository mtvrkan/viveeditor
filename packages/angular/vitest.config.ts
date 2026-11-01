import { fileURLToPath } from 'node:url'
import { defineConfig, type ViteUserConfig } from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  resolve: {
    alias: {
      '@viveeditor/angular': fileURLToPath(
        new URL('./dist/fesm2022/viveeditor-angular.mjs', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
  },
})

export default config
