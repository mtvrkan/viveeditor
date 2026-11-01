import { defineExtension, type Extension } from '@viveeditor/core'
import { closeHistory } from 'prosemirror-history'
import type {
  DOMOutputSpec,
  NodeSpec,
  NodeType,
  Node as ProseMirrorNode,
  Schema,
} from 'prosemirror-model'
import {
  type Command,
  type EditorState,
  NodeSelection,
  Plugin,
  TextSelection,
} from 'prosemirror-state'
import {
  buildEmbedSrc,
  cleanEmbed,
  type EmbedAttributes,
  embedProvider,
  iframeAttributes,
  matchEmbedUrl,
} from './providers.js'
import { EmbedView } from './view.js'

export {
  buildEmbedSrc,
  EMBED_PROVIDERS,
  type EmbedAttributes,
  type EmbedInput,
  type EmbedProvider,
  isAllowedEmbedSrc,
  matchEmbedUrl,
} from './providers.js'

export interface EmbedLabels {
  play: string
  invalid: string
}

export interface EmbedOptions {
  providers: readonly string[]
  facade: boolean
  pasteToEmbed: boolean
  maxEmbeds: number
  labels: EmbedLabels
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    insertEmbed: (url: string) => Command
    setEmbedTitle: (title: string) => Command
  }
  interface QueryRegistry {
    selectedEmbed: () => EmbedAttributes | null
    embedProviders: () => string[]
  }
}

function renderEmbed(attrs: Record<string, unknown>, options: EmbedOptions): DOMOutputSpec {
  const embed = cleanEmbed(attrs, options.providers)
  const provider = embed && embedProvider(embed.provider)
  const src = embed && buildEmbedSrc(embed, { enabled: options.providers })
  if (!embed || !provider || !src) return ['div', { 'data-embed-invalid': '' }]
  const wrapper: Record<string, string> = {
    class: 'vive-embed',
    'data-embed': embed.provider,
    'data-id': embed.id,
  }
  if (embed.hash) wrapper['data-hash'] = embed.hash
  if (embed.start) wrapper['data-start'] = String(embed.start)
  if (embed.title) wrapper['data-title'] = embed.title
  if (options.facade) {
    return [
      'div',
      wrapper,
      [
        'a',
        { href: provider.watch(embed), rel: 'noopener noreferrer' },
        embed.title ?? provider.label,
      ],
    ]
  }
  return ['div', wrapper, ['iframe', iframeAttributes(embed, provider, src)]]
}

function embedSpec(options: EmbedOptions): NodeSpec {
  return {
    group: 'block',
    atom: true,
    draggable: true,
    attrs: {
      provider: { default: null },
      id: { default: null },
      hash: { default: null },
      start: { default: null },
      title: { default: null },
    },
    parseDOM: [
      {
        tag: 'div[data-embed][data-id]',
        priority: 60,
        getAttrs: (dom) =>
          cleanEmbed(
            {
              provider: dom.getAttribute('data-embed'),
              id: dom.getAttribute('data-id'),
              hash: dom.getAttribute('data-hash'),
              start: dom.getAttribute('data-start'),
              title: dom.getAttribute('data-title'),
            },
            options.providers,
          ) ?? false,
      },
      {
        tag: 'iframe[src]',
        getAttrs: (dom) => {
          const embed = matchEmbedUrl(dom.getAttribute('src'), options.providers)
          return embed
            ? (cleanEmbed({ ...embed, title: dom.getAttribute('title') }) ?? false)
            : false
        },
      },
    ],
    toDOM: (node) => renderEmbed(node.attrs, options),
  }
}

function insertionPos(state: EditorState): number {
  const { $from } = state.selection
  if (state.selection instanceof NodeSelection) return state.selection.to
  if ($from.depth === 0 || !$from.parent.isTextblock) return $from.pos
  return $from.parent.content.size === 0 ? $from.before() : $from.after()
}

const embedCounts = new WeakMap<ProseMirrorNode, number>()

function countEmbeds(node: ProseMirrorNode, type: NodeType): number {
  if (node.type === type) return 1
  if (node.inlineContent || node.isLeaf) return 0
  const cached = embedCounts.get(node)
  if (cached !== undefined) return cached
  let total = 0
  node.forEach((child) => {
    total += countEmbeds(child, type)
  })
  embedCounts.set(node, total)
  return total
}

function insertEmbed(schema: Schema, type: NodeType, options: EmbedOptions) {
  return (url: string): Command =>
    (state, dispatch) => {
      const embed = matchEmbedUrl(url, options.providers)
      if (!embed || state.selection.$from.parent.type.spec.code) return false
      const pos = insertionPos(state)
      const $pos = state.doc.resolve(pos)
      if (!$pos.parent.canReplaceWith($pos.index(), $pos.index(), type)) return false
      if (countEmbeds(state.doc, type) >= options.maxEmbeds) return false
      if (dispatch) {
        const node = type.create(embed)
        const transaction = state.tr.insert(pos, node)
        const after = pos + node.nodeSize
        const $after = transaction.doc.resolve(after)
        const paragraph = schema.nodes.paragraph
        if (paragraph && $after.index() === $after.parent.childCount) {
          transaction.insert(after, paragraph.create())
        }
        transaction.setSelection(TextSelection.near(transaction.doc.resolve(after)))
        dispatch(transaction.scrollIntoView())
      }
      return true
    }
}

function selectedEmbed(state: EditorState, type: NodeType): NodeSelection | null {
  const { selection } = state
  return selection instanceof NodeSelection && selection.node.type === type ? selection : null
}

export const Embed: Extension<EmbedOptions> = defineExtension({
  name: 'embed',
  defaultOptions: {
    providers: ['youtube', 'vimeo', 'spotify'],
    facade: false,
    pasteToEmbed: true,
    maxEmbeds: 50,
    labels: { play: 'Play', invalid: 'This embed is not supported' },
  },
  nodes: (options) => ({ embed: embedSpec(options) }),
  commands: ({ schema, options }) => {
    const type = schema.nodes.embed as NodeType
    return {
      insertEmbed: insertEmbed(schema, type, options),
      setEmbedTitle:
        (title: string): Command =>
        (state, dispatch) => {
          const selection = selectedEmbed(state, type)
          if (!selection) return false
          const next = cleanEmbed({ ...selection.node.attrs, title }, options.providers)
          if (!next) return false
          if (dispatch) {
            const transaction = state.tr.setNodeMarkup(selection.from, undefined, next)
            transaction.setSelection(NodeSelection.create(transaction.doc, selection.from))
            dispatch(transaction)
          }
          return true
        },
    }
  },
  queries: ({ schema, options }) => ({
    selectedEmbed: (state) => {
      const selection = selectedEmbed(state, schema.nodes.embed as NodeType)
      return selection ? cleanEmbed(selection.node.attrs, options.providers) : null
    },
    embedProviders: () => options.providers.flatMap((name) => embedProvider(name)?.label ?? []),
  }),
  plugins: ({ schema, options }) => {
    const type = schema.nodes.embed as NodeType
    return [
      new Plugin({
        props: {
          nodeViews: {
            embed: (node, view, getPos) =>
              new EmbedView(node, view, getPos, {
                providers: options.providers,
                labels: options.labels,
              }),
          },
          handlePaste: (view, event) => {
            if (!options.pasteToEmbed) return false
            const text = event.clipboardData?.getData('text/plain').trim() ?? ''
            const { selection } = view.state
            const { $from } = selection
            if (!text || /\s/.test(text) || !selection.empty || $from.depth === 0) return false
            if (!$from.parent.isTextblock || $from.parent.type.spec.code) return false
            if ($from.parent.content.size !== 0) return false
            const embed = matchEmbedUrl(text, options.providers)
            if (!embed || !insertEmbed(schema, type, options)(text)(view.state)) return false
            view.dispatch(view.state.tr.insertText(text))
            const $text = view.state.selection.$from
            const node = type.create(embed)
            const from = $text.before()
            const replace = closeHistory(view.state.tr.replaceWith(from, $text.after(), node))
            const after = from + node.nodeSize
            const $after = replace.doc.resolve(after)
            const paragraph = schema.nodes.paragraph
            if (paragraph && $after.index() === $after.parent.childCount) {
              replace.insert(after, paragraph.create())
            }
            replace.setSelection(TextSelection.near(replace.doc.resolve(after)))
            view.dispatch(replace.scrollIntoView())
            return true
          },
        },
      }),
    ]
  },
})
