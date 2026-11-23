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
      `<p><span style="font-family: &quot;Times New Roman&quot;, Times, serif">yazı</span> tipi</p>`,
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

  it('maps a pasted family to the list entry only on an exact canonical match', async () => {
    const editor = await mount(
      '<p><span style=\'font-family: "Times New Roman", Times, SERIF\'>bir</span> <span style=\'font-family: "Times New Roman", serif\'>iki</span> <span style="font-family: Calibri">üç</span></p>',
    )

    expect(html(editor)).toBe(
      `<p><span style="font-family: &quot;Times New Roman&quot;, Times, serif">bir</span> iki üç</p>`,
    )
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
      `<p><span style="font-family: &quot;Open Sans&quot;, sans-serif">metin</span></p>`,
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
})
