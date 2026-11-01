import { resolve } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig, type UserConfig } from 'vite'

const page = (name: string): string => resolve(import.meta.dirname, `${name}.html`)

const config: UserConfig = defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '@viveeditor/angular': resolve(
        import.meta.dirname,
        '../../packages/angular/dist/fesm2022/viveeditor-angular.mjs',
      ),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: page('index'),
        ui: page('ui'),
        react: page('react'),
        vue: page('vue'),
        svelte: page('svelte'),
        angular: page('angular'),
        element: page('element'),
        extras: page('extras'),
        perf: page('perf'),
      },
    },
  },
})

export default config
