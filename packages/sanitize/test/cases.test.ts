import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SanitizeError, type SanitizeOptions, sanitizeHtml } from '../src/index.js'
import { unsafeParts } from './safety.js'

interface Case {
  name: string
  input: string
  options?: SanitizeOptions
  expected: string
}

const FIXTURES = resolve(process.cwd(), '../../tests/fixtures/sanitize')
const cases = JSON.parse(readFileSync(resolve(FIXTURES, 'cases.json'), 'utf8')) as Case[]

function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
    return state / 2_147_483_648
  }
}

describe('shared sanitizer cases', () => {
  it.each(cases.map((item) => [item.name, item] as const))('%s', (_name, item) => {
    const clean = sanitizeHtml(item.input, item.options)

    const again = sanitizeHtml(clean, item.options)

    expect(clean).toBe(item.expected)
    expect(again).toBe(clean)
    expect(unsafeParts(clean)).toEqual([])
  })
})

function parityCorpus(): Case[] {
  const random = seeded(20_261_101)
  const pick = (): string => {
    const item = cases[Math.floor(random() * cases.length)]?.input ?? ''
    const start = Math.floor(random() * item.length)
    return item.slice(start, start + Math.floor(random() * 200))
  }
  return Array.from({ length: 300 }, (_, round) => {
    const input = Array.from({ length: 4 }, pick).join('').toWellFormed()
    const options: SanitizeOptions = {
      embeds: round % 2 === 0,
      allowRelativeImages: round % 3 === 0,
    }
    return { name: `parity ${round}`, input, options, expected: sanitizeHtml(input, options) }
  })
}

describe('sanitizeHtml', () => {
  it('matches the shared parity corpus used by the PHP sanitizer', () => {
    const path = resolve(FIXTURES, 'parity.json')
    if (process.env.UPDATE_FIXTURES) {
      writeFileSync(path, `${JSON.stringify(parityCorpus(), null, 2)}\n`)
    }
    const corpus = JSON.parse(readFileSync(path, 'utf8')) as Case[]

    const mismatches = corpus.filter(
      (item) => sanitizeHtml(item.input, item.options) !== item.expected,
    )

    expect(corpus).toHaveLength(300)
    expect(mismatches).toEqual([])
  })

  it('keeps the PHP copy of the profile identical', () => {
    const php = readFileSync(
      resolve(process.cwd(), '../../php/sanitizer/resources/profile.json'),
      'utf8',
    )

    const node = readFileSync(resolve(process.cwd(), 'src/profile.json'), 'utf8')

    expect(php).toBe(node)
  })

  it('stays safe and stable on random mixes of the attack cases', () => {
    const random = seeded(20_261_031)
    const pick = (): string => {
      const item = cases[Math.floor(random() * cases.length)]?.input ?? ''
      const start = Math.floor(random() * item.length)
      return item.slice(start, start + Math.floor(random() * 200))
    }
    const failures: string[] = []

    for (let round = 0; round < 500; round++) {
      const input = Array.from({ length: 4 }, pick).join('')
      const clean = sanitizeHtml(input, { embeds: true })
      if (sanitizeHtml(clean, { embeds: true }) !== clean || unsafeParts(clean).length > 0) {
        failures.push(input)
      }
    }

    expect(failures).toEqual([])
  })

  it('throws TOO_LARGE above the byte limit', () => {
    const input = '<p>ğ</p>'.repeat(10)

    const run = () => sanitizeHtml(input, { maxBytes: 50 })

    expect(run).toThrow(SanitizeError)
    expect(run).toThrow(expect.objectContaining({ code: 'TOO_LARGE' }))
  })

  it.each([
    ['one tag with many attributes', `<p${' a=1'.repeat(65)}>x</p>`],
    ['attributes hidden behind a quoted >', `<p a=">"${' b'.repeat(70)}>x</p>`],
    ['deep nesting', '<div>'.repeat(600)],
    ['nested unknown end tags', `${'<span>'.repeat(20_000)}${'</y>'.repeat(20_000)}`],
    [
      'formatting rebuilt in every paragraph',
      Array.from({ length: 20_000 }, (_, index) => `<p><b c=${index}>x</p>`).join(''),
    ],
  ])('throws TOO_COMPLEX for %s, quickly', (_name, input) => {
    const started = performance.now()

    const run = () => sanitizeHtml(input)

    expect(run).toThrow(expect.objectContaining({ code: 'TOO_COMPLEX' }))
    expect(performance.now() - started).toBeLessThan(1000)
  })

  it('accepts a tag with exactly 64 attributes', () => {
    const input = `<p${' a=1'.repeat(64)}>x</p>`

    const clean = sanitizeHtml(input)

    expect(clean).toBe('<p>x</p>')
  })

  it.each([
    ['<h6><sup><h2>x', '<h6></h6><h2>x</h2>'],
    ['<p><applet><p>x</p></applet></p>', '<p></p><p>x</p><p></p>'],
  ])('returns markup that stays the same when sanitized again: %s', (input, expected) => {
    const clean = sanitizeHtml(input)

    expect(clean).toBe(expected)
    expect(sanitizeHtml(clean)).toBe(clean)
  })

  it('replaces a lone surrogate instead of failing', () => {
    const clean = sanitizeHtml('<p>a\ud800b</p>')

    expect(clean).toBe('<p>a�b</p>')
  })

  it('returns an empty string for non-string input', () => {
    const clean = sanitizeHtml(42 as unknown as string)

    expect(clean).toBe('')
  })
})
