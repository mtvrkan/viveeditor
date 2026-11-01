import { InputRule } from 'prosemirror-inputrules'
import type { MarkType } from 'prosemirror-model'

export function markInputRule(pattern: RegExp, markType: MarkType): InputRule {
  return new InputRule(pattern, (state, match, start, end) => {
    const [fullMatch, text] = match
    if (!fullMatch || !text) return null
    const textStart = start + fullMatch.indexOf(text)
    const textEnd = textStart + text.length
    const $start = state.doc.resolve(start)
    if (!$start.parent.type.allowsMarkType(markType)) return null
    const transaction = state.tr
    if (textEnd < end) transaction.delete(textEnd, end)
    if (textStart > start) transaction.delete(start, textStart)
    transaction.addMark(start, start + text.length, markType.create())
    transaction.removeStoredMark(markType)
    return transaction
  })
}
