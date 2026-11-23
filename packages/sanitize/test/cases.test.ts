import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SanitizeError, type SanitizeOptions, sanitizeHtml } from '../src/index.js'
import { unsafeParts } from './safety.js'

interface Case {
  name: string
  input: string
  options?: SanitizeOptions
  expected?: string
  error?: string
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
  it.each(cases.filter((item) => item.error).map((item) => [item.name, item] as const))(
    '%s is refused',
    (_name, item) => {
      const attempt = () => sanitizeHtml(item.input, item.options)

      expect(attempt).toThrow(expect.objectContaining({ code: item.error }))
    },
  )

  it.each(cases.filter((item) => !item.error).map((item) => [item.name, item] as const))(
    '%s',
    (_name, item) => {
      const clean = sanitizeHtml(item.input, item.options)

      const again = sanitizeHtml(clean, item.options)

      expect(clean).toBe(item.expected)
      expect(again).toBe(clean)
      expect(unsafeParts(clean)).toEqual([])
    },
  )
})

function parityCorpus(): Case[] {
  const random = seeded(20_261_101)
  const usable = cases.filter((item) => !item.error)
  const pick = (): string => {
    const item = usable[Math.floor(random() * usable.length)]?.input ?? ''
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

  it.each([
    ['markup', ['Arial</style>']],
    ['a CSS function', ['var(--font)']],
    ['an empty entry', ['']],
    ['a name with a double quote', ['"Inter", sans-serif']],
    ['an entry longer than 64 bytes', [`${'A'.repeat(70)}, serif`]],
  ])('refuses a host font family list with %s', (_name, fontFamilies) => {
    const run = () => sanitizeHtml('<p>a</p>', { fontFamilies })

    expect(run).toThrow(TypeError)
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
    ['nesting deep enough to crash the PHP parser', '<div>'.repeat(99_000)],
    ['tables nested in cells', '<table><td>'.repeat(49_000)],
    ['more closing paragraphs than the element budget', '</p>'.repeat(110_000)],
    ['a template', `<template>${'<p><b c=1>x</p>'.repeat(10)}`],
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

  it('refuses more opening tags than maxTags and accepts exactly maxTags', () => {
    const input = '<p>a</p>'.repeat(10)

    const over = () => sanitizeHtml(input, { maxTags: 9 })
    const exact = sanitizeHtml(input, { maxTags: 10 })

    expect(over).toThrow(expect.objectContaining({ code: 'TOO_COMPLEX' }))
    expect(exact).toBe(input)
  })

  it('refuses a template in any letter case and after removed NUL characters', () => {
    const inputs = ['<TEMPLATE>x</TEMPLATE>', '<template\n>x', '<temp\0late>x', '<template']

    const codes = inputs.map((input) => {
      try {
        sanitizeHtml(input)
        return null
      } catch (error) {
        return (error as SanitizeError).code
      }
    })

    expect(codes).toEqual(['TOO_COMPLEX', 'TOO_COMPLEX', 'TOO_COMPLEX', 'TOO_COMPLEX'])
  })

  it('keeps text that only mentions a template', () => {
    const clean = sanitizeHtml('<p>&lt;template&gt; ve <code>templates</code></p><p>x</p>')

    expect(clean).toBe('<p>&lt;template&gt; ve <code>templates</code></p><p>x</p>')
  })

  it('accepts a tag with exactly 64 attributes', () => {
    const input = `<p${' a=1'.repeat(64)}>x</p>`

    const clean = sanitizeHtml(input)

    expect(clean).toBe('<p>x</p>')
  })

  it.each([
    ['<h6><sup><h2>x', '<h6><sup><h2>x</h2></sup></h6>'],
    ['<h6><font><h2>x', '<h6></h6><h2>x</h2>'],
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
