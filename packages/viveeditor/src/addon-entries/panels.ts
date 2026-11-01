import {
  createEmbedPanel,
  createImagePanel,
  createSearchPanel,
  createSwatchPanel,
  createTablePanel,
} from '@viveeditor/ui/panels'

declare const __VIVE_VERSION__: string

const host: unknown = (globalThis as { ViveEditor?: unknown }).ViveEditor
const register: unknown =
  typeof host === 'object' && host !== null ? Reflect.get(host, 'registerAddon') : undefined
if (typeof register === 'function') {
  register('panels', __VIVE_VERSION__, {
    createEmbedPanel,
    createImagePanel,
    createSearchPanel,
    createSwatchPanel,
    createTablePanel,
  })
}
