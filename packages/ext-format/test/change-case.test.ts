import { basicExtensions } from '@viveeditor/ext-basic'
import { afterEach, describe, expect, it } from 'vitest'
import { ChangeCase, formatExtensions } from '../src/index.js'
import { mount, press, unmountAll } from './helpers.js'

afterEach(unmountAll)

const turkish = [
  ...basicExtensions,
  ...formatExtensions.filter((extension) => extension.name !== 'changeCase'),
  ChangeCase.configure({ locale: 'tr' }),
]

describe('change case', () => {
  it('uses Turkish dotted and dotless i in Turkish documents', async () => {
    const editor = await mount('<p>istanbul ılık</p>', turkish)
    editor.commands.selectAll()

    editor.commands.changeCase('upper')
    const upper = editor.getHTML()
    editor.commands.changeCase('lower')

    expect(upper).toBe('<p>İSTANBUL ILIK</p>')
    expect(editor.getHTML()).toBe('<p>istanbul ılık</p>')
  })

  it('reads the language from the page when no locale is set', async () => {
    document.documentElement.lang = 'en'
    const editor = await mount('<p>istanbul</p>')
    editor.commands.selectAll()

    editor.commands.changeCase('upper')
    document.documentElement.lang = ''

    expect(editor.getHTML()).toBe('<p>ISTANBUL</p>')
  })

  it('capitalises each word and keeps apostrophe suffixes and marks', async () => {
    const editor = await mount("<p>İZMİR'DE <strong>güzel</strong> bir gün</p>", turkish)
    editor.commands.selectAll()

    editor.commands.changeCase('title')

    expect(editor.getHTML()).toBe("<p>İzmir'de <strong>Güzel</strong> Bir Gün</p>")
  })

  it('starts each sentence with a capital letter', async () => {
    const editor = await mount('<p>BU BİR CÜMLE. BU DA İKİNCİSİ! son mu?</p>', turkish)
    editor.commands.selectAll()

    editor.commands.changeCase('sentence')

    expect(editor.getHTML()).toBe('<p>Bu bir cümle. Bu da ikincisi! Son mu?</p>')
  })

  it('changes the word at the cursor and cycles with Shift+F3', async () => {
    const editor = await mount('<p>bir kelime</p>', turkish)
    editor.commands.setTextSelection(7)

    press(editor, { key: 'F3', shiftKey: true })
    const first = editor.getHTML()
    press(editor, { key: 'F3', shiftKey: true })
    const second = editor.getHTML()
    press(editor, { key: 'F3', shiftKey: true })

    expect([first, second]).toEqual(['<p>bir Kelime</p>', '<p>bir KELİME</p>'])
    expect(editor.getHTML()).toBe('<p>bir kelime</p>')
    expect(editor.getSelection()).toEqual({ from: 7, to: 7, empty: true })
  })

  it('keeps the selection and undoes in one step', async () => {
    const editor = await mount('<p>abc def</p>', turkish)
    editor.commands.setTextSelection(1, 4)

    editor.commands.changeCase('upper')
    const selection = editor.getSelection()
    editor.commands.undo()

    expect(selection).toEqual({ from: 1, to: 4, empty: false })
    expect(editor.getHTML()).toBe('<p>abc def</p>')
  })

  it('reports nothing to change on empty space', async () => {
    const editor = await mount('<p></p>', turkish)
    editor.commands.setTextSelection(1)

    expect(editor.commands.changeCase('upper')).toBe(false)
  })
})
