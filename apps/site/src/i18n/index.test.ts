import { describe, expect, it } from 'vitest'
import { absoluteUrl, docPath, docsIndexPath, homePath, hreflangLinks } from '.'
import { plural } from './plural'

describe('localized paths', () => {
  it('puts the English home at the root and the Turkish one under /tr/', () => {
    expect([homePath('tr'), homePath('en')]).toEqual(['/tr/', '/'])
    expect([docsIndexPath('tr'), docsIndexPath('en')]).toEqual(['/dokumantasyon/', '/en/docs/'])
  })

  it('ends every doc path with a slash', () => {
    expect(docPath('tr', 'kurulum')).toBe('/dokumantasyon/kurulum/')
    expect(docPath('en', 'installation')).toBe('/en/docs/installation/')
  })

  it('builds absolute URLs on the production origin', () => {
    expect(absoluteUrl('/en/')).toBe('https://editor.vivepdf.com/en/')
  })
})

describe('hreflang links', () => {
  it('adds x-default pointing at English when both languages exist', () => {
    expect(hreflangLinks({ tr: '/', en: '/en/' })).toEqual([
      { hreflang: 'tr', href: 'https://editor.vivepdf.com/' },
      { hreflang: 'en', href: 'https://editor.vivepdf.com/en/' },
      { hreflang: 'x-default', href: 'https://editor.vivepdf.com/en/' },
    ])
  })

  it('leaves x-default out for a page in one language', () => {
    expect(hreflangLinks({ en: '/en/docs/' })).toEqual([
      { hreflang: 'en', href: 'https://editor.vivepdf.com/en/docs/' },
    ])
  })

  it('returns nothing for a page without alternates', () => {
    expect(hreflangLinks({})).toEqual([])
  })
})

describe('plural', () => {
  it('picks the English singular for one', () => {
    expect(plural('en', { one: '# tool', other: '# tools' }, 1)).toBe('1 tool')
  })

  it("formats large counts with the locale's separators", () => {
    expect(plural('tr', { one: '# araç', other: '# araç' }, 1200)).toBe('1.200 araç')
  })

  it('uses the other form for zero in English', () => {
    expect(plural('en', { one: '# result', other: '# results' }, 0)).toBe('0 results')
  })
})
