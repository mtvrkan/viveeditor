import { defineExtension, type Extension } from '@viveeditor/core'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

export interface HighlightToken {
  from: number
  to: number
  style: string
}

export type Highlighter = (
  code: string,
  language: string,
) => readonly HighlightToken[] | Promise<readonly HighlightToken[]>

export interface CodeHighlightOptions {
  highlighter: Highlighter | null
  delay: number
  cacheSize: number
}

interface ShikiToken {
  content: string
  offset: number
  color?: string
  htmlStyle?: string | Record<string, string>
}

export interface ShikiLike<Language extends string = string> {
  codeToTokens(
    code: string,
    options: { lang: Language; themes: Record<string, string>; defaultColor: false },
  ): Promise<{ tokens: ShikiToken[][] }> | { tokens: ShikiToken[][] }
}

export interface ShikiHighlighterOptions {
  themes?: { light: string; dark: string }
}

const SAFE_STYLE = /^[\w\s:;#().,%-]*$/

function styleOf(token: ShikiToken): string {
  const style = token.htmlStyle
  const text =
    typeof style === 'string'
      ? style
      : style
        ? Object.entries(style)
            .map(([name, value]) => `${name}:${value}`)
            .join(';')
        : token.color
          ? `color:${token.color}`
          : ''
  return SAFE_STYLE.test(text) ? text : ''
}

export function shikiHighlighter<Language extends string>(
  load: () => Promise<ShikiLike<Language>>,
  options: ShikiHighlighterOptions = {},
): Highlighter {
  const themes = options.themes ?? { light: 'github-light-default', dark: 'github-dark-default' }
  let pending: Promise<ShikiLike<Language>> | null = null
  return async (code, language) => {
    pending ??= load()
    const shiki = await pending
    try {
      const result = await shiki.codeToTokens(code, {
        lang: language as Language,
        themes,
        defaultColor: false,
      })
      return result.tokens.flat().flatMap((token) => {
        const style = styleOf(token)
        return style && token.content
          ? [{ from: token.offset, to: token.offset + token.content.length, style }]
          : []
      })
    } catch {
      return []
    }
  }
}

const key = new PluginKey<DecorationSet>('codeHighlight')

interface Block {
  id: string
  code: string
  language: string
}

function blocksOf(doc: ProseMirrorNode): Array<Block & { position: number }> {
  const blocks: Array<Block & { position: number }> = []
  doc.descendants((node, position) => {
    if (!node.type.spec.code) return true
    const language = node.attrs.language
    if (typeof language === 'string' && language) {
      const code = node.textContent
      blocks.push({ id: `${language}\u0000${code}`, code, language, position })
    }
    return false
  })
  return blocks
}

export const CodeHighlight: Extension<CodeHighlightOptions> = defineExtension({
  name: 'codeHighlight',
  defaultOptions: { highlighter: null, delay: 120, cacheSize: 200 },
  plugins: ({ options }) => {
    const highlight = options.highlighter
    if (!highlight) return []
    const highlighter: Highlighter = highlight
    const cache = new Map<string, readonly HighlightToken[]>()
    const remember = (id: string, tokens: readonly HighlightToken[]): void => {
      cache.delete(id)
      cache.set(id, tokens)
      while (cache.size > options.cacheSize) {
        const oldest = cache.keys().next().value
        if (oldest === undefined) break
        cache.delete(oldest)
      }
    }
    const build = (doc: ProseMirrorNode): DecorationSet => {
      const decorations: Decoration[] = []
      for (const block of blocksOf(doc)) {
        const tokens = cache.get(block.id)
        if (!tokens) continue
        const start = block.position + 1
        for (const token of tokens) {
          if (token.from < 0 || token.to > block.code.length || token.from >= token.to) continue
          decorations.push(
            Decoration.inline(start + token.from, start + token.to, { style: token.style }),
          )
        }
      }
      return DecorationSet.create(doc, decorations)
    }
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_config, state) => build(state.doc),
          apply: (transaction, decorations) =>
            transaction.getMeta(key) === true
              ? build(transaction.doc)
              : decorations.map(transaction.mapping, transaction.doc),
        },
        props: {
          decorations: (state) => key.getState(state),
        },
        view: (view) => {
          let timer = 0
          let destroyed = false
          const request = (): void => {
            const missing = blocksOf(view.state.doc).filter((block) => !cache.has(block.id))
            if (missing.length === 0) return
            Promise.all(
              missing.map(async (block) => {
                remember(block.id, await highlighter(block.code, block.language))
              }),
            )
              .catch(() => undefined)
              .then(() => {
                if (!destroyed) view.dispatch(view.state.tr.setMeta(key, true))
              })
          }
          const schedule = (): void => {
            window.clearTimeout(timer)
            timer = window.setTimeout(request, options.delay)
          }
          schedule()
          return {
            update: (current, previous) => {
              if (!current.state.doc.eq(previous.doc)) schedule()
            },
            destroy: () => {
              destroyed = true
              window.clearTimeout(timer)
            },
          }
        },
      }),
    ]
  },
})
