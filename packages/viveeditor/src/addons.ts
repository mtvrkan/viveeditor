import type { DocxModule, MarkdownModule, PanelKit } from '@viveeditor/ui'

export type AddonName = 'markdown' | 'docx' | 'panels'

export interface AddonModules {
  markdown: MarkdownModule
  docx: DocxModule
  panels: PanelKit
}

export type AddonErrorCode = 'ADDON_UNAVAILABLE' | 'ADDON_FAILED'

export class AddonError extends Error {
  readonly code: AddonErrorCode

  constructor(code: AddonErrorCode, message: string) {
    super(message)
    this.name = 'AddonError'
    this.code = code
  }
}

export interface AddonLoaderOptions {
  script: unknown
  version: string
  integrity: Readonly<Record<AddonName, string>>
  timeout?: number
  currentScript?: () => unknown
  fallback?: (name: unknown, version: unknown, api: unknown) => void
}

export interface AddonLoader {
  load<Name extends AddonName>(name: Name): Promise<AddonModules[Name]>
  register(name: unknown, version: unknown, api: unknown): void
}

type Registrar = (name: unknown, version: unknown, api: unknown) => void

interface Pending {
  element: HTMLScriptElement
  succeed(api: object): void
  fail(message: string): void
}

interface ScriptUrlPolicy {
  createScriptURL(url: string): unknown
}

interface TrustedTypesFactory {
  createPolicy(name: string, rules: { createScriptURL(url: string): string }): ScriptUrlPolicy
}

const MAIN_FILE = 'viveeditor.classic.iife.js'
const FILES = new Map<string, string>([
  ['markdown', 'viveeditor.markdown.iife.js'],
  ['docx', 'viveeditor.docx.iife.js'],
  ['panels', 'viveeditor.panels.iife.js'],
])
const MEMBERS: Readonly<Record<AddonName, readonly string[]>> = {
  markdown: ['markdownToHtml', 'toMarkdown'],
  docx: ['importDocx', 'exportDocx'],
  panels: [
    'createEmbedPanel',
    'createImagePanel',
    'createSearchPanel',
    'createSwatchPanel',
    'createTablePanel',
  ],
}
const DEFAULT_TIMEOUT = 30_000
const INTEGRITY = /^sha384-[A-Za-z0-9+/]{64}$/
const allowedUrls = new Set<string>()
let policy: ScriptUrlPolicy | null = null

const isAddonName = (name: unknown): name is AddonName =>
  typeof name === 'string' && FILES.has(name)

function addonFolder(script: unknown): URL | null {
  if (!(script instanceof HTMLScriptElement)) return null
  let url: URL
  try {
    url = new URL(script.src)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (!url.pathname.endsWith(`/${MAIN_FILE}`)) return null
  return new URL('./', url)
}

function trustedScriptUrl(url: string): string {
  const types: unknown = Reflect.get(window, 'trustedTypes')
  if (typeof types !== 'object' || types === null) return url
  if (typeof Reflect.get(types, 'createPolicy') !== 'function') return url
  policy ??= (types as TrustedTypesFactory).createPolicy('viveeditor', {
    createScriptURL: (value) => {
      if (!allowedUrls.has(value)) throw new TypeError('viveEditor add-on address refused')
      return value
    },
  })
  return policy.createScriptURL(url) as string
}

function pickMembers(name: AddonName, api: unknown): object | null {
  if (typeof api !== 'object' || api === null) return null
  const picked: Record<string, unknown> = {}
  for (const member of MEMBERS[name]) {
    const value: unknown = Reflect.get(api, member)
    if (typeof value !== 'function') return null
    picked[member] = value
  }
  return Object.freeze(picked)
}

function scriptParent(): ParentNode {
  const head: unknown = document.head
  return head instanceof HTMLHeadElement ? head : document.documentElement
}

export function previousRegistrar(host: unknown): Registrar | null {
  if (typeof host !== 'object' || host === null) return null
  const register: unknown = Reflect.get(host, 'registerAddon')
  return typeof register === 'function' ? (register as Registrar) : null
}

export function createAddonLoader(options: AddonLoaderOptions): AddonLoader {
  const folder = addonFolder(options.script)
  const nonce = options.script instanceof HTMLScriptElement ? options.script.nonce : ''
  const currentScript = options.currentScript ?? (() => document.currentScript)
  const timeout = options.timeout ?? DEFAULT_TIMEOUT
  const pending = new Map<AddonName, Pending>()
  const loaded = new Map<AddonName, Promise<object>>()

  const inject = (name: AddonName): Promise<object> =>
    new Promise((resolve, reject) => {
      const file = FILES.get(name)
      const integrity = options.integrity[name]
      if (!folder || !file || !INTEGRITY.test(integrity)) {
        reject(new AddonError('ADDON_UNAVAILABLE', 'viveEditor add-ons need the CDN script'))
        return
      }
      const message = `${file} could not be added to the page`
      try {
        start(name, file, new URL(file, folder).href, integrity, resolve, reject)
      } catch {
        const entry = pending.get(name)
        if (entry) entry.fail(message)
        else reject(new AddonError('ADDON_FAILED', message))
      }
    })

  const start = (
    name: AddonName,
    file: string,
    url: string,
    integrity: string,
    resolve: (api: object) => void,
    reject: (error: AddonError) => void,
  ): void => {
    allowedUrls.add(url)
    const element = document.createElement('script')
    let timer = 0
    const settle = (): void => {
      window.clearTimeout(timer)
      pending.delete(name)
    }
    const entry: Pending = {
      element,
      succeed: (api) => {
        settle()
        resolve(api)
      },
      fail: (message) => {
        settle()
        element.remove()
        reject(new AddonError('ADDON_FAILED', message))
      },
    }
    pending.set(name, entry)
    timer = window.setTimeout(() => entry.fail(`${file} timed out`), timeout)
    element.addEventListener('error', () => entry.fail(`${file} could not be loaded`))
    element.addEventListener('load', () => {
      if (pending.get(name) === entry) entry.fail(`${file} did not register`)
    })
    element.async = true
    element.crossOrigin = 'anonymous'
    element.integrity = integrity
    if (nonce) element.nonce = nonce
    try {
      element.src = trustedScriptUrl(url)
    } catch {
      entry.fail(`${file} was refused by Trusted Types`)
      return
    }
    scriptParent().append(element)
  }

  return {
    load: <Name extends AddonName>(name: Name): Promise<AddonModules[Name]> => {
      let promise = loaded.get(name)
      if (!promise) {
        promise = inject(name)
        loaded.set(name, promise)
        promise.catch(() => {
          if (loaded.get(name) === promise) loaded.delete(name)
        })
      }
      return promise as Promise<AddonModules[Name]>
    },
    register: (name, version, api) => {
      const entry = isAddonName(name) ? pending.get(name) : undefined
      if (!isAddonName(name) || !entry || currentScript() !== entry.element) {
        options.fallback?.(name, version, api)
        return
      }
      if (version !== options.version) {
        entry.fail(`${FILES.get(name)} is version ${String(version)}, expected ${options.version}`)
        return
      }
      const module = pickMembers(name, api)
      if (module) entry.succeed(module)
      else entry.fail(`${FILES.get(name)} is missing its functions`)
    },
  }
}
