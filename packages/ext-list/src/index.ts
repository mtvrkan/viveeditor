import { defineExtension, type Extension, getNodeType } from '@viveeditor/core'
import { wrappingInputRule } from 'prosemirror-inputrules'
import type { NodeType, Node as ProseMirrorNode, Schema } from 'prosemirror-model'
import { liftListItem, sinkListItem, splitListItem, wrapInList } from 'prosemirror-schema-list'
import type { Command, EditorState } from 'prosemirror-state'

export type OrderedListType = '1' | 'a' | 'A' | 'i' | 'I'
export type BulletStyle = 'disc' | 'circle' | 'square'

export type ListStyle =
  | { kind: 'ordered'; type: OrderedListType; start: number }
  | { kind: 'bullet'; style: BulletStyle | null }

declare module '@viveeditor/core' {
  interface CommandRegistry {
    toggleBulletList: () => Command
    toggleOrderedList: () => Command
    sinkListItem: () => Command
    liftListItem: () => Command
    setListType: (type: OrderedListType) => Command
    setListStart: (start: number) => Command
    setBulletStyle: (style: BulletStyle | null) => Command
  }
  interface QueryRegistry {
    listStyle: () => ListStyle | null
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

export const MAX_LIST_START = 99999

const ORDERED_TYPES: readonly OrderedListType[] = ['1', 'a', 'A', 'i', 'I']
const BULLET_STYLES: readonly BulletStyle[] = ['disc', 'circle', 'square']
const CSS_ORDERED_TYPES: Readonly<Record<string, OrderedListType>> = {
  decimal: '1',
  'lower-alpha': 'a',
  'lower-latin': 'a',
  'upper-alpha': 'A',
  'upper-latin': 'A',
  'lower-roman': 'i',
  'upper-roman': 'I',
}

const isOrderedType = (value: unknown): value is OrderedListType =>
  typeof value === 'string' && (ORDERED_TYPES as readonly string[]).includes(value)

const isBulletStyle = (value: unknown): value is BulletStyle =>
  typeof value === 'string' && (BULLET_STYLES as readonly string[]).includes(value)

const isStart = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_LIST_START

function typeAttribute(type: unknown): string | null {
  return isOrderedType(type) && type !== '1' ? type : null
}

function parseOrderedType(element: HTMLElement): string | null {
  const attribute = element.getAttribute('type')?.trim() ?? ''
  if (attribute) return typeAttribute(attribute)
  const css = element.style.listStyleType.trim().toLowerCase()
  return typeAttribute(CSS_ORDERED_TYPES[css])
}

function parseStart(element: HTMLElement): number {
  const raw = (element.getAttribute('start') ?? '').trim()
  const start = /^\d{1,5}$/.test(raw) ? Number(raw) : 1
  return isStart(start) ? start : 1
}

function nearestList(state: EditorState): { node: ProseMirrorNode; pos: number } | null {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth)
    if (node.type.name === 'bulletList' || node.type.name === 'orderedList') {
      return { node, pos: $from.before(depth) }
    }
  }
  return null
}

function updateList(kind: (typeof LIST_TYPES)[number], attrs: Record<string, unknown>): Command {
  return (state, dispatch) => {
    const list = nearestList(state)
    if (!list || list.node.type.name !== kind) return false
    const next = { ...list.node.attrs, ...attrs }
    if (Object.keys(attrs).every((name) => list.node.attrs[name] === next[name])) return true
    dispatch?.(state.tr.setNodeMarkup(list.pos, undefined, next))
    return true
  }
}

function listStyle(state: EditorState): ListStyle | null {
  const list = nearestList(state)
  if (!list) return null
  if (list.node.type.name === 'orderedList') {
    const start = Number(list.node.attrs.start)
    const type = list.node.attrs.type
    return {
      kind: 'ordered',
      type: isOrderedType(type) ? type : '1',
      start: isStart(start) ? start : 1,
    }
  }
  const style = list.node.attrs.bulletStyle
  return { kind: 'bullet', style: isBulletStyle(style) ? style : null }
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
  queries: () => ({
    listStyle: (state) => listStyle(state),
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
      attrs: { bulletStyle: { default: null } },
      parseDOM: [
        {
          tag: 'ul',
          getAttrs: (node) => {
            const style = (node as HTMLElement).style.listStyleType.trim().toLowerCase()
            return { bulletStyle: isBulletStyle(style) ? style : null }
          },
        },
      ],
      toDOM: (node) =>
        isBulletStyle(node.attrs.bulletStyle)
          ? ['ul', { style: `list-style-type: ${node.attrs.bulletStyle}` }, 0]
          : ['ul', 0],
    },
  }),
  commands: ({ schema }) => ({
    toggleBulletList: () => toggleList(schema, 'bulletList'),
    setBulletStyle: (style: BulletStyle | null) =>
      style === null || isBulletStyle(style)
        ? updateList('bulletList', { bulletStyle: style })
        : () => false,
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
      attrs: { start: { default: 1 }, type: { default: null } },
      parseDOM: [
        {
          tag: 'ol',
          getAttrs: (node) => ({
            start: parseStart(node as HTMLElement),
            type: parseOrderedType(node as HTMLElement),
          }),
        },
      ],
      toDOM: (node) => {
        const attributes: Record<string, string> = {}
        const start = Number(node.attrs.start)
        if (isStart(start) && start !== 1) attributes.start = String(start)
        const type = typeAttribute(node.attrs.type)
        if (type) attributes.type = type
        return ['ol', attributes, 0]
      },
    },
  }),
  commands: ({ schema }) => ({
    toggleOrderedList: () => toggleList(schema, 'orderedList'),
    setListType: (type: OrderedListType) =>
      isOrderedType(type) ? updateList('orderedList', { type: typeAttribute(type) }) : () => false,
    setListStart: (start: number) =>
      isStart(start) ? updateList('orderedList', { start }) : () => false,
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
