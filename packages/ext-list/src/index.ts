import { defineExtension, type Extension, getNodeType } from '@viveeditor/core'
import { wrappingInputRule } from 'prosemirror-inputrules'
import type { NodeType, Schema } from 'prosemirror-model'
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list'
import type { Command } from 'prosemirror-state'

declare module '@viveeditor/core' {
  interface CommandRegistry {
    toggleBulletList: () => Command
    toggleOrderedList: () => Command
    sinkListItem: () => Command
    liftListItem: () => Command
  }
}

type NoOptions = Record<string, never>

const LIST_TYPES = ['bulletList', 'orderedList'] as const

function toggleList(schema: Schema, listName: (typeof LIST_TYPES)[number]): Command {
  return (state, dispatch, view) => {
    const listType = getNodeType(schema, listName)
    const itemType = getNodeType(schema, 'listItem')
    const listTypes: NodeType[] = LIST_TYPES.flatMap((name) => schema.nodes[name] ?? [])
    const { $from, $to } = state.selection
    const range = $from.blockRange($to, (node) => listTypes.includes(node.type))
    if (!range) return wrapInList(listType)(state, dispatch, view)
    const list = range.parent
    if (list.type === listType) return liftListItem(itemType)(state, dispatch, view)
    if (dispatch) {
      dispatch(state.tr.setNodeMarkup(range.start - 1, listType).scrollIntoView())
    }
    return true
  }
}

export const ListItem: Extension<NoOptions> = defineExtension({
  name: 'listItem',
  defaultOptions: {},
  nodes: () => ({
    listItem: {
      content: 'paragraph block*',
      defining: true,
      parseDOM: [{ tag: 'li' }],
      toDOM: () => ['li', 0],
    },
  }),
  commands: ({ schema }) => ({
    sinkListItem: () => sinkListItem(getNodeType(schema, 'listItem')),
    liftListItem: () => liftListItem(getNodeType(schema, 'listItem')),
  }),
  keymap: ({ schema }) => {
    const itemType = getNodeType(schema, 'listItem')
    return {
      Enter: splitListItem(itemType),
      Tab: sinkListItem(itemType),
      'Shift-Tab': liftListItem(itemType),
    }
  },
})

export const BulletList: Extension<NoOptions> = defineExtension({
  name: 'bulletList',
  defaultOptions: {},
  nodes: () => ({
    bulletList: {
      group: 'block',
      content: 'listItem+',
      parseDOM: [{ tag: 'ul' }],
      toDOM: () => ['ul', 0],
    },
  }),
  commands: ({ schema }) => ({
    toggleBulletList: () => toggleList(schema, 'bulletList'),
  }),
  keymap: ({ schema }) => ({
    'Mod-Shift-8': toggleList(schema, 'bulletList'),
  }),
  inputRules: ({ schema }) => [
    wrappingInputRule(/^\s*([-+*])\s$/, getNodeType(schema, 'bulletList')),
  ],
})

export const OrderedList: Extension<NoOptions> = defineExtension({
  name: 'orderedList',
  defaultOptions: {},
  nodes: () => ({
    orderedList: {
      group: 'block',
      content: 'listItem+',
      attrs: { start: { default: 1 } },
      parseDOM: [
        {
          tag: 'ol',
          getAttrs: (node) => {
            const start = Number.parseInt((node as HTMLElement).getAttribute('start') ?? '1', 10)
            return { start: Number.isFinite(start) ? start : 1 }
          },
        },
      ],
      toDOM: (node) => {
        const start = Number(node.attrs.start)
        return Number.isInteger(start) && start !== 1
          ? ['ol', { start: String(start) }, 0]
          : ['ol', 0]
      },
    },
  }),
  commands: ({ schema }) => ({
    toggleOrderedList: () => toggleList(schema, 'orderedList'),
  }),
  keymap: ({ schema }) => ({
    'Mod-Shift-7': toggleList(schema, 'orderedList'),
  }),
  inputRules: ({ schema }) => [
    wrappingInputRule(
      /^(\d+)\.\s$/,
      getNodeType(schema, 'orderedList'),
      (match) => ({ start: Number(match[1]) }),
      (match, node) => node.childCount + Number(node.attrs.start) === Number(match[1]),
    ),
  ],
})

export const listExtensions: readonly Extension[] = [ListItem, BulletList, OrderedList]
