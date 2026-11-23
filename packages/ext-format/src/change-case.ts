import { defineExtension, type Extension } from '@viveeditor/core'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { type Command, type EditorState, TextSelection } from 'prosemirror-state'

export type TextCase = 'upper' | 'lower' | 'title' | 'sentence'

export interface ChangeCaseOptions {
  locale: string | null
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    changeCase: (mode: TextCase, fallbackLocale?: string) => Command
    cycleCase: (fallbackLocale?: string) => Command
  }
}

interface View {
  dom: Element
}

const WORD = /[\p{L}\p{N}\p{M}'’]/u
const SENTENCE_END = /[.!?…]/u
const MODES: readonly TextCase[] = ['upper', 'lower', 'title', 'sentence']

function resolveLocale(
  options: ChangeCaseOptions,
  view: View | undefined,
  fallback: string | undefined,
): string | undefined {
  const lang =
    options.locale ||
    view?.dom.closest('[lang]')?.getAttribute('lang') ||
    fallback ||
    globalThis.document?.documentElement.lang ||
    ''
  try {
    return Intl.getCanonicalLocales(lang)[0]
  } catch {
    return undefined
  }
}

function range(state: EditorState): { from: number; to: number } | null {
  const { empty, from, to, $from } = state.selection
  if (!empty) return { from, to }
  if (!$from.parent.isTextblock || $from.parent.type.spec.code) return null
  const text = $from.parent.textBetween(0, $from.parent.content.size, '\0', '\0')
  let start = $from.parentOffset
  let end = start
  while (start > 0 && WORD.test(text[start - 1] ?? '')) start--
  while (end < text.length && WORD.test(text[end] ?? '')) end++
  return start === end ? null : { from: $from.start() + start, to: $from.start() + end }
}

function convert(
  text: string,
  mode: TextCase,
  locale: string | undefined,
  state: { previous: string; sentenceStart: boolean },
): string {
  let result = ''
  for (const char of text) {
    const lower = char.toLocaleLowerCase(locale)
    let next = lower
    if (mode === 'upper') next = char.toLocaleUpperCase(locale)
    else if (mode === 'title' && !WORD.test(state.previous)) next = char.toLocaleUpperCase(locale)
    else if (mode === 'sentence' && state.sentenceStart && /\p{L}/u.test(char)) {
      next = char.toLocaleUpperCase(locale)
    }
    if (/[\p{L}\p{N}]/u.test(char)) state.sentenceStart = false
    else if (SENTENCE_END.test(char)) state.sentenceStart = true
    state.previous = char
    result += next
  }
  return result
}

function sentenceStartBefore(block: ProseMirrorNode, offset: number): boolean {
  const before = block.textBetween(0, offset, '\0', '\0')
  for (let index = before.length - 1; index >= 0; index--) {
    const char = before[index] ?? ''
    if (/[\p{L}\p{N}]/u.test(char)) return false
    if (SENTENCE_END.test(char)) return true
  }
  return true
}

function changeCase(
  options: ChangeCaseOptions,
  mode: TextCase | 'cycle',
  fallback?: string,
): Command {
  return (state, dispatch, view) => {
    const target = range(state)
    if (!target) return false
    const locale = resolveLocale(options, view as View | undefined, fallback)
    const transaction = state.tr
    const original = state.doc.textBetween(target.from, target.to, '\n', '\n')
    const chosen: TextCase =
      mode !== 'cycle'
        ? mode
        : original === original.toLocaleUpperCase(locale) &&
            original !== original.toLocaleLowerCase(locale)
          ? 'lower'
          : original === original.toLocaleLowerCase(locale)
            ? 'title'
            : 'upper'
    if (!MODES.includes(chosen)) return false
    let block: ProseMirrorNode | null = null
    const progress = { previous: '', sentenceStart: true }
    const edits: { from: number; to: number; text: string; node: ProseMirrorNode }[] = []
    state.doc.nodesBetween(target.from, target.to, (node, pos, parent) => {
      if (node.isTextblock && node.type.spec.code) return false
      if (!node.isText || !parent) return true
      const from = Math.max(pos, target.from)
      const to = Math.min(pos + node.nodeSize, target.to)
      if (parent !== block) {
        block = parent
        const $from = state.doc.resolve(from)
        const offset = $from.parentOffset
        const before = parent.textBetween(0, offset, '\0', '\0')
        progress.previous = before.slice(-1)
        progress.sentenceStart = sentenceStartBefore(parent, offset)
      }
      const text = node.text?.slice(from - pos, to - pos) ?? ''
      const next = convert(text, chosen, locale, progress)
      if (next !== text) edits.push({ from, to, text: next, node })
      return false
    })
    if (edits.length === 0) return false
    if (!dispatch) return true
    for (const edit of edits.reverse()) {
      transaction.replaceWith(edit.from, edit.to, state.schema.text(edit.text, edit.node.marks))
    }
    const { from, to } = state.selection
    const kept = edits.every((edit) => edit.text.length === edit.to - edit.from)
    const { mapping } = transaction
    transaction.setSelection(
      kept
        ? TextSelection.create(transaction.doc, from, to)
        : TextSelection.create(transaction.doc, mapping.map(from, -1), mapping.map(to, 1)),
    )
    dispatch(transaction.scrollIntoView())
    return true
  }
}

export const ChangeCase: Extension<ChangeCaseOptions> = defineExtension({
  name: 'changeCase',
  defaultOptions: { locale: null },
  commands: ({ options }) => ({
    changeCase: (mode: TextCase, fallbackLocale?: string) =>
      changeCase(options, mode, fallbackLocale),
    cycleCase: (fallbackLocale?: string) => changeCase(options, 'cycle', fallbackLocale),
  }),
  keymap: ({ options }) => ({ 'Shift-F3': changeCase(options, 'cycle') }),
})
