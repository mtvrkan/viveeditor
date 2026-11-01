import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { classicPreset, Editor, Embed } from 'viveeditor'
import { sanitizeHtml } from '../src/index.js'

const hex = (value: string): string => Number(value).toString(16).padStart(2, '0')

const normalizeDeclaration = (declaration: string): string =>
  declaration
    .trim()
    .replace(
      /rgb\((\d+), (\d+), (\d+)\)/g,
      (_match, red, green, blue) => `#${hex(red)}${hex(green)}${hex(blue)}`,
    )
    .replace(/\b0px\b/g, '0')

const semantic = (html: string): string =>
  html.replace(/style="([^"]*)"/g, (_match, style: string) => {
    const declarations = style.split(';').map(normalizeDeclaration).filter(Boolean)
    return `style="${declarations.join('; ')}"`
  })

const FIXTURE = resolve(process.cwd(), '../../tests/fixtures/sanitize/kitchen-sink.html')
const SANITIZED = resolve(
  process.cwd(),
  '../../tests/fixtures/sanitize/kitchen-sink.sanitized.html',
)

const SOURCE = [
  '<h1 style="text-align: center">Başlık</h1>',
  '<h2>Alt başlık</h2>',
  '<p style="text-align: right">Sağa <strong>kalın</strong> <em>italik</em> <u>altı</u> <s>üstü</s> <code>kod</code></p>',
  '<p><a href="https://example.com/a?b=1&amp;c=2" title="Örnek">bağlantı</a> <a href="/göreli">göreli</a> <a href="mailto:a@example.com">posta</a></p>',
  '<p><span style="color: #ff0000">kırmızı</span> <span style="color: rebeccapurple">mor</span> <mark style="background-color: #fff3a0">vurgu</mark></p>',
  '<p>satır<br>sonu</p>',
  '<ul><li><p>bir</p><ul><li><p>iç</p></li></ul></li></ul>',
  '<ol start="3"><li><p>üç</p></li></ol>',
  '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>bitti</p></li><li data-type="taskItem" data-checked="false"><p>bekliyor</p></li></ul>',
  '<pre data-language="typescript"><code class="language-typescript">const a = 1 &lt; 2</code></pre>',
  '<pre><code>düz kod</code></pre>',
  '<blockquote><p>alıntı</p></blockquote>',
  '<hr>',
  '<table><tbody><tr><th colspan="2" data-colwidth="120,80"><p>başlık</p></th></tr><tr><td><p>a</p></td><td rowspan="1"><p>b</p></td></tr></tbody></table>',
  '<img src="https://images.example.com/photo.jpg" alt="Fotoğraf" title="Başlık" width="640" height="480">',
  '<div class="vive-embed" data-embed="youtube" data-id="dQw4w9WgXcQ" data-start="42" data-title="Video"></div>',
  '<div class="vive-embed" data-embed="vimeo" data-id="76979871" data-hash="abcdef12"></div>',
  '<div class="vive-embed" data-embed="spotify" data-id="track:4uLU6hMCjMI75M1A2tKUQC"></div>',
  '<div class="vive-embed" data-embed="spotify" data-id="album:1DFixLWuPkv3KT3TnV35m3"></div>',
].join('')

async function editorHtml(content: string, facade = false): Promise<string> {
  const host = document.createElement('div')
  document.body.append(host)
  const extensions = classicPreset('tr').map((extension) =>
    facade && extension.name === 'embed' ? Embed.configure({ facade: true }) : extension,
  )
  const editor = await Editor.create(host, { extensions, content })
  const html = editor.getHTML()
  editor.destroy()
  host.remove()
  return html
}

describe('editor output', () => {
  it('matches the shared kitchen-sink fixture', async () => {
    const html = await editorHtml(SOURCE)
    if (process.env.UPDATE_FIXTURES) writeFileSync(FIXTURE, `${html}\n`)

    const fixture = readFileSync(FIXTURE, 'utf8').trimEnd()

    expect(html).toBe(fixture)
  })

  it('passes through the sanitizer unchanged when embeds are allowed', async () => {
    const html = await editorHtml(SOURCE)

    const clean = sanitizeHtml(html, { embeds: true })

    expect(semantic(clean)).toBe(semantic(html))
    expect(sanitizeHtml(clean, { embeds: true })).toBe(clean)
  })

  it('matches the shared sanitized kitchen-sink fixture', () => {
    const html = readFileSync(FIXTURE, 'utf8').trimEnd()
    if (process.env.UPDATE_FIXTURES)
      writeFileSync(SANITIZED, `${sanitizeHtml(html, { embeds: true })}\n`)

    const clean = sanitizeHtml(html, { embeds: true })

    expect(clean).toBe(readFileSync(SANITIZED, 'utf8').trimEnd())
  })

  it('keeps embed facade links unchanged', async () => {
    const html = await editorHtml(SOURCE, true)

    const clean = sanitizeHtml(html, { embeds: true })

    expect(semantic(clean)).toBe(semantic(html))
  })

  it('loads back into the editor as the same document', async () => {
    const html = await editorHtml(SOURCE)

    const reloaded = await editorHtml(sanitizeHtml(html, { embeds: true }))

    expect(reloaded).toBe(html)
  })

  it('drops only the embeds when embeds are not allowed', async () => {
    const html = await editorHtml(SOURCE)

    const clean = sanitizeHtml(html)

    expect(clean).not.toContain('vive-embed')
    expect(clean).not.toContain('<iframe')
    expect(semantic(clean)).toBe(semantic(html.replace(/<div class="vive-embed".*?<\/div>/g, '')))
  })
})
