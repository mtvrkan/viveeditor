import { Editor, type EditorOptions, ViveEditorError } from '@viveeditor/core'
import { afterEach, describe, expect, it } from 'vitest'
import { BulletList, ListItem, listExtensions } from '../src/index.js'

let editors: Editor[] = []

async function mount(options: EditorOptions = {}): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, { extensions: listExtensions, ...options })
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('list schema', () => {
  it('round-trips nested bullet and ordered lists', async () => {
    const html =
      '<ul><li><p>bir</p><ol start="3"><li><p>üç</p></li></ol></li><li><p>iki</p></li></ul>'

    const editor = await mount({ content: html })

    expect(editor.getHTML()).toBe(html)
  })

  it('wraps stray list text in a paragraph', async () => {
    const editor = await mount({ content: '<ol><li>düz metin</li></ol>' })

    const html = editor.getHTML()

    expect(html).toBe('<ol><li><p>düz metin</p></li></ol>')
  })

  it('falls back to start 1 for a non-numeric start attribute', async () => {
    const editor = await mount({ content: '<ol start="abc"><li><p>x</p></li></ol>' })

    const html = editor.getHTML()

    expect(html).toBe('<ol><li><p>x</p></li></ol>')
  })
})

describe('list commands', () => {
  it('wraps a paragraph in a bullet list and unwraps it again', async () => {
    const editor = await mount({ content: '<p>madde</p>' })

    editor.commands.toggleBulletList()
    const wrapped = editor.getHTML()
    editor.commands.toggleBulletList()

    expect(wrapped).toBe('<ul><li><p>madde</p></li></ul>')
    expect(editor.getHTML()).toBe('<p>madde</p>')
  })

  it('switches a bullet list to an ordered list in place', async () => {
    const editor = await mount({ content: '<ul><li><p>a</p></li><li><p>b</p></li></ul>' })

    const switched = editor.commands.toggleOrderedList()

    expect(switched).toBe(true)
    expect(editor.getHTML()).toBe('<ol><li><p>a</p></li><li><p>b</p></li></ol>')
  })

  it('cannot sink the first item of a list', async () => {
    const editor = await mount({ content: '<ul><li><p>tek</p></li></ul>' })

    const sunk = editor.can.sinkListItem()

    expect(sunk).toBe(false)
  })

  it('fails with a clear error when lists are used without ListItem', async () => {
    const promise = mount({ extensions: [BulletList] })

    await expect(promise).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ViveEditorError &&
        error.code === 'INVALID_SCHEMA' &&
        error.message.includes('listItem'),
    )
  })

  it('accepts ListItem with only one list type registered', async () => {
    const editor = await mount({
      extensions: [ListItem, BulletList],
      content: '<ul><li><p>a</p></li></ul>',
    })

    const html = editor.getHTML()

    expect(html).toBe('<ul><li><p>a</p></li></ul>')
  })
})
