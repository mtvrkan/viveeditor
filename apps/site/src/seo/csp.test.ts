import { EMBED_PROVIDERS } from '@viveeditor/ext-embed'
import { describe, expect, it } from 'vitest'
import { CSP_DIRECTIVES, cspConfig, FRAME_HOSTS } from './csp'

describe('content security policy', () => {
  it('allows frames from exactly the video providers the editor embeds', () => {
    const providerHosts = Object.values(EMBED_PROVIDERS).map((p) => p.host)

    expect([...FRAME_HOSTS].sort()).toEqual([...providerHosts].sort())
  })

  it('never allows eval or WebAssembly compilation in scripts', () => {
    const scripts = cspConfig().scriptDirective.resources

    expect(scripts).toEqual(["'self'"])
  })

  it('blocks plugins and foreign form targets', () => {
    expect(CSP_DIRECTIVES).toContain("object-src 'none'")
    expect(CSP_DIRECTIVES).toContain("form-action 'self'")
  })
})
