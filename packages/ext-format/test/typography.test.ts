import { basicExtensions } from '@viveeditor/ext-basic'
import { afterEach, describe, expect, it } from 'vitest'
import { formatExtensions, Typography } from '../src/index.js'
import { mount, press, type, unmountAll } from './helpers.js'

afterEach(unmountAll)

describe('typography', () => {
  it('turns straight quotes into curly ones and keeps the Turkish apostrophe', async () => {
    const editor = await mount('<p></p>')

    type(editor, `"Merhaba" dedi, 'evet' Ankara'da`)

    expect(editor.getText()).toBe('“Merhaba” dedi, ‘evet’ Ankara’da')
  })

  it('replaces dashes, ellipsis, symbols and arrows', async () => {
    const editor = await mount('<p></p>')

    type(editor, 'a--b c -- d ... (c) (R) (tm) -> <-')

    expect(editor.getText()).toBe('a—b c — d … © ® ™ → ←')
  })

  it('leaves three dashes at the start of a line to the horizontal rule', async () => {
    const editor = await mount('<p></p>')

    type(editor, '---')

    expect(editor.getHTML()).toContain('<hr>')
  })

  it('does nothing inside inline code', async () => {
    const editor = await mount('<p><code>x</code></p>')
    editor.commands.setTextSelection(2)

    type(editor, '"a"--')

    expect(editor.getHTML()).toBe('<p><code>x"a"--</code></p>')
  })

  it('takes back a replacement with Backspace', async () => {
    const editor = await mount('<p></p>')
    type(editor, '(c)')

    press(editor, { key: 'Backspace' })

    expect(editor.getText()).toBe('(c)')
  })

  it('uses the configured quotes or none', async () => {
    const german = await mount('<p></p>', [
      ...basicExtensions,
      ...formatExtensions.filter((extension) => extension.name !== 'typography'),
      Typography.configure({ quotes: ['„', '“', '‚', '‘'] }),
    ])
    const plain = await mount('<p></p>', [
      ...basicExtensions,
      ...formatExtensions.filter((extension) => extension.name !== 'typography'),
      Typography.configure({ quotes: null }),
    ])

    type(german, '"ja"')
    type(plain, '"no"...')

    expect(german.getText()).toBe('„ja“')
    expect(plain.getText()).toBe('"no"…')
  })
})
