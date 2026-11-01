import { Editor, type EditorOptions } from '@viveeditor/core'
import { listExtensions } from '@viveeditor/ext-list'
import { TextSelection } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it } from 'vitest'
import { taskListExtensions } from '../src/index.js'

let editors: Editor[] = []

async function mount(options: EditorOptions = {}): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, {
    extensions: [...listExtensions, ...taskListExtensions],
    ...options,
  })
  editors.push(editor)
  return editor
}

function viewOf(editor: Editor): EditorView {
  return (editor as unknown as { view: EditorView }).view
}

function type(editor: Editor, text: string): void {
  const view = viewOf(editor)
  for (const character of text) {
    const { from, to } = view.state.selection
    const handled = view.someProp('handleTextInput', (handler) =>
      handler(view, from, to, character, () => view.state.tr.insertText(character, from, to)),
    )
    if (!handled) view.dispatch(view.state.tr.insertText(character, from, to))
  }
}

const unchecked = (text: string): string =>
  `<li data-type="taskItem" data-checked="false"><input type="checkbox" disabled=""><div><p>${text}</p></div></li>`

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('task list schema', () => {
  it('round-trips its own HTML with a portable disabled checkbox', async () => {
    const html = `<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><input type="checkbox" disabled="" checked=""><div><p>bitti</p></div></li>${unchecked('kaldı')}</ul>`

    const editor = await mount({ content: html })

    expect(editor.getHTML()).toBe(html)
  })

  it('reads a GitHub task list', async () => {
    const editor = await mount({
      content:
        '<ul class="contains-task-list"><li class="task-list-item"><input type="checkbox" disabled checked> yayınla</li></ul>',
    })

    const item = editor.getJSON().content?.[0]?.content?.[0]

    expect(item?.type).toBe('taskItem')
    expect(item?.attrs?.checked).toBe(true)
  })
})

describe('task list commands', () => {
  it('wraps a paragraph and unwraps it again', async () => {
    const editor = await mount({ content: '<p>görev</p>' })

    editor.commands.toggleTaskList()
    const wrapped = editor.getHTML()
    editor.commands.toggleTaskList()

    expect(wrapped).toBe(`<ul data-type="taskList">${unchecked('görev')}</ul>`)
    expect(editor.getHTML()).toBe('<p>görev</p>')
  })

  it('turns a whole bullet list into a task list in place', async () => {
    const editor = await mount({ content: '<ul><li><p>a</p></li><li><p>b</p></li></ul>' })

    editor.commands.toggleTaskList()

    expect(editor.getHTML()).toBe(
      `<ul data-type="taskList">${unchecked('a')}${unchecked('b')}</ul>`,
    )
  })

  it('ticks the current item with toggleTaskChecked and refuses outside a task', async () => {
    const editor = await mount({
      content: `<ul data-type="taskList">${unchecked('x')}</ul><p>y</p>`,
    })

    const ticked = editor.commands.toggleTaskChecked()
    const outside = await mount({ content: '<p>y</p>' })

    expect(ticked).toBe(true)
    expect(editor.getJSON().content?.[0]?.content?.[0]?.attrs?.checked).toBe(true)
    expect(outside.can.toggleTaskChecked()).toBe(false)
  })
})

describe('task list input', () => {
  it('starts a checked task from "[x] "', async () => {
    const editor = await mount({ content: '<p></p>' })
    editor.focus()

    type(editor, '[x] süt al')

    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: 'taskList',
      content: [{ type: 'taskItem', attrs: { checked: true } }],
    })
    expect(editor.getText()).toBe('süt al')
  })

  it('converts a bullet item typed as "- [ ] " into a task list', async () => {
    const editor = await mount({ content: '<p></p>' })
    editor.focus()

    type(editor, '- [ ] ekmek')

    expect(editor.getHTML()).toBe(`<ul data-type="taskList">${unchecked('ekmek')}</ul>`)
  })

  it('ticks only the converted item when "- [x] " is typed', async () => {
    const editor = await mount({ content: '<ul><li><p>ilk</p></li><li><p></p></li></ul>' })
    editor.focus()
    const view = viewOf(editor)
    const end = view.state.doc.resolve(view.state.doc.content.size - 3)
    view.dispatch(view.state.tr.setSelection(TextSelection.near(end)))

    type(editor, '[x] ikinci')

    const items = editor.getJSON().content?.[0]?.content ?? []
    expect(items.map((item) => item.attrs?.checked)).toEqual([false, true])
  })
})

describe('task item view', () => {
  it('toggles the item when its checkbox is clicked', async () => {
    const editor = await mount({ content: `<ul data-type="taskList">${unchecked('tıkla')}</ul>` })
    const checkbox = editor.dom.querySelector<HTMLInputElement>('input[type="checkbox"]')

    checkbox?.click()

    expect(editor.getJSON().content?.[0]?.content?.[0]?.attrs?.checked).toBe(true)
    expect(editor.dom.querySelector('li')?.dataset.checked).toBe('true')
  })

  it('locks the checkbox in a read-only editor', async () => {
    const editor = await mount({
      content: `<ul data-type="taskList">${unchecked('kilitli')}</ul>`,
      editable: false,
    })

    const checkbox = editor.dom.querySelector<HTMLInputElement>('input[type="checkbox"]')

    expect(checkbox?.disabled).toBe(true)
    expect(checkbox?.getAttribute('aria-label')).toBe('Done')
  })
})
