import { defineExtension, type Extension } from '@viveeditor/core'
import type { NodeSpec, NodeType } from 'prosemirror-model'
import type { Command } from 'prosemirror-state'

export interface MentionAttributes {
  id: string
  label: string
}

export interface MentionOptions {
  maxLabelLength: number
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    insertMention: (mention: MentionAttributes) => Command
  }
}

export const MENTION_ID_PATTERN: RegExp = /^(?!.*\.\.)[A-Za-z0-9_][A-Za-z0-9_.:@-]{0,127}$/
export const MAX_MENTION_LABEL: number = 100

const isHidden = (code: number): boolean =>
  code <= 0x1f ||
  (code >= 0x7f && code <= 0x9f) ||
  (code >= 0x200b && code <= 0x200f) ||
  (code >= 0x202a && code <= 0x202e) ||
  (code >= 0x2066 && code <= 0x2069) ||
  code === 0xfeff ||
  (code >= 0xd800 && code <= 0xdfff)

export function isMentionId(value: unknown): value is string {
  return typeof value === 'string' && MENTION_ID_PATTERN.test(value)
}

export function cleanMentionLabel(value: unknown, max: number = MAX_MENTION_LABEL): string {
  if (typeof value !== 'string') return ''
  let result = ''
  for (const character of value.slice(0, max * 4)) {
    const code = character.codePointAt(0) ?? 0
    if (code === 0x09 || code === 0x0a || code === 0x0d) result += ' '
    else if (!isHidden(code)) result += character
  }
  const label = result.replace(/\s+/g, ' ').trim().replace(/^@+/, '').trim()
  return Array.from(label).slice(0, max).join('').trim()
}

export function cleanMention(
  attrs: { id?: unknown; label?: unknown },
  max: number = MAX_MENTION_LABEL,
): MentionAttributes | null {
  if (!isMentionId(attrs.id)) return null
  return { id: attrs.id, label: cleanMentionLabel(attrs.label, max) || attrs.id }
}

const validateId = (value: unknown): void => {
  if (!isMentionId(value)) throw new RangeError('Invalid mention id')
}

function mentionSpec(options: MentionOptions): NodeSpec {
  return {
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    attrs: {
      id: { validate: validateId },
      label: { default: '', validate: 'string' },
    },
    parseDOM: [
      {
        tag: 'span[data-mention]',
        priority: 60,
        getAttrs: (dom) =>
          cleanMention(
            { id: dom.getAttribute('data-mention'), label: dom.textContent },
            options.maxLabelLength,
          ) ?? false,
      },
    ],
    toDOM: (node) => {
      const mention = cleanMention(node.attrs, options.maxLabelLength)
      return mention
        ? ['span', { class: 'vive-mention', 'data-mention': mention.id }, `@${mention.label}`]
        : ['span', {}]
    },
    leafText: (node) => `@${cleanMention(node.attrs, options.maxLabelLength)?.label ?? ''}`,
  }
}

export const Mention: Extension<MentionOptions> = defineExtension({
  name: 'mention',
  defaultOptions: { maxLabelLength: MAX_MENTION_LABEL },
  nodes: (options) => ({ mention: mentionSpec(options) }),
  commands: ({ schema, options }) => {
    const type = schema.nodes.mention as NodeType
    return {
      insertMention:
        (input: MentionAttributes): Command =>
        (state, dispatch, view) => {
          if (view && !view.editable) return false
          const mention = cleanMention(input ?? {}, options.maxLabelLength)
          const { $from } = state.selection
          if (!mention || !$from.parent.inlineContent || $from.parent.type.spec.code) return false
          if (!$from.parent.canReplaceWith($from.index(), $from.indexAfter(), type)) return false
          if (dispatch) {
            const transaction = state.tr.replaceSelectionWith(type.create(mention), false)
            dispatch(transaction.insertText(' ').scrollIntoView())
          }
          return true
        },
    }
  },
})
