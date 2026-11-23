import { afterEach, describe, expect, it } from 'vitest'
import { parseFontPoints } from '../src/index.js'
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

  it('keeps the em steps and canonical point sizes from pasted HTML', async () => {
    const editor = await mount(
      '<p><span style="font-size: 0.75em">küçük</span> <span style="font-size: 11pt">word</span> <span style="font-size: 1.5EM">dev</span> <span style="font-size: 12px">piksel</span></p>',
    )

    expect(html(editor)).toBe(
      '<p><span style="font-size: 0.75em">küçük</span> <span style="font-size: 11pt">word</span> <span style="font-size: 1.5em">dev</span> piksel</p>',
    )
  })

  it.each([
    ['14pt', '14pt'],
    ['10.5pt', '10.5pt'],
    ['06.0PT', '6pt'],
  ])('reads %s back as %s', async (input, output) => {
    const editor = await mount(`<p><span style="font-size: ${input}">metin</span></p>`)

    expect(html(editor)).toBe(`<p><span style="font-size: ${output}">metin</span></p>`)
  })

  it.each(['5.5pt', '96.5pt', '12.25pt', '12px', '100pt'])('drops %s', async (input) => {
    const editor = await mount(`<p><span style="font-size: ${input}">metin</span></p>`)

    expect(html(editor)).toBe('<p>metin</p>')
  })

  it('writes the canonical form of a point size', () => {
    expect([
      parseFontPoints('06.0PT'),
      parseFontPoints(' 10.5pt '),
      parseFontPoints('96pt'),
      parseFontPoints('96.5pt'),
      parseFontPoints('5.5pt'),
      parseFontPoints('12.25pt'),
    ]).toEqual(['6pt', '10.5pt', '96pt', null, null, null])
  })

  it('rounds a number of points to the nearest half point', async () => {
    const editor = await mount('<p>metin</p>')
    editor.commands.selectAll()

    const set = editor.commands.setFontSize(13.3)

    expect(set).toBe(true)
    expect(html(editor)).toBe('<p><span style="font-size: 13.5pt">metin</span></p>')
    expect(editor.query.fontSize()).toBe('13.5pt')
    expect(editor.query.fontSizePoints()).toBe(13.5)
  })

  it('refuses point sizes outside 6 to 96 and unparsable values', async () => {
    const editor = await mount('<p>metin</p>')
    editor.commands.selectAll()

    const results = [
      editor.commands.setFontSize(5.5),
      editor.commands.setFontSize(96.5),
      editor.commands.setFontSize(Number.NaN),
      editor.commands.setFontSize('12px'),
    ]

    expect(results).toEqual([false, false, false, false])
    expect(html(editor)).toBe('<p>metin</p>')
    expect(editor.query.fontSizePoints()).toBeNull()
  })

  it('steps to the next preset above and below the default size', async () => {
    const up = await mount('<p>metin</p>')
    up.commands.selectAll()
    const down = await mount('<p>metin</p>')
    down.commands.selectAll()

    const grew = press(up, { key: '>', keyCode: 190, ctrlKey: true, shiftKey: true })
    const shrank = press(down, { key: '<', keyCode: 188, ctrlKey: true, shiftKey: true })

    expect([grew, shrank]).toEqual([true, true])
    expect(up.query.fontSize()).toBe('14pt')
    expect(down.query.fontSize()).toBe('11pt')
  })

  it('steps from an em step by its point value', async () => {
    const editor = await mount('<p><span style="font-size: 0.875em">metin</span></p>')
    editor.commands.selectAll()

    const points = editor.query.fontSizePoints()
    editor.commands.stepFontSize(1)

    expect(points).toBe(10.5)
    expect(html(editor)).toBe('<p><span style="font-size: 11pt">metin</span></p>')
  })

  it('stops at both ends of the presets', async () => {
    const editor = await mount(
      '<p><span style="font-size: 72pt">büyük</span> <span style="font-size: 8pt">küçük</span></p>',
    )
    editor.commands.setTextSelection(1, 6)
    const atTop = editor.commands.stepFontSize(1)
    editor.commands.setTextSelection(7, 12)
    const atBottom = editor.commands.stepFontSize(-1)

    expect([atTop, atBottom]).toEqual([false, false])
    expect(html(editor)).toBe(
      '<p><span style="font-size: 72pt">büyük</span> <span style="font-size: 8pt">küçük</span></p>',
    )
  })

  it('reports no size for a selection that mixes sizes and refuses to step past the bounds', async () => {
    const editor = await mount(
      '<p><span style="font-size: 18pt">iri</span> düz <span style="font-size: 96pt">dev</span> <span style="font-size: 6pt">ufak</span></p>',
    )
    editor.commands.setTextSelection(1, 8)
    const mixed = [editor.query.fontSize(), editor.query.fontSizePoints()]
    editor.commands.setTextSelection(9, 12)
    const top = [editor.query.fontSizePoints(), editor.commands.stepFontSize(1)]
    editor.commands.setTextSelection(13, 17)
    const bottom = [editor.query.fontSizePoints(), editor.commands.stepFontSize(-1)]

    expect(mixed).toEqual([null, null])
    expect(top).toEqual([96, false])
    expect(bottom).toEqual([6, false])
  })

  it('steps a mixed selection from the default size to one size for all of it', async () => {
    const editor = await mount('<p><span style="font-size: 18pt">iri</span> düz</p>')
    editor.commands.selectAll()

    const stepped = editor.commands.stepFontSize(1)

    expect(stepped).toBe(true)
    expect(editor.query.fontSize()).toBe('14pt')
  })
})
