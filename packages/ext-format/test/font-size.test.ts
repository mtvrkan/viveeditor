import { afterEach, describe, expect, it } from 'vitest'
import { html, mount, press, unmountAll } from './helpers.js'

afterEach(unmountAll)

describe('font size', () => {
  it('sets one of the fixed sizes as an em value and reports it', async () => {
    const editor = await mount('<p>büyük yazı</p>')
    editor.commands.setTextSelection(1, 6)

    editor.commands.setFontSize('big')

    expect(html(editor)).toBe('<p><span style="font-size: 1.25em">büyük</span> yazı</p>')
    expect(editor.query.fontSize()).toBe('big')
  })

  it('refuses a size outside the fixed steps', async () => {
    const editor = await mount('<p>metin</p>')
    editor.commands.selectAll()

    const set = editor.commands.setFontSize('enormous' as 'big')

    expect(set).toBe(false)
    expect(html(editor)).toBe('<p>metin</p>')
  })

  it('keeps only its own sizes from pasted HTML', async () => {
    const editor = await mount(
      '<p><span style="font-size: 0.75em">küçük</span> <span style="font-size: 11pt">word</span> <span style="font-size: 1.5EM">dev</span></p>',
    )

    expect(html(editor)).toBe(
      '<p><span style="font-size: 0.75em">küçük</span> word <span style="font-size: 1.5em">dev</span></p>',
    )
  })

  it('steps through the sizes with the shortcuts and stops at both ends', async () => {
    const editor = await mount('<p>metin</p>')
    editor.commands.selectAll()

    const grown = [1, 2, 3].map(() =>
      press(editor, { key: '>', keyCode: 190, ctrlKey: true, shiftKey: true }),
    )
    const biggest = editor.query.fontSize()
    const shrunk = [1, 2, 3, 4, 5].map(() =>
      press(editor, { key: '<', keyCode: 188, ctrlKey: true, shiftKey: true }),
    )

    expect(grown).toEqual([true, true, false])
    expect(biggest).toBe('huge')
    expect(shrunk).toEqual([true, true, true, true, false])
    expect(editor.query.fontSize()).toBe('tiny')
  })

  it('goes back to the normal size from the middle step', async () => {
    const editor = await mount('<p><span style="font-size: 0.875em">metin</span></p>')
    editor.commands.selectAll()

    editor.commands.stepFontSize(1)

    expect(html(editor)).toBe('<p>metin</p>')
    expect(editor.query.fontSize()).toBeNull()
  })
})
