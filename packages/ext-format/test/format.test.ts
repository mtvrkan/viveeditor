import { Editor, type Extension } from '@viveeditor/core'
import { Heading } from '@viveeditor/ext-basic'
import { afterEach, describe, expect, it } from 'vitest'
import { formatExtensions, normalizeColor, TextAlign } from '../src/index.js'

let editors: Editor[] = []

async function mount(
  content: Parameters<Editor['setContent']>[0],
  extensions: readonly Extension[] = [Heading, ...formatExtensions],
): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, { extensions, content })
  editors.push(editor)
  return editor
}

const withoutTrailingSemicolon = (html: string): string => html.replace(/;"/g, '"')

const markColors = (editor: Editor, type: string): unknown[] =>
  (editor.getJSON().content ?? [])
    .flatMap((block) => block.content ?? [])
    .flatMap((inline) => inline.marks ?? [])
    .filter((mark) => mark.type === type)
    .map((mark) => mark.attrs?.color)

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('TextAlign', () => {
  it('centers every paragraph and heading in the selection', async () => {
    const editor = await mount('<h2>Başlık</h2><p>Metin</p>')
    editor.commands.selectAll()

    editor.commands.setTextAlign('center')

    expect(withoutTrailingSemicolon(editor.getHTML())).toBe(
      '<h2 style="text-align: center">Başlık</h2><p style="text-align: center">Metin</p>',
    )
    expect(editor.query.textAlign()).toBe('center')
  })

  it('stores nothing for the default alignment', async () => {
    const editor = await mount('<p style="text-align: right">Metin</p>')
    editor.commands.selectAll()

    editor.commands.setTextAlign('left')

    expect(editor.getHTML()).toBe('<p>Metin</p>')
    expect(editor.query.textAlign()).toBe('left')
  })

  it('reads the legacy align attribute and ignores unknown values', async () => {
    const editor = await mount('<p align="justify">a</p><p style="text-align: start">b</p>')

    const blocks = editor.getJSON().content ?? []

    expect(blocks.map((block) => block.attrs?.textAlign)).toEqual(['justify', null])
  })

  it('refuses an alignment that is not configured', async () => {
    const editor = await mount('<p>a</p>', [
      TextAlign.configure({ alignments: ['left', 'center'] }),
    ])

    const result = editor.commands.setTextAlign('justify')

    expect(result).toBe(false)
    expect(editor.getHTML()).toBe('<p>a</p>')
  })
})

describe('normalizeColor', () => {
  it.each([
    ['#F00', '#ff0000'],
    ['#1a2B3c', '#1a2b3c'],
    ['rgb(255, 0, 0)', '#ff0000'],
    ['rgba(0, 0, 0, 0.5)', '#00000080'],
    ['hsl(202, 80%, 36%)', 'hsl(202, 80%, 36%)'],
    ['Crimson', 'crimson'],
  ])('accepts %s', (input, expected) => {
    expect(normalizeColor(input)).toBe(expected)
  })

  it.each([
    'red; background: url(https://evil.test/x)',
    'expression(alert(1))',
    'url(javascript:alert(1))',
    'transparent',
    'rgba(0, 0, 0, 0)',
    '#12',
    '',
  ])('rejects %s', (input) => {
    expect(normalizeColor(input)).toBeNull()
  })
})

describe('TextColor', () => {
  it('colours the selection with a normalized value', async () => {
    const editor = await mount('<p>renk</p>')
    editor.commands.selectAll()

    editor.commands.setTextColor('rgb(200, 30, 30)')

    expect(markColors(editor, 'textColor')).toEqual(['#c81e1e'])
    expect(editor.getHTML()).toMatch(/^<p><span style="color: [^"]+">renk<\/span><\/p>$/)
  })

  it('drops pasted default black but keeps real colours', async () => {
    const editor = await mount(
      '<p><span style="color: rgb(0, 0, 0)">siyah</span> <font color="#0a7">yeşil</font></p>',
    )

    const colors = markColors(editor, 'textColor')

    expect(colors).toEqual(['#00aa77'])
    expect(editor.getHTML()).toMatch(/^<p>siyah <span style="[^"]+">yeşil<\/span><\/p>$/)
  })

  it('refuses an unsafe colour and never renders one from JSON', async () => {
    const editor = await mount({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [{ type: 'textColor', attrs: { color: 'red;background:url(//evil.test)' } }],
            },
          ],
        },
      ],
    })
    editor.commands.selectAll()

    const result = editor.commands.setTextColor('red;position:fixed')

    expect(result).toBe(false)
    expect(editor.getHTML()).toBe('<p><span>x</span></p>')
  })
})

describe('TextColor in the editing surface', () => {
  it('exposes the colour as --vive-ink on screen but not in saved HTML', async () => {
    const editor = await mount('<p><span style="color: #1565c0">mavi</span></p>')

    const span = editor.dom.querySelector('span')

    expect(span?.getAttribute('style')).toBe('color: #1565c0; --vive-ink: #1565c0')
    expect(editor.getHTML()).toMatch(/^<p><span style="color: [^";]+;?">mavi<\/span><\/p>$/)
  })

  it('renders no style on screen for an unsafe colour from JSON', async () => {
    const editor = await mount({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [{ type: 'textColor', attrs: { color: 'red;--vive-ink:url(//evil.test)' } }],
            },
          ],
        },
      ],
    })

    const span = editor.dom.querySelector('span')

    expect(span?.hasAttribute('style')).toBe(false)
  })
})

describe('Highlight', () => {
  it('toggles the default highlight on and off', async () => {
    const editor = await mount('<p>önemli</p>')
    editor.commands.selectAll()

    editor.commands.toggleHighlight()
    const highlighted = editor.getHTML()
    editor.commands.toggleHighlight()

    expect(highlighted).toBe('<p><mark>önemli</mark></p>')
    expect(editor.getHTML()).toBe('<p>önemli</p>')
  })

  it('reads a pasted background colour and ignores white', async () => {
    const editor = await mount(
      '<p><span style="background-color: #fff2a8">sarı</span> <span style="background-color: white">beyaz</span></p>',
    )

    const colors = markColors(editor, 'highlight')

    expect(colors).toEqual(['#fff2a8'])
    expect(editor.getHTML()).toMatch(/^<p><mark style="[^"]+">sarı<\/mark> beyaz<\/p>$/)
  })
})
