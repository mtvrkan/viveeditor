import { basicExtensions } from '@viveeditor/ext-basic'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_FONT_FAMILIES, FontFamily, formatExtensions } from '../src/index.js'
import { html, mount, unmountAll } from './helpers.js'

afterEach(unmountAll)

describe('font family', () => {
  it('writes a list entry verbatim and reports it', async () => {
    const editor = await mount('<p>yazı tipi</p>')
    editor.commands.setTextSelection(1, 5)

    const set = editor.commands.setFontFamily("'Times New Roman', Times, serif")

    expect(set).toBe(true)
    expect(html(editor)).toBe(
      `<p><span style="font-family: 'Times New Roman', Times, serif">yazı</span> tipi</p>`,
    )
    expect(editor.query.fontFamily()).toBe("'Times New Roman', Times, serif")
  })

  it('exports the default list in order', () => {
    expect(DEFAULT_FONT_FAMILIES).toEqual([
      'serif',
      'sans-serif',
      'monospace',
      'Arial, Helvetica, sans-serif',
      'Georgia, serif',
      "'Times New Roman', Times, serif",
      "'Courier New', Courier, monospace",
      'Verdana, Geneva, sans-serif',
    ])
  })

  it('lists the configured families in their canonical form', async () => {
    const custom = await mount('<p>a</p>', [
      ...basicExtensions,
      FontFamily.configure({ fontFamilies: ["'Open Sans',sans-serif", 'Georgia, serif'] }),
    ])
    const defaults = await mount('<p>a</p>')

    expect(custom.query.fontFamilies()).toEqual(["'Open Sans', sans-serif", 'Georgia, serif'])
    expect(defaults.query.fontFamilies()).toEqual(DEFAULT_FONT_FAMILIES)
  })

  it('maps a pasted family to the list entry by its full list or its first name', async () => {
    const editor = await mount(
      '<p><span style=\'font-family: "Times New Roman", Times, SERIF\'>bir</span> <span style=\'font-family: "Times New Roman", serif\'>iki</span> <span style="font-family: Calibri, sans-serif">üç</span> <span style="font-family: Helvetica, Arial">dört</span></p>',
    )

    expect(html(editor)).toBe(
      `<p><span style="font-family: 'Times New Roman', Times, serif">bir</span> <span style="font-family: 'Times New Roman', Times, serif">iki</span> üç dört</p>`,
    )
  })

  it('keeps the first list entry when two entries share a first name', async () => {
    const editor = await mount('<p><span style="font-family: Georgia">bir</span></p>', [
      ...basicExtensions,
      FontFamily.configure({ fontFamilies: ['Georgia, serif', 'Georgia, Times, serif'] }),
    ])

    expect(html(editor)).toBe('<p><span style="font-family: Georgia, serif">bir</span></p>')
    expect(editor.query.fontFamilies()).toEqual(['Georgia, serif', 'Georgia, Times, serif'])
  })

  it('refuses a family outside the configured list', async () => {
    const editor = await mount('<p>metin</p>')
    editor.commands.selectAll()

    const set = editor.commands.setFontFamily('Comic Sans MS')

    expect(set).toBe(false)
    expect(html(editor)).toBe('<p>metin</p>')
    expect(editor.query.fontFamily()).toBeNull()
  })

  it('removes the family with unset and with clear formatting', async () => {
    const editor = await mount(
      '<p><span style="font-family: monospace">bir</span> <span style="font-family: serif">iki</span></p>',
    )
    editor.commands.setTextSelection(1, 4)
    editor.commands.unsetFontFamily()
    editor.commands.selectAll()
    editor.commands.clearFormatting()

    expect(html(editor)).toBe('<p>bir iki</p>')
  })

  it('uses a host list and writes its canonical form', async () => {
    const extensions = [
      ...basicExtensions,
      ...formatExtensions.filter((extension) => extension !== FontFamily),
      FontFamily.configure({ fontFamilies: ["'Open Sans',sans-serif"] }),
    ]
    const editor = await mount('<p>metin</p>', extensions)
    editor.commands.selectAll()

    const results = [
      editor.commands.setFontFamily('serif'),
      editor.commands.setFontFamily('open sans, sans-serif'),
    ]

    expect(results).toEqual([false, true])
    expect(html(editor)).toBe(
      `<p><span style="font-family: 'Open Sans', sans-serif">metin</span></p>`,
    )
  })

  it.each([['Arial; color: red'], ['"Arial"'], ['1Font'], [`${'A'.repeat(65)}`]])(
    'throws at setup for the host entry %s',
    async (entry) => {
      const extensions = [
        ...basicExtensions,
        ...formatExtensions.filter((extension) => extension !== FontFamily),
        FontFamily.configure({ fontFamilies: [entry] }),
      ]

      await expect(mount('<p>metin</p>', extensions)).rejects.toThrow(TypeError)
    },
  )

  it('reports no family for a selection that mixes families and the one family when it does not', async () => {
    const editor = await mount(
      '<p><span style="font-family: Georgia, serif">bir</span> iki <span style="font-family: Georgia, serif">üç</span></p>',
    )
    editor.commands.setTextSelection(1, 6)
    const mixed = editor.query.fontFamily()
    editor.commands.setTextSelection(1, 3)
    const single = editor.query.fontFamily()

    expect(mixed).toBeNull()
    expect(single).toBe('Georgia, serif')
  })

  it('writes the canonical entry when a browser hands back the family with double quotes', async () => {
    const editor = await mount(
      '<p><span style="font-family: &quot;Courier New&quot;, Courier, monospace">kod</span></p>',
    )

    expect(editor.getHTML()).toBe(
      `<p><span style="font-family: 'Courier New', Courier, monospace">kod</span></p>`,
    )
  })
})
