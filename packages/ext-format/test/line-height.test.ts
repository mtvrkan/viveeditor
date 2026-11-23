import { afterEach, describe, expect, it } from 'vitest'
import { html, mount, unmountAll } from './helpers.js'

afterEach(unmountAll)

describe('line height', () => {
  it('writes the line height after the alignment of a heading', async () => {
    const editor = await mount('<h2 style="text-align: center">Başlık</h2>')
    editor.commands.selectAll()

    const set = editor.commands.setLineHeight('1.15')

    expect(set).toBe(true)
    expect(html(editor)).toBe('<h2 style="text-align: center; line-height: 1.15">Başlık</h2>')
    expect(editor.query.lineHeight()).toBe('1.15')
  })

  it('keeps alignment, indent and line height in a fixed order', async () => {
    const editor = await mount(
      '<p style="line-height: 2; margin-inline-start: 2em; text-align: right">metin</p>',
    )

    expect(html(editor)).toBe(
      '<p style="text-align: right; margin-inline-start: 2em; line-height: 2">metin</p>',
    )
  })

  it.each(['150%', '1.6', '24px', 'normal'])('drops the pasted line height %s', async (value) => {
    const editor = await mount(`<p style="line-height: ${value}">metin</p>`)

    expect(html(editor)).toBe('<p>metin</p>')
    expect(editor.query.lineHeight()).toBeNull()
  })

  it('removes the line height with null and with clear formatting', async () => {
    const editor = await mount(
      '<p style="line-height: 1.5">bir</p><p style="line-height: 1">iki</p>',
    )
    editor.commands.setTextSelection(1, 3)
    editor.commands.setLineHeight(null)
    editor.commands.selectAll()
    editor.commands.clearFormatting()

    expect(html(editor)).toBe('<p>bir</p><p>iki</p>')
  })

  it('refuses a value outside the fixed list', async () => {
    const editor = await mount('<p>metin</p>')
    editor.commands.selectAll()

    const set = editor.commands.setLineHeight('1.6' as '1.5')

    expect(set).toBe(false)
    expect(html(editor)).toBe('<p>metin</p>')
  })
})
