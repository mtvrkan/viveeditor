import { defineExtension, type Extension, getNodeType } from '@viveeditor/core'
import { InputRule } from 'prosemirror-inputrules'
import type { NodeType, Node as ProseMirrorNode, Schema } from 'prosemirror-model'
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list'
import { type Command, Plugin, type Transaction } from 'prosemirror-state'
import { findWrapping } from 'prosemirror-transform'
import type { EditorView, NodeView } from 'prosemirror-view'

declare module '@viveeditor/core' {
  interface CommandRegistry {
    toggleTaskList: () => Command
    toggleTaskChecked: () => Command
  }
}

export interface TaskListOptions {
  checkboxLabel: string
}

const OTHER_LISTS = ['bulletList', 'orderedList']

function convertList(
  transaction: Transaction,
  position: number,
  list: ProseMirrorNode,
  schema: Schema,
  checkedIndex = -1,
): void {
  const taskList = getNodeType(schema, 'taskList')
  const taskItem = getNodeType(schema, 'taskItem')
  const items: ProseMirrorNode[] = []
  list.forEach((item, _offset, index) => {
    items.push(taskItem.create({ checked: index === checkedIndex }, item.content))
  })
  transaction.replaceWith(position, position + list.nodeSize, taskList.create(null, items))
}

function toggleTaskList(schema: Schema): Command {
  return (state, dispatch, view) => {
    const taskList = getNodeType(schema, 'taskList')
    const taskItem = getNodeType(schema, 'taskItem')
    const others: NodeType[] = OTHER_LISTS.flatMap((name) => schema.nodes[name] ?? [])
    const { $from, $to } = state.selection
    const range = $from.blockRange($to, (node) => [taskList, ...others].includes(node.type))
    if (!range) return wrapInList(taskList)(state, dispatch, view)
    if (range.parent.type === taskList) return liftListItem(taskItem)(state, dispatch, view)
    if (dispatch) {
      const transaction = state.tr
      const position = range.start - 1
      convertList(transaction, position, range.parent, schema)
      dispatch(transaction.scrollIntoView())
    }
    return true
  }
}

function toggleChecked(schema: Schema): Command {
  return (state, dispatch) => {
    const taskItem = getNodeType(schema, 'taskItem')
    const { $from } = state.selection
    for (let depth = $from.depth; depth > 0; depth--) {
      const node = $from.node(depth)
      if (node.type !== taskItem) continue
      dispatch?.(
        state.tr.setNodeMarkup($from.before(depth), undefined, {
          ...node.attrs,
          checked: !node.attrs.checked,
        }),
      )
      return true
    }
    return false
  }
}

function taskInputRule(schema: Schema): InputRule {
  return new InputRule(/^\s*\[([ xX]?)\]\s$/, (state, match, start, end) => {
    const taskList = getNodeType(schema, 'taskList')
    const taskItem = getNodeType(schema, 'taskItem')
    const checked = (match[1] ?? '').toLowerCase() === 'x'
    const transaction = state.tr.delete(start, end)
    const $start = transaction.doc.resolve(start)
    const item = $start.node(-1)
    const list = $start.node(-2)
    if (
      $start.depth >= 3 &&
      item.type.name === 'listItem' &&
      OTHER_LISTS.includes(list.type.name)
    ) {
      convertList(transaction, $start.before(-2), list, schema, checked ? $start.index(-2) : -1)
      return transaction
    }
    const range = $start.blockRange()
    const wrapping = range && findWrapping(range, taskList)
    if (!range || !wrapping) return null
    transaction.wrap(
      range,
      wrapping.map((wrapper) =>
        wrapper.type === taskItem ? { type: taskItem, attrs: { checked } } : wrapper,
      ),
    )
    return transaction
  })
}

class TaskItemView implements NodeView {
  readonly dom: HTMLLIElement
  readonly contentDOM: HTMLDivElement
  private readonly checkbox: HTMLInputElement

  constructor(
    private node: ProseMirrorNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
    label: string,
  ) {
    this.dom = document.createElement('li')
    this.dom.dataset.type = 'taskItem'
    const wrapper = document.createElement('label')
    wrapper.contentEditable = 'false'
    this.checkbox = document.createElement('input')
    this.checkbox.type = 'checkbox'
    this.checkbox.setAttribute('aria-label', label)
    this.checkbox.addEventListener('mousedown', (event) => event.preventDefault())
    this.checkbox.addEventListener('change', () => this.toggle())
    wrapper.append(this.checkbox)
    this.contentDOM = document.createElement('div')
    this.dom.append(wrapper, this.contentDOM)
    this.render()
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    this.render()
    return true
  }

  stopEvent(event: Event): boolean {
    return event.target === this.checkbox
  }

  ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: Node }): boolean {
    return mutation.type !== 'selection' && !this.contentDOM.contains(mutation.target)
  }

  private render(): void {
    const checked = this.node.attrs.checked === true
    this.dom.dataset.checked = String(checked)
    this.checkbox.checked = checked
    this.checkbox.disabled = !this.view.editable
  }

  private toggle(): void {
    const position = this.getPos()
    if (position === undefined || !this.view.editable) {
      this.render()
      return
    }
    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(position, undefined, {
        ...this.node.attrs,
        checked: this.checkbox.checked,
      }),
    )
  }
}

export const TaskItem: Extension<TaskListOptions> = defineExtension({
  name: 'taskItem',
  defaultOptions: { checkboxLabel: 'Done' },
  nodes: () => ({
    taskItem: {
      content: 'paragraph block*',
      defining: true,
      attrs: { checked: { default: false } },
      parseDOM: [
        {
          tag: 'li[data-type="taskItem"]',
          priority: 60,
          contentElement: (element) =>
            element.querySelector<HTMLElement>(':scope > div') ?? element,
          getAttrs: (element) => ({ checked: element.dataset.checked === 'true' }),
        },
        {
          tag: 'li.task-list-item',
          priority: 60,
          getAttrs: (element) => ({
            checked:
              element.querySelector(':scope > input[type="checkbox"]')?.hasAttribute('checked') ===
              true,
          }),
        },
      ],
      toDOM: (node) => {
        const checked = node.attrs.checked === true
        return [
          'li',
          { 'data-type': 'taskItem', 'data-checked': String(checked) },
          ['input', { type: 'checkbox', disabled: '', ...(checked ? { checked: '' } : {}) }],
          ['div', 0],
        ]
      },
    },
  }),
  commands: ({ schema }) => ({
    toggleTaskChecked: () => toggleChecked(schema),
  }),
  keymap: ({ schema }) => {
    const taskItem = getNodeType(schema, 'taskItem')
    return {
      Enter: splitListItem(taskItem, { checked: false }),
      Tab: sinkListItem(taskItem),
      'Shift-Tab': liftListItem(taskItem),
      'Mod-Enter': toggleChecked(schema),
    }
  },
  plugins: ({ options }) => [
    new Plugin({
      props: {
        nodeViews: {
          taskItem: (node, view, getPos) =>
            new TaskItemView(node, view, getPos, options.checkboxLabel),
        },
      },
    }),
  ],
})

export const TaskList: Extension<Record<string, never>> = defineExtension({
  name: 'taskList',
  defaultOptions: {},
  nodes: () => ({
    taskList: {
      group: 'block',
      content: 'taskItem+',
      parseDOM: [
        { tag: 'ul[data-type="taskList"]', priority: 60 },
        { tag: 'ul.contains-task-list', priority: 60 },
      ],
      toDOM: () => ['ul', { 'data-type': 'taskList' }, 0],
    },
  }),
  commands: ({ schema }) => ({
    toggleTaskList: () => toggleTaskList(schema),
  }),
  keymap: ({ schema }) => ({
    'Mod-Shift-9': toggleTaskList(schema),
  }),
  inputRules: ({ schema }) => [taskInputRule(schema)],
})

export const taskListExtensions: readonly Extension[] = [TaskItem, TaskList]
