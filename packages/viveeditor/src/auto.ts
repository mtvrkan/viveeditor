import { type AddonName, createAddonLoader, previousRegistrar } from './addons.js'
import { setDropInDefaults } from './defaults.js'
import { upgradeAll } from './textarea.js'

export * from './index.js'

declare const __VIVE_VERSION__: string
declare const __VIVE_ADDON_INTEGRITY__: Record<AddonName, string>

const previous = previousRegistrar(Reflect.get(globalThis, 'ViveEditor'))
if (previous) console.warn('[viveEditor] The CDN script is loaded more than once on this page.')

const addons = createAddonLoader({
  script: document.currentScript,
  version: __VIVE_VERSION__,
  integrity: __VIVE_ADDON_INTEGRITY__,
  ...(previous ? { fallback: previous } : {}),
})

export const registerAddon: (name: unknown, version: unknown, api: unknown) => void =
  addons.register

setDropInDefaults({
  files: { markdown: () => addons.load('markdown'), docx: () => addons.load('docx') },
  markdown: () => addons.load('markdown'),
  panels: () => addons.load('panels'),
})

function start(): void {
  upgradeAll().catch((error: unknown) => {
    console.error('[viveEditor] Could not upgrade textareas.', error)
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true })
} else {
  start()
}
