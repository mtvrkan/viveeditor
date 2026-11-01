import type { EditorContent } from '@viveeditor/core'
import type { UiPlugin } from '../plugins.js'
import { foldText } from '../tools.js'
import { type ExtrasMessages, extrasMessages } from './messages.js'
import { suggestionMenu } from './suggest.js'

export interface MentionItem {
  id: string
  label: string
  description?: string
}

export interface MentionMenuOptions {
  items(
    query: string,
    signal: AbortSignal,
  ): readonly MentionItem[] | Promise<readonly MentionItem[]>
  messages?: Partial<ExtrasMessages>
}

export function mentionMenu(options: MentionMenuOptions): UiPlugin {
  return (host) => {
    if (!host.commands.has('insertMention')) return {}
    const messages = extrasMessages(host.locale, options.messages)
    return suggestionMenu<MentionItem>({
      char: '@',
      query: '[\\p{L}\\p{N}_.\\-]{0,32}',
      title: messages.mentionTitle,
      loading: messages.loading,
      empty: messages.noResults,
      items: options.items,
      select: (item, current) =>
        current.commands.run('insertMention', { id: item.id, label: item.label }),
    })(host)
  }
}

export type EmojiRow = readonly [emoji: string, name: string, keywords: readonly string[]]

export interface EmojiMenuOptions {
  load(): Promise<readonly EmojiRow[] | { default: readonly EmojiRow[] }>
  messages?: Partial<ExtrasMessages>
}

const MAX_EMOJI_ROWS = 5000

const isEmojiRow = (row: unknown): row is EmojiRow =>
  Array.isArray(row) &&
  row.length === 3 &&
  typeof row[0] === 'string' &&
  Array.from(row[0]).length <= 16 &&
  typeof row[1] === 'string' &&
  Array.isArray(row[2]) &&
  row[2].every((keyword) => typeof keyword === 'string')

interface EmojiItem {
  label: string
  icon: string
  names: string[]
  words: string[]
}

const emojiRank = (item: EmojiItem, needle: string): number =>
  item.names.join(' ') === needle ? 0 : item.names.some((word) => word.startsWith(needle)) ? 1 : 2

export function emojiMenu(options: EmojiMenuOptions): UiPlugin {
  let data: Promise<EmojiItem[]> | null = null
  const loadData = (): Promise<EmojiItem[]> => {
    data ??= options.load().then((module) => {
      const rows: unknown = Array.isArray(module)
        ? module
        : (module as { default: unknown }).default
      if (!Array.isArray(rows) || rows.length > MAX_EMOJI_ROWS || !rows.every(isEmojiRow)) {
        throw new TypeError('Emoji data has an unexpected shape.')
      }
      return rows.map(([emoji, name, keywords]) => ({
        label: name,
        icon: emoji,
        names: foldText(name).split(/[\s_]+/),
        words: foldText(`${name} ${keywords.join(' ')}`).split(/[\s_]+/),
      }))
    })
    data.catch(() => {
      data = null
    })
    return data
  }
  return (host) => {
    const messages = extrasMessages(host.locale, options.messages)
    return suggestionMenu<EmojiItem>({
      char: ':',
      query: '[\\p{L}\\p{N}_+\\-]{2,32}',
      title: messages.emojiTitle,
      loading: messages.loading,
      empty: messages.noResults,
      delay: 60,
      items: async (query) => {
        const needle = foldText(query)
        return (await loadData())
          .filter((item) => item.words.some((word) => word.startsWith(needle)))
          .sort((first, second) => emojiRank(first, needle) - emojiRank(second, needle))
      },
      select: (item, current) => current.commands.run('insertText', item.icon),
    })(host)
  }
}

export interface Template {
  id: string
  label: string
  description?: string
  content: EditorContent
}

const MAX_TEMPLATE_LENGTH = 2_000_000

export function templateMenu(
  templates: readonly Template[],
  overrides: Partial<ExtrasMessages> = {},
): UiPlugin {
  return (host) => {
    const messages = extrasMessages(host.locale, overrides)
    const glyph = document.createTextNode('▤')
    return {
      slash: templates
        .filter(
          (template) =>
            typeof template.content !== 'string' || template.content.length <= MAX_TEMPLATE_LENGTH,
        )
        .map((template) => ({
          id: `template-${template.id}`,
          label: `${messages.template}: ${template.label}`,
          keywords: `template sablon ${template.label} ${template.description ?? ''}`,
          icon: glyph,
          run: () => {
            if (host.editor.isEditable) host.commands.run('insertContent', template.content)
            host.editor.focus()
          },
        })),
    }
  }
}

const glyphEntry = (
  host: Parameters<UiPlugin>[0],
  id: string,
  label: string,
  keywords: string,
  glyph: string,
  command: string,
  args: unknown[],
) => ({
  id,
  label,
  keywords,
  icon: document.createTextNode(glyph),
  run: () => {
    host.editor.focus()
    if (host.editor.isEditable) host.commands.run(command, ...args)
  },
})

export function mathTools(overrides: Partial<ExtrasMessages> = {}): UiPlugin {
  return (host) => {
    if (!host.commands.has('insertMath')) return {}
    const messages = extrasMessages(host.locale, overrides)
    return {
      slash: [
        glyphEntry(
          host,
          'math',
          messages.math,
          'math formul formula latex denklem equation',
          'Σ',
          'insertMath',
          [{ display: false }],
        ),
        glyphEntry(
          host,
          'mathBlock',
          messages.mathBlock,
          'math formul formula latex denklem equation blok block',
          '∑',
          'insertMath',
          [{ display: true }],
        ),
      ],
    }
  }
}

export function footnoteTools(overrides: Partial<ExtrasMessages> = {}): UiPlugin {
  return (host) => {
    if (!host.commands.has('insertFootnote')) return {}
    const messages = extrasMessages(host.locale, overrides)
    return {
      slash: [
        glyphEntry(
          host,
          'footnote',
          messages.footnote,
          'dipnot footnote not note kaynak',
          '¹',
          'insertFootnote',
          [],
        ),
      ],
    }
  }
}
