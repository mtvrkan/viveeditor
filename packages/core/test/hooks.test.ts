import { EditorState, TextSelection, type Transaction } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  defineExtension,
  Editor,
  type EditorEventMap,
  isRemote,
  REMOTE_META,
  ViveEditorError,
} from '../src/index.js'

let editors: Editor[] = []

async function mount(options: Parameters<typeof Editor.create>[1] = {}): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, options)
  editors.push(editor)
  return editor
}

const viewOf = (editor: Editor): EditorView => (editor as unknown as { view: EditorView }).view

function dispatch(editor: Editor, build: (transaction: Transaction) => Transaction): void {
  const view = viewOf(editor)
  view.dispatch(build(view.state.tr))
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('replacesHistory', () => {
  it('delegates undo and redo to the replacing extension and drops the core history', async () => {
    const calls: string[] = []
    const Replacement = defineExtension({
      name: 'replacement',
      defaultOptions: {},
      replacesHistory: true,
      commands: () => ({
        undo: () => (_state, dispatch) => {
          if (dispatch) calls.push('undo')
          return true
        },
        redo: () => () => false,
      }),
    })
    const editor = await mount({ extensions: [Replacement], content: '<p>a</p>' })
    editor.commands.insertText('b')

    const result = [editor.can.undo(), editor.commands.undo(), editor.can.redo(), editor.getText()]

    expect([...result, calls]).toEqual([true, true, false, 'ba', ['undo']])
  })

  it('keeps the core history when no extension replaces it', async () => {
    const Plain = defineExtension({ name: 'plain', defaultOptions: {}, replacesHistory: false })
    const editor = await mount({ extensions: [Plain], content: '<p>a</p>' })
    editor.commands.insertText('b')

    const undone = editor.commands.undo()

    expect([undone, editor.getText()]).toEqual([true, 'a'])
  })

  it('answers false for undo and redo when the replacing extension registers neither', async () => {
    const Bare = defineExtension({ name: 'bare', defaultOptions: {}, replacesHistory: true })
    const editor = await mount({ extensions: [Bare], content: '<p>a</p>' })
    editor.commands.insertText('b')

    const result = [editor.can.undo(), editor.commands.undo(), editor.commands.redo()]

    expect([...result, editor.getText()]).toEqual([false, false, false, 'ba'])
  })
})

describe('isRemote', () => {
  it('reads the remote meta of a transaction', async () => {
    const { schema } = await mount()
    const state = EditorState.create({ schema })

    expect([isRemote(state.tr.setMeta(REMOTE_META, true)), isRemote(state.tr)]).toEqual([
      true,
      false,
    ])
  })

  it('reports remote and local changes in the change event', async () => {
    const editor = await mount({ content: '<p>a</p>' })
    const seen: boolean[] = []
    editor.on('change', ({ remote }) => seen.push(remote))

    dispatch(editor, (tr) => tr.insertText('x', 1).setMeta(REMOTE_META, true))
    editor.commands.insertText('y')
    editor.setContent('<p>z</p>')

    expect(seen).toEqual([true, false, false])
  })

  it('treats a meta value other than true as local', async () => {
    const { schema } = await mount()
    const state = EditorState.create({ schema })

    expect(isRemote(state.tr.setMeta(REMOTE_META, 'yes'))).toBe(false)
  })

  it('keeps listeners that ignore the payload working', async () => {
    const editor = await mount({ content: '<p>a</p>' })
    const listener = vi.fn<(payload: EditorEventMap['change']) => void>()
    editor.on('change', listener)

    editor.commands.insertText('b')

    expect(listener).toHaveBeenCalledWith({ editor, remote: false })
  })
})

describe('transformTransaction', () => {
  const upperCase = defineExtension({
    name: 'upperCase',
    defaultOptions: {},
    transformTransaction: (transaction, state) => {
      const text = transaction.doc.textContent
      if (text === text.toUpperCase()) return undefined
      return state.tr.insertText(text.toUpperCase(), 1, state.doc.content.size - 1)
    },
  })

  it('replaces a local transaction before it is applied', async () => {
    const editor = await mount({ extensions: [upperCase], content: '<p>A</p>' })

    editor.commands.insertText('b')

    expect(editor.getHTML()).toBe('<p>BA</p>')
  })

  it('runs in priority order and passes each result on', async () => {
    const order: string[] = []
    const record = (name: string, priority: number) =>
      defineExtension({
        name,
        priority,
        defaultOptions: {},
        transformTransaction: (transaction) => {
          order.push(name)
          return transaction.insertText(name, transaction.doc.content.size - 1)
        },
      })
    const editor = await mount({
      extensions: [record('low', 10), record('high', 200)],
      content: '<p>a</p>',
    })

    editor.commands.insertText('-')

    expect([order, editor.getText()]).toEqual([['high', 'low'], '-ahighlow'])
  })

  it('is skipped for remote and selection-only transactions', async () => {
    const seen = vi.fn()
    const Spy = defineExtension({
      name: 'spy',
      defaultOptions: {},
      transformTransaction: (transaction) => {
        seen(transaction.docChanged)
        return transaction
      },
    })
    const editor = await mount({ extensions: [Spy], content: '<p>abc</p>' })

    dispatch(editor, (tr) => tr.setSelection(TextSelection.create(tr.doc, 2)))
    dispatch(editor, (tr) => tr.insertText('x', 1).setMeta(REMOTE_META, true))

    expect([seen.mock.calls.length, editor.getText()]).toEqual([0, 'xabc'])
  })

  it('stops calling later transformers once the transaction no longer changes the document', async () => {
    const later = vi.fn()
    const Cancel = defineExtension({
      name: 'cancel',
      priority: 200,
      defaultOptions: {},
      transformTransaction: (_transaction, state) => state.tr,
    })
    const Later = defineExtension({
      name: 'later',
      defaultOptions: {},
      transformTransaction: later,
    })
    const editor = await mount({ extensions: [Cancel, Later], content: '<p>a</p>' })

    editor.commands.insertText('b')

    expect([later.mock.calls.length, editor.getText()]).toEqual([0, 'a'])
  })

  it('rejects a transaction built for another state and applies the original', async () => {
    const errors: unknown[] = []
    const Foreign = defineExtension({
      name: 'foreign',
      defaultOptions: {},
      transformTransaction: (_transaction, state) =>
        EditorState.create({ schema: state.schema }).tr.insertText('foreign', 1),
    })
    const editor = await mount({ extensions: [Foreign], content: '<p>a</p>' })
    editor.on('error', ({ error }) => errors.push(error))

    editor.commands.insertText('b')

    expect([
      editor.getText(),
      errors.length,
      errors[0] instanceof ViveEditorError && errors[0].code,
    ]).toEqual(['ba', 1, 'INVALID_TRANSACTION'])
  })

  it('reports a throwing transformer and keeps the edit', async () => {
    const errors: unknown[] = []
    const Broken = defineExtension({
      name: 'broken',
      defaultOptions: {},
      transformTransaction: () => {
        throw new Error('boom')
      },
    })
    const editor = await mount({ extensions: [Broken], content: '<p>a</p>' })
    editor.on('error', ({ error }) => errors.push(error))

    editor.commands.insertText('b')

    expect([editor.getText(), (errors[0] as Error).message]).toEqual(['ba', 'boom'])
  })
})
