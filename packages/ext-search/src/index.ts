import { defineExtension, type Extension } from '@viveeditor/core'
import {
  findNext,
  findPrev,
  getMatchHighlights,
  getSearchState,
  SearchQuery,
  search,
  setSearchState,
} from 'prosemirror-search'
import { type Command, type EditorState, TextSelection, type Transaction } from 'prosemirror-state'

export interface SearchTerms {
  query: string
  replace?: string
  caseSensitive?: boolean
  wholeWord?: boolean
}

export interface SearchStatus {
  total: number
  current: number
}

export interface SearchOptions {
  maxQueryLength: number
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    setSearch: (terms: SearchTerms) => Command
    clearSearch: () => Command
    findNext: () => Command
    findPrevious: () => Command
    replaceNext: () => Command
    replaceAll: () => Command
  }
  interface QueryRegistry {
    searchStatus: () => SearchStatus
  }
}

const SPECIAL = /[\\^$.*+?()[\]{}|/-]/g

function variants(char: string): string[] {
  const forms = [
    char,
    char.toLowerCase(),
    char.toUpperCase(),
    char.toLocaleLowerCase('tr'),
    char.toLocaleUpperCase('tr'),
  ]
  return [...new Set(forms.filter((form) => [...form].length === 1))]
}

export function caseInsensitivePattern(text: string): string {
  return [...text]
    .map((char) => {
      const forms = variants(char).map((form) => form.replace(SPECIAL, '\\$&'))
      return forms.length > 1 ? `[${forms.join('')}]` : (forms[0] ?? '')
    })
    .join('')
}

export function createQuery(terms: SearchTerms, maxLength: number): SearchQuery {
  const text = terms.query.slice(0, maxLength)
  return new SearchQuery({
    search: terms.caseSensitive ? text : caseInsensitivePattern(text),
    replace: terms.replace ?? '',
    caseSensitive: true,
    literal: true,
    regexp: !terms.caseSensitive,
    wholeWord: terms.wholeWord ?? false,
  })
}

function replaceRange(transaction: Transaction, from: number, to: number, text: string): void {
  if (text) transaction.insertText(text, from, to)
  else transaction.delete(from, to)
}

const replaceNext: Command = (state, dispatch, view) => {
  const query = getSearchState(state)?.query
  if (!query?.valid) return false
  const { from, to } = state.selection
  const current = query.findNext(state, from, to)
  if (!current || current.from !== from || current.to !== to) return findNext(state, dispatch, view)
  if (dispatch) {
    const transaction = state.tr
    replaceRange(transaction, from, to, query.replace)
    const after = state.apply(transaction)
    const position = transaction.mapping.map(to)
    const next = query.findNext(after, position) ?? query.findNext(after, 0, position)
    transaction.setSelection(
      next
        ? TextSelection.create(transaction.doc, next.from, next.to)
        : TextSelection.create(transaction.doc, position),
    )
    dispatch(transaction.scrollIntoView())
  }
  return true
}

const replaceAll: Command = (state, dispatch) => {
  const query = getSearchState(state)?.query
  if (!query?.valid) return false
  const matches = getMatchHighlights(state).find()
  if (matches.length === 0) return false
  if (dispatch) {
    const transaction = state.tr
    for (const match of [...matches].reverse()) {
      replaceRange(transaction, match.from, match.to, query.replace)
    }
    dispatch(transaction)
  }
  return true
}

const isActive = (state: EditorState): boolean => getSearchState(state)?.query.valid === true

const whenActive =
  (command: Command): Command =>
  (state, dispatch, view) =>
    isActive(state) && command(state, dispatch, view)

function status(state: EditorState): SearchStatus {
  if (!isActive(state)) return { total: 0, current: 0 }
  const matches = getMatchHighlights(state).find()
  const { from, to } = state.selection
  const index = matches.findIndex((match) => match.from === from && match.to === to)
  return { total: matches.length, current: index + 1 }
}

export const Search: Extension<SearchOptions> = defineExtension({
  name: 'search',
  defaultOptions: { maxQueryLength: 200 },
  commands: ({ options }) => ({
    setSearch:
      (terms: SearchTerms): Command =>
      (state, dispatch) => {
        dispatch?.(setSearchState(state.tr, createQuery(terms, options.maxQueryLength)))
        return true
      },
    clearSearch: (): Command => (state, dispatch) => {
      if (!isActive(state)) return false
      dispatch?.(setSearchState(state.tr, new SearchQuery({ search: '' })))
      return true
    },
    findNext: () => whenActive(findNext),
    findPrevious: () => whenActive(findPrev),
    replaceNext: () => whenActive(replaceNext),
    replaceAll: () => whenActive(replaceAll),
  }),
  queries: () => ({
    searchStatus: (state) => status(state),
  }),
  plugins: () => [search()],
})
