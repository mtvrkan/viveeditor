import { describe, expect, it } from 'vitest'
import { isAllowedUrl } from '../src/index.js'

describe('isAllowedUrl', () => {
  it.each([
    'https://viveeditor.dev',
    'http://example.com/a?b=c',
    'mailto:info@example.com',
    'tel:+905551112233',
    '/relative/path',
    '#section',
    'page.html',
    '//cdn.example.com/x',
  ])('accepts %s', (url) => {
    expect(isAllowedUrl(url)).toBe(true)
  })

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    ' javascript:alert(1)',
    `java${String.fromCharCode(0x09)}script:alert(1)`,
    `java${String.fromCharCode(0x00)}script:alert(1)`,
    `${String.fromCharCode(0x200b)}javascript:alert(1)`,
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    '',
    '   ',
  ])('rejects %j', (url) => {
    expect(isAllowedUrl(url)).toBe(false)
  })

  it('honours a custom protocol allowlist', () => {
    const protocols = ['https']

    const result = [
      isAllowedUrl('https://a.test', protocols),
      isAllowedUrl('mailto:a@b.c', protocols),
    ]

    expect(result).toEqual([true, false])
  })
})
