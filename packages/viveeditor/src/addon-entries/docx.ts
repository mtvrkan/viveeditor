import { exportDocx, importDocx } from '@viveeditor/docx'

declare const __VIVE_VERSION__: string

const host: unknown = (globalThis as { ViveEditor?: unknown }).ViveEditor
const register: unknown =
  typeof host === 'object' && host !== null ? Reflect.get(host, 'registerAddon') : undefined
if (typeof register === 'function') register('docx', __VIVE_VERSION__, { importDocx, exportDocx })
