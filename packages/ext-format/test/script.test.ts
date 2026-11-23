import { afterEach, describe, expect, it } from 'vitest'
import { mount, press, unmountAll } from './helpers.js'

afterEach(unmountAll)

describe('subscript and superscript', () => {
  it('toggles subscript and superscript on the selection and never both at once', async () => {
    const editor = await mount('<p>H2O x2</p>')
    editor.commands.setTextSelection(2, 3)
    editor.commands.toggleSubscript()
    editor.commands.setTextSelection(6, 7)
    editor.commands.toggleSubscript()

    editor.commands.toggleSuperscript()

    expect(editor.getHTML()).toBe('<p>H<sub>2</sub>O x<sup>2</sup></p>')
  })

  it('removes the mark when toggled again', async () => {
    const editor = await mount('<p>x<sup>2</sup></p>')
    editor.commands.setTextSelection(2, 3)

    editor.commands.toggleSuperscript()

    expect(editor.getHTML()).toBe('<p>x2</p>')
  })

  it('reads sub, sup and vertical-align from pasted HTML but leaves footnotes alone', async () => {
    const editor = await mount(
      '<p>a<sub>1</sub> b<span style="vertical-align: super">2</span> c<sup>3</sup></p>',
    )

    expect(editor.getHTML()).toBe('<p>a<sub>1</sub> b<sup>2</sup> c<sup>3</sup></p>')
  })

  it('runs from Mod-, and Mod-.', async () => {
    const editor = await mount('<p>ab</p>')
    editor.commands.setTextSelection(2, 3)

    const sub = press(editor, { key: ',', ctrlKey: true })
    editor.commands.setTextSelection(1, 2)
    const sup = press(editor, { key: '.', ctrlKey: true })

    expect([sub, sup]).toEqual([true, true])
    expect(editor.getHTML()).toBe('<p><sup>a</sup><sub>b</sub></p>')
  })
})
