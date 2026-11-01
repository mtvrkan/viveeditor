import {
  DEFAULT_ALLOWED_PROTOCOLS,
  defineExtension,
  type Extension,
  getMarkType,
  isAllowedUrl,
} from '@viveeditor/core'
import type { Mark, MarkType } from 'prosemirror-model'
import type { Command, EditorState } from 'prosemirror-state'

export interface LinkAttributes {
  href: string
  title?: string | null
}

export interface LinkOptions {
  protocols: readonly string[]
  rel: string
  openInNewTab: boolean
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    setLink: (attributes: LinkAttributes) => Command
    unsetLink: () => Command
  }
}

function linkRange(state: EditorState, mark: Mark): { from: number; to: number } | null {
  const { $from } = state.selection
  const parent = $from.parent
  const hasLink = (index: number): boolean =>
    index >= 0 && index < parent.childCount && mark.isInSet(parent.child(index).marks) !== undefined
  let index = $from.index()
  if (!hasLink(index)) {
    if (!hasLink(index - 1)) return null
    index -= 1
  }
  let first = index
  let last = index
  while (hasLink(first - 1)) first -= 1
  while (hasLink(last + 1)) last += 1
  let from = $from.start()
  for (let i = 0; i < first; i++) from += parent.child(i).nodeSize
  let to = from
  for (let i = first; i <= last; i++) to += parent.child(i).nodeSize
  return { from, to }
}

function linkAtCursor(state: EditorState, type: MarkType): { from: number; to: number } | null {
  const { $from } = state.selection
  const mark =
    type.isInSet($from.marks()) ??
    type.isInSet($from.nodeAfter?.marks ?? []) ??
    type.isInSet($from.nodeBefore?.marks ?? [])
  return mark ? linkRange(state, mark) : null
}

export const Link: Extension<LinkOptions> = defineExtension({
  name: 'link',
  priority: 110,
  defaultOptions: {
    protocols: DEFAULT_ALLOWED_PROTOCOLS,
    rel: 'noopener noreferrer nofollow',
    openInNewTab: false,
  },
  marks: (options) => ({
    link: {
      attrs: { href: {}, title: { default: null } },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: (node) => {
            const element = node as HTMLElement
            const href = element.getAttribute('href') ?? ''
            if (!isAllowedUrl(href, options.protocols)) return false
            return { href, title: element.getAttribute('title') }
          },
        },
      ],
      toDOM: (mark) => {
        const href = String(mark.attrs.href ?? '')
        const attributes: Record<string, string> = { rel: options.rel }
        if (isAllowedUrl(href, options.protocols)) attributes.href = href
        if (typeof mark.attrs.title === 'string') attributes.title = mark.attrs.title
        if (options.openInNewTab) attributes.target = '_blank'
        return ['a', attributes, 0]
      },
    },
  }),
  commands: ({ schema, options }) => ({
    setLink:
      ({ href, title = null }) =>
      (state, dispatch) => {
        if (!isAllowedUrl(href, options.protocols)) return false
        const type = getMarkType(schema, 'link')
        const mark = type.create({ href: href.trim(), title })
        const { from, to, empty } = state.selection
        if (empty) {
          const range = linkAtCursor(state, type)
          if (!range) return false
          dispatch?.(
            state.tr.removeMark(range.from, range.to, type).addMark(range.from, range.to, mark),
          )
          return true
        }
        dispatch?.(state.tr.removeMark(from, to, type).addMark(from, to, mark).scrollIntoView())
        return true
      },
    unsetLink: () => (state, dispatch) => {
      const type = getMarkType(schema, 'link')
      const { from, to, empty } = state.selection
      if (empty) {
        const range = linkAtCursor(state, type)
        if (!range) return false
        dispatch?.(state.tr.removeMark(range.from, range.to, type))
        return true
      }
      if (!state.doc.rangeHasMark(from, to, type)) return false
      dispatch?.(state.tr.removeMark(from, to, type))
      return true
    },
  }),
})
