import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { type SanitizeOptions, sanitizeHtml, VIVE_PROFILE } from '../src/index.js'
import { unsafeParts } from './safety.js'

const RUNS = Number(process.env.FUZZ_RUNS ?? 200)
const SEED = 20_261_031

const HOSTILE_TAGS = [
  ...VIVE_PROFILE.dropWithContent,
  'img',
  'iframe',
  'form',
  'input',
  'base',
  'meta',
  'link',
  'image',
  'foreignObject',
  'annotation-xml',
  'mglyph',
  'malignmark',
  'table',
  'font',
  'div',
]
const TAGS = [...Object.keys(VIVE_PROFILE.elements), ...HOSTILE_TAGS]

const ATTRIBUTES = [
  ...new Set(Object.values(VIVE_PROFILE.elements).flatMap((rule) => rule.attributes ?? [])),
  'style',
  'onerror',
  'onload',
  'id',
  'name',
  'form',
  'srcdoc',
  'xmlns',
  'xlink:href',
  'is',
  'formaction',
]

const VALUES = [
  'javascript:alert(1)',
  ' JaVaScRiPt:alert(1)',
  'java&#x09;script:alert(1)',
  'java\tscript:alert(1)',
  '&#106;avascript:alert(1)',
  'vbscript:msgbox(1)',
  'data:text/html,<script>alert(1)</script>',
  'data:image/png;base64,iVBORw0KGgo=',
  'data:image/svg+xml,<svg onload=alert(1)>',
  'https://example.com/a?b=c',
  'https://www.youtube.com/embed/abc123',
  '//evil.example/x',
  '/relative/path.png',
  'mailto:a@example.com',
  'vive-embed',
  'vive-mention',
  'u_ayse',
  'x^2',
  'taskList',
  'true',
  'color: red; background: url(javascript:alert(1))',
  'text-align: center',
  '"><img src=x onerror=alert(1)>',
  '</p><script>alert(1)</script>',
  'expression(alert(1))',
  '',
]

const TEXTS = [
  'metin',
  '<',
  '>',
  '&',
  '&lt;script&gt;',
  '<!--',
  '-->',
  '<![CDATA[',
  ']]>',
  '‮',
  '\u0000',
  '$x$',
  '`',
  '"',
  "'",
  '<svg><p><style><img src=x onerror=alert(1)>',
  '<math><mi><mglyph><style><img src=x onerror=alert(1)>',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  '<template><script>alert(1)</script></template>',
]

const attribute = fc
  .tuple(fc.constantFrom(...ATTRIBUTES), fc.constantFrom(...VALUES), fc.constantFrom('"', "'", ''))
  .map(([name, value, quote]) => {
    const safe = quote === '' ? value.replace(/[\s"'>]/g, '') : value.replaceAll(quote, '')
    return ` ${name}=${quote}${safe}${quote}`
  })

const { html } = fc.letrec<{ html: string; node: string }>((tie) => ({
  html: fc.array(tie('node'), { maxLength: 4 }).map((parts) => parts.join('')),
  node: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.constantFrom(...TEXTS),
    fc
      .tuple(
        fc.constantFrom(...TAGS),
        fc.array(attribute, { maxLength: 3 }),
        tie('html'),
        fc.boolean(),
      )
      .map(
        ([tag, attributes, inner, closed]) =>
          `<${tag}${attributes.join('')}>${inner}${closed ? `</${tag}>` : ''}`,
      ),
  ),
}))

const options = fc.record<SanitizeOptions>({
  embeds: fc.boolean(),
  allowRelativeImages: fc.boolean(),
})

describe('sanitizeHtml on generated HTML', () => {
  it('returns markup with no unsafe parts that stays the same when sanitized again', () => {
    fc.assert(
      fc.property(html, options, (input, settings) => {
        const clean = sanitizeHtml(input, settings)

        const again = sanitizeHtml(clean, settings)

        expect(unsafeParts(clean)).toEqual([])
        expect(again).toBe(clean)
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })

  it('never throws on arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary', maxLength: 400 }), (input) => {
        const clean = sanitizeHtml(input)

        expect(unsafeParts(clean)).toEqual([])
      }),
      { seed: SEED, numRuns: RUNS },
    )
  })
})
