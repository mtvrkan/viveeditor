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

describe('list styles', () => {
  it('writes start before type and omits the defaults', async () => {
    const editor = await mount({ content: '<ol><li><p>x</p></li></ol>' })
    editor.commands.setTextSelection(3)

    const results = [editor.commands.setListStart(3), editor.commands.setListType('A')]

    expect(results).toEqual([true, true])
    expect(editor.getHTML()).toBe('<ol start="3" type="A"><li><p>x</p></li></ol>')
    expect(editor.query.listStyle()).toEqual({ kind: 'ordered', type: 'A', start: 3 })
  })

  it('drops type 1 and start 1 and keeps start 0', async () => {
    const editor = await mount({
      content:
        '<ol type="1" start="1"><li><p>a</p></li></ol><ol start="0" type="i"><li><p>b</p></li></ol>',
    })

    expect(editor.getHTML()).toBe(
      '<ol><li><p>a</p></li></ol><ol start="0" type="i"><li><p>b</p></li></ol>',
    )
  })

  it('reads the list style type of pasted lists and drops unknown values', async () => {
    const editor = await mount({
      content:
        '<ol style="list-style-type: upper-roman"><li><p>a</p></li></ol><ol type="x" start="-2"><li><p>b</p></li></ol><ul style="list-style-type: SQUARE"><li><p>c</p></li></ul><ul style="list-style-type: lower-greek"><li><p>d</p></li></ul>',
    })

    expect(editor.getHTML()).toBe(
      '<ol type="I"><li><p>a</p></li></ol><ol><li><p>b</p></li></ol><ul style="list-style-type: square;"><li><p>c</p></li></ul><ul><li><p>d</p></li></ul>',
    )
  })

  it('sets and removes the bullet style', async () => {
    const editor = await mount({ content: '<ul><li><p>x</p></li></ul>' })
    editor.commands.setTextSelection(3)

    editor.commands.setBulletStyle('circle')
    const styled = editor.getHTML()
    const query = editor.query.listStyle()
    editor.commands.setBulletStyle(null)

    expect(styled).toBe('<ul style="list-style-type: circle;"><li><p>x</p></li></ul>')
    expect(query).toEqual({ kind: 'bullet', style: 'circle' })
    expect(editor.getHTML()).toBe('<ul><li><p>x</p></li></ul>')
  })

  it('refuses invalid values and commands for the other list kind', async () => {
    const editor = await mount({ content: '<ul><li><p>x</p></li></ul><p>y</p>' })
    editor.commands.setTextSelection(3)

    const results = [
      editor.commands.setListType('a'),
      editor.commands.setListStart(2),
      editor.commands.setBulletStyle('dash' as 'disc'),
    ]
    editor.commands.setTextSelection(8)
    const outside = [editor.commands.setBulletStyle('square'), editor.query.listStyle()]

    expect(results).toEqual([false, false, false])
    expect(outside).toEqual([false, null])
  })

  it.each([-1, 1.5, Number.NaN, 100000])('refuses the start %s', async (start) => {
    const editor = await mount({ content: '<ol><li><p>x</p></li></ol>' })
    editor.commands.setTextSelection(3)

    expect(editor.commands.setListStart(start)).toBe(false)
  })
})
