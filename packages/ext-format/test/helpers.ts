import { Editor, type Extension } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import type { EditorState, Transaction } from 'prosemirror-state'
import { formatExtensions } from '../src/index.js'

interface TextInputView {
  state: EditorState
  dispatch(transaction: Transaction): void
  someProp(
    name: 'handleTextInput',
    run: (
      handler: (
        view: TextInputView,
        from: number,
        to: number,
        text: string,
        deflt: () => Transaction,
      ) => boolean,
    ) => boolean | undefined,
  ): boolean | undefined
}

const editors: Editor[] = []

export async function mount(
  content: string,
  extensions: readonly Extension[] = [...basicExtensions, ...formatExtensions],
): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, { extensions, content })
  editors.push(editor)
  return editor
}

export function unmountAll(): void {
  for (const editor of editors.splice(0)) editor.destroy()
  document.body.innerHTML = ''
}

export function type(editor: Editor, text: string): void {
  const view = (editor as unknown as { view: TextInputView }).view
  for (const character of text) {
    const { from, to } = view.state.selection
    const handled = view.someProp('handleTextInput', (handler) =>
      handler(view, from, to, character, () => view.state.tr.insertText(character, from, to)),
    )
    if (!handled) view.dispatch(view.state.tr.insertText(character, from, to))
  }
}

export function html(editor: Editor): string {
  return editor.getHTML().replace(/;"/g, '"')
}

export function press(editor: Editor, init: KeyboardEventInit): boolean {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
  editor.dom.dispatchEvent(event)
  return event.defaultPrevented
}
