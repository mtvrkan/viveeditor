import { basicExtensions } from '@viveeditor/ext-basic'
import { afterEach, describe, expect, it } from 'vitest'
import { formatExtensions, Indent } from '../src/index.js'
import { html, mount, press, unmountAll } from './helpers.js'

afterEach(unmountAll)

describe('indent', () => {
  it('indents every paragraph and heading in the selection by 2em steps', async () => {
    const editor = await mount('<h2>Başlık</h2><p>Metin</p>')
    editor.commands.selectAll()

    editor.commands.indent()
    editor.commands.indent()

    expect(html(editor)).toBe(
      '<h2 style="margin-inline-start: 4em">Başlık</h2><p style="margin-inline-start: 4em">Metin</p>',
    )
    expect(editor.query.indentLevel()).toBe(2)
  })

  it('stops at level 8 and at zero', async () => {
    const editor = await mount('<p style="margin-inline-start: 16em">derin</p>')
    editor.commands.setTextSelection(2)

    const deeper = editor.commands.indent()
    const steps = Array.from({ length: 8 }, () => editor.commands.outdent())
    const below = editor.commands.outdent()

    expect(deeper).toBe(false)
    expect(steps.every(Boolean)).toBe(true)
    expect(below).toBe(false)
    expect(html(editor)).toBe('<p>derin</p>')
  })

  it('ignores indents it did not write', async () => {
    const editor = await mount(
      '<p style="margin-inline-start: 3em">tek</p><p style="margin-inline-start: 40em">fazla</p><p style="margin-left: 36pt">word</p>',
    )

    expect(html(editor)).toBe('<p>tek</p><p>fazla</p><p>word</p>')
  })

  it('skips blocks whose parent is listed in skipParents', async () => {
    const extensions = [
      ...basicExtensions,
      ...formatExtensions.filter((extension) => extension.name !== 'indent'),
      Indent.configure({ skipParents: ['blockquote'] }),
    ]
    const editor = await mount('<blockquote><p>alıntı</p></blockquote><p>düz</p>', extensions)
    editor.commands.selectAll()

    editor.commands.indent()

    expect(html(editor)).toBe(
      '<blockquote><p>alıntı</p></blockquote><p style="margin-inline-start: 2em">düz</p>',
    )
  })

  it('keeps alignment and indent together and clears both with clear formatting', async () => {
    const editor = await mount('<p style="text-align: center">orta</p>')
    editor.commands.setTextSelection(2)

    press(editor, { key: ']', ctrlKey: true })
    const both = html(editor)
    editor.commands.clearFormatting()

    expect(both).toBe('<p style="text-align: center; margin-inline-start: 2em">orta</p>')
    expect(html(editor)).toBe('<p>orta</p>')
  })
})
