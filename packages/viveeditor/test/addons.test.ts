import { afterEach, describe, expect, it, vi } from 'vitest'
import { AddonError, type AddonLoaderOptions, createAddonLoader } from '../src/addons.js'

const CDN = 'https://cdn.example.test/viveeditor@1.2.3/dist/'
const hash = (letter: string): string => `sha384-${letter.repeat(64)}`
const INTEGRITY = { markdown: hash('M'), docx: hash('D'), panels: hash('P') }
const markdownApi = { markdownToHtml: () => '<p></p>', toMarkdown: () => '' }

let running: Element | null = null

function mainScript(src = `${CDN}viveeditor.classic.iife.js`, nonce = ''): HTMLScriptElement {
  const script = document.createElement('script')
  script.src = src
  if (nonce) script.nonce = nonce
  return script
}

function loader(overrides: Partial<AddonLoaderOptions> = {}) {
  return createAddonLoader({
    script: mainScript(),
    version: '1.2.3',
    integrity: INTEGRITY,
    currentScript: () => running,
    ...overrides,
  })
}

function injected(file: string): HTMLScriptElement {
  const script = document.head.querySelector<HTMLScriptElement>(`script[src$="${file}"]`)
  if (!script) throw new Error(`Missing ${file}`)
  return script
}

function runAs(script: Element, work: () => void): void {
  running = script
  work()
  running = null
}

async function rejection(promise: Promise<unknown>): Promise<AddonError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  )
  if (!(error instanceof AddonError)) throw new Error('Expected an AddonError')
  return error
}

afterEach(() => {
  document.head.innerHTML = ''
  running = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, 'head')
})

describe('createAddonLoader', () => {
  it('loads an add-on from the folder of the main script with integrity and nonce', async () => {
    const addons = loader({ script: mainScript(`${CDN}viveeditor.classic.iife.js?v=1`, 'n0nce') })

    const pending = addons.load('markdown')
    const script = injected('viveeditor.markdown.iife.js')
    runAs(script, () => addons.register('markdown', '1.2.3', markdownApi))
    const module = await pending

    expect(script.src).toBe(`${CDN}viveeditor.markdown.iife.js`)
    expect(script.integrity).toBe(hash('M'))
    expect(script.crossOrigin).toBe('anonymous')
    expect(script.async).toBe(true)
    expect(script.nonce).toBe('n0nce')
    expect(module.markdownToHtml('')).toBe('<p></p>')
    expect(Object.isFrozen(module)).toBe(true)
    expect(addons.load('markdown')).toBe(pending)
  })

  it('refuses when the main script cannot be identified', async () => {
    const clobbered = document.createElement('img')
    clobbered.setAttribute('src', `${CDN}viveeditor.classic.iife.js`)

    const errors = await Promise.all(
      [
        clobbered,
        null,
        mainScript(`${CDN}other.js`),
        mainScript('data:text/javascript,0'),
        mainScript(`${CDN}viveeditor.classic.iife.js.evil/x.js`),
      ].map((script) => rejection(loader({ script }).load('docx'))),
    )

    expect(errors.map((error) => error.code)).toEqual(Array(5).fill('ADDON_UNAVAILABLE'))
    expect(document.head.querySelector('script')).toBeNull()
  })

  it('ignores registrations that do not come from the injected script', async () => {
    vi.useFakeTimers()
    const addons = loader({ timeout: 1000 })
    const pending = addons.load('markdown')
    const stranger = document.createElement('script')

    runAs(stranger, () => addons.register('markdown', '1.2.3', markdownApi))
    addons.register('markdown', '1.2.3', markdownApi)
    runAs(injected('viveeditor.markdown.iife.js'), () =>
      addons.register('constructor', '1.2.3', markdownApi),
    )
    vi.advanceTimersByTime(1000)

    expect((await rejection(pending)).code).toBe('ADDON_FAILED')
  })

  it('rejects another version or a module without its functions', async () => {
    const addons = loader()

    const wrongVersion = addons.load('markdown')
    runAs(injected('viveeditor.markdown.iife.js'), () =>
      addons.register('markdown', '1.2.4', markdownApi),
    )
    const missing = addons.load('docx')
    runAs(injected('viveeditor.docx.iife.js'), () =>
      addons.register('docx', '1.2.3', { importDocx: () => null, exportDocx: 'no' }),
    )

    expect((await rejection(wrongVersion)).message).toContain('1.2.4')
    expect((await rejection(missing)).message).toContain('missing its functions')
  })

  it('removes a script that fails to load and lets the next call try again', async () => {
    const addons = loader()
    const first = addons.load('docx')
    const failed = injected('viveeditor.docx.iife.js')

    failed.dispatchEvent(new Event('error'))
    const error = await rejection(first)
    const second = addons.load('docx')

    expect(error.code).toBe('ADDON_FAILED')
    expect(failed.isConnected).toBe(false)
    expect(second).not.toBe(first)
    expect(injected('viveeditor.docx.iife.js')).not.toBe(failed)
  })

  it('loads the panels add-on and keeps only the panel factories', async () => {
    const addons = loader()
    const factory = () => null
    const pending = addons.load('panels')

    runAs(injected('viveeditor.panels.iife.js'), () =>
      addons.register('panels', '1.2.3', {
        createEmbedPanel: factory,
        createImagePanel: factory,
        createSearchPanel: factory,
        createSwatchPanel: factory,
        createTablePanel: factory,
        extra: factory,
      }),
    )
    const kit = await pending

    expect(Object.keys(kit).sort()).toEqual([
      'createEmbedPanel',
      'createImagePanel',
      'createSearchPanel',
      'createSwatchPanel',
      'createTablePanel',
    ])
    expect(injected('viveeditor.panels.iife.js').integrity).toBe(hash('P'))
  })

  it('fails a script that loads without registering', async () => {
    const addons = loader()
    const pending = addons.load('docx')

    injected('viveeditor.docx.iife.js').dispatchEvent(new Event('load'))

    expect((await rejection(pending)).message).toContain('did not register')
  })

  it('refuses to load without a well-formed integrity hash', async () => {
    const addons = loader({ integrity: { markdown: '', docx: 'sha384-short', panels: hash('P') } })

    const errors = await Promise.all([
      rejection(addons.load('markdown')),
      rejection(addons.load('docx')),
    ])

    expect(errors.map((error) => error.code)).toEqual(['ADDON_UNAVAILABLE', 'ADDON_UNAVAILABLE'])
    expect(document.head.querySelector('script')).toBeNull()
  })

  it('ignores a late registration from a script that already timed out', async () => {
    vi.useFakeTimers()
    const addons = loader({ timeout: 1000 })
    const first = addons.load('markdown')
    const late = injected('viveeditor.markdown.iife.js')
    vi.advanceTimersByTime(1000)
    await rejection(first)
    const second = addons.load('markdown')

    runAs(late, () => addons.register('markdown', '1.2.3', markdownApi))
    runAs(injected('viveeditor.markdown.iife.js'), () =>
      addons.register('markdown', '1.2.4', markdownApi),
    )

    expect((await rejection(second)).message).toContain('1.2.4')
  })

  it('fails cleanly when Trusted Types refuses the policy', async () => {
    vi.stubGlobal('trustedTypes', {
      createPolicy: () => {
        throw new TypeError('policy name not allowed')
      },
    })

    const error = await rejection(loader().load('docx'))

    expect(error.message).toContain('Trusted Types')
    expect(document.querySelector('script')).toBeNull()
  })

  it('adds the script to the document element when head is clobbered', async () => {
    const clobber = document.createElement('img')
    Object.defineProperty(document, 'head', { value: clobber, configurable: true })
    const addons = loader()

    void addons.load('docx').catch(() => undefined)

    expect(document.documentElement.querySelector(':scope > script')).not.toBeNull()
    document.documentElement.querySelector(':scope > script')?.remove()
  })

  it('passes registrations it does not own to the previous copy of the script', () => {
    const fallback = vi.fn()
    const addons = loader({ fallback })

    addons.register('docx', '1.2.3', {})

    expect(fallback).toHaveBeenCalledWith('docx', '1.2.3', {})
  })
})
