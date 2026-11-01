import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cleanPastedHtml } from '../src/index.js'

function fixture(name: string): string {
  return readFileSync(resolve(process.cwd(), '../../tests/fixtures/paste', name), 'utf8')
}

describe('cleanPastedHtml', () => {
  it('strips Word metadata, list bullets and empty o:p paragraphs', () => {
    const html = cleanPastedHtml(fixture('word.html'))

    expect(html).not.toMatch(/<o:p|<style|<xml|<meta|<!--|mso-list:Ignore|·/)
    expect(html).toContain('<b>Rapor</b>')
    expect(html).toContain('Birinci madde')
  })

  it('unwraps the Google Docs guid wrapper but keeps its content', () => {
    const html = cleanPastedHtml(fixture('google-docs.html'))

    expect(html).not.toContain('docs-internal-guid')
    expect(html).toContain('Toplantı notları')
    expect(html).toContain('font-weight:700')
  })

  it('drops the trailing newline browsers append to copied content', () => {
    const html = cleanPastedHtml('<p>son</p><br class="Apple-interchange-newline">')

    expect(html).toBe('<p>son</p>')
  })

  it('returns plain markup unchanged apart from normalisation', () => {
    const html = cleanPastedHtml('<p>sade <em>metin</em></p>')

    expect(html).toBe('<p>sade <em>metin</em></p>')
  })

  it('removes scripts and templates even before the schema sees them', () => {
    const html = cleanPastedHtml('<p>a</p><script>alert(1)</script><template><p>x</p></template>')

    expect(html).toBe('<p>a</p>')
  })
})
