import { expect, type Page, test } from '@playwright/test'

type Sanitize = (html: string) => string

const SANITIZER = '../../packages/sanitize/dist/index.mjs'
let sanitizeHtml: Sanitize = () => {
  throw new Error('The sanitizer is not loaded yet.')
}

test.beforeAll(async () => {
  sanitizeHtml = ((await import(SANITIZER)) as { sanitizeHtml: Sanitize }).sanitizeHtml
})

interface Step {
  select?: string
  cell?: string
  command: string
  args?: unknown[]
}

const hex = (value: string): string => Number(value).toString(16).padStart(2, '0')

const cssomForm = (html: string): string =>
  html.replace(/style="([^"]*)"/g, (_match, style: string) => {
    const declarations = style
      .split(';')
      .map((declaration) =>
        declaration
          .trim()
          .replace(
            /rgb\((\d+), (\d+), (\d+)\)/g,
            (_rgb, red: string, green: string, blue: string) =>
              `#${hex(red)}${hex(green)}${hex(blue)}`,
          ),
      )
      .filter(Boolean)
    return `style="${declarations.join('; ')}"`
  })

const BASE = [
  '<p>Boyut metni ve adım metni</p>',
  '<p>Times metni ile Georgia metni</p>',
  '<p>Kırmızı yazı ve vurgulu yazı</p>',
  '<h2>Ortalı başlık</h2>',
  '<ol><li><p>birinci</p></li><li><p>ikinci</p></li></ol>',
  '<ul><li><p>kare madde</p></li></ul>',
  '<p>Yeni sekme bağlantısı</p>',
  '<p>Kod öncesi</p>',
  '<pre><code>const a = 1</code></pre>',
  '<table><tbody><tr><th><p>A1</p></th><th><p>B1</p></th></tr><tr><td><p>A2</p></td><td><p>B2</p></td></tr><tr><td><p>A3</p></td><td><p>B3</p></td></tr></tbody></table>',
  '<p>Görsel sonrası</p>',
].join('')

const STEPS: Step[] = [
  { select: 'Boyut metni', command: 'setFontSize', args: [14] },
  { select: 'adım metni', command: 'setFontSize', args: ['big'] },
  { select: 'Times metni', command: 'setFontFamily', args: ['"Times New Roman", Times, serif'] },
  { select: 'Georgia metni', command: 'setFontFamily', args: ['Georgia, serif'] },
  { select: 'Kırmızı yazı', command: 'setTextColor', args: ['rgb(198, 40, 40)'] },
  { select: 'vurgulu yazı', command: 'setHighlight', args: ['#FFF2A8'] },
  { select: 'Ortalı başlık', command: 'setTextAlign', args: ['center'] },
  { select: 'Ortalı başlık', command: 'setLineHeight', args: ['1.5'] },
  { select: 'Ortalı başlık', command: 'indent' },
  { select: 'birinci', command: 'setListType', args: ['a'] },
  { select: 'birinci', command: 'setListStart', args: [3] },
  { select: 'kare madde', command: 'setBulletStyle', args: ['square'] },
  {
    select: 'Yeni sekme',
    command: 'setLink',
    args: [{ href: 'https://example.com/a?b=1&c=2', title: 'Örnek "site"', newTab: true }],
  },
  { select: 'const a', command: 'setCodeBlockLanguage', args: ['typescript'] },
  { cell: 'A1', command: 'setCellBackground', args: ['rgb(205, 232, 255)'] },
  { cell: 'A1', command: 'setCellTextAlign', args: ['center'] },
  { cell: 'A2', command: 'setCellVerticalAlign', args: ['middle'] },
  { cell: 'A2', command: 'setCellTextAlign', args: ['right'] },
  { cell: 'B3', command: 'setTableWidth', args: ['full'] },
  { cell: 'B3', command: 'setTableAlign', args: ['center'] },
  { cell: 'B3', command: 'setTableBorder', args: ['rows'] },
  { cell: 'B3', command: 'setTableStriped', args: [true] },
  { cell: 'B3', command: 'setTableBorderColor', args: ['#1565C0'] },
  { select: 'Görsel sonrası', command: 'setTextSelection', args: [-1] },
  {
    command: 'insertImage',
    args: [
      {
        src: 'https://images.example.test/kedi.png',
        alt: 'Kedi',
        caption: 'Şekil 1',
        align: 'center',
        href: 'https://example.com/kedi',
      },
    ],
  },
]

async function build(page: Page): Promise<{ html: string; json: unknown; failed: string[] }> {
  await page.route('https://images.example.test/**', (route) =>
    route.fulfill({ status: 404, body: '' }),
  )
  await page.goto('/ui.html?empty')
  return page.evaluate(
    ({ base, steps }) => {
      interface Doc {
        descendants(visit: (node: Node, pos: number) => boolean | undefined): void
      }
      interface Node {
        isText: boolean
        text?: string
        type: { name: string }
        textContent: string
      }
      const editor = (
        window as unknown as {
          viveEditor: {
            setContent(html: string): void
            getHTML(): string
            getJSON(): unknown
            view: { state: { doc: Doc } }
            commands: Record<string, (...args: unknown[]) => boolean>
          }
        }
      ).viveEditor
      editor.setContent(base)
      const find = (needle: string): { from: number; to: number } => {
        let found: { from: number; to: number } | null = null
        editor.view.state.doc.descendants((node, pos) => {
          if (found) return false
          if (node.isText && node.text?.includes(needle)) {
            const from = pos + node.text.indexOf(needle)
            found = { from, to: from + needle.length }
          }
          return undefined
        })
        if (!found) throw new Error(`Text not found: ${needle}`)
        return found
      }
      const failed: string[] = []
      for (const step of steps) {
        if (step.select) {
          const { from, to } = find(step.select)
          const args = step.args ?? []
          if (step.command === 'setTextSelection') {
            editor.commands.setTextSelection?.(to)
            continue
          }
          editor.commands.setTextSelection?.(from, to)
          if (!editor.commands[step.command]?.(...args)) failed.push(step.command)
          continue
        }
        if (step.cell) editor.commands.setTextSelection?.(find(step.cell).from)
        if (!editor.commands[step.command]?.(...(step.args ?? []))) failed.push(step.command)
      }
      return { html: editor.getHTML(), json: editor.getJSON(), failed }
    },
    { base: BASE, steps: STEPS },
  )
}

test('every 1.0 feature survives the Node sanitizer unchanged apart from the browser CSS formatting and loads back the same', async ({
  page,
}) => {
  const { html, json, failed } = await build(page)

  expect(failed).toEqual([])
  for (const fragment of [
    'font-size: 14pt',
    "font-family: 'Times New Roman', Times, serif",
    'line-height: 1.5',
    'list-style-type: square',
    'type="a"',
    'start="3"',
    'target="_blank"',
    'data-language="typescript"',
    '<figure',
    '<figcaption>',
  ]) {
    expect(html).toContain(fragment)
  }
  const clean = sanitizeHtml(html)
  expect(clean).toBe(cssomForm(html))
  expect(sanitizeHtml(clean)).toBe(clean)

  const reloaded = await page.evaluate((clean) => {
    const editor = (
      window as unknown as {
        viveEditor: { setContent(html: string): void; getJSON(): unknown; getHTML(): string }
      }
    ).viveEditor
    editor.setContent(clean)
    return { json: editor.getJSON(), html: editor.getHTML() }
  }, clean)

  expect(reloaded.json).toEqual(json)
  expect(reloaded.html).toBe(html)
})

test('a font family typed with double quotes is written with the canonical single quotes', async ({
  page,
}) => {
  await page.goto('/ui.html?empty')

  const html = await page.evaluate(() => {
    const editor = (
      window as unknown as { viveEditor: { setContent(html: string): void; getHTML(): string } }
    ).viveEditor
    editor.setContent(
      '<p><span style="font-family: &quot;Courier New&quot;, Courier, monospace">kod</span></p>',
    )
    return editor.getHTML()
  })

  expect(html).toBe(
    `<p><span style="font-family: 'Courier New', Courier, monospace">kod</span></p>`,
  )
  expect(sanitizeHtml(html)).toBe(html)
})
