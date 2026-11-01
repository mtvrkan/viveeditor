import { Editor, type EditorOptions } from '@viveeditor/core'
import { afterEach, describe, expect, it } from 'vitest'
import { caseInsensitivePattern, Search } from '../src/index.js'

let editors: Editor[] = []

async function mount(options: EditorOptions = {}): Promise<Editor> {
  const element = document.createElement('div')
  document.body.append(element)
  const editor = await Editor.create(element, { extensions: [Search], ...options })
  editors.push(editor)
  return editor
}

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

describe('Turkish-aware matching', () => {
  it('finds İstanbul, ISTANBUL and istanbul from a lowercase query', async () => {
    const editor = await mount({ content: '<p>İstanbul, ISTANBUL ve istanbul</p>' })

    editor.commands.setSearch({ query: 'istanbul' })

    expect(editor.query.searchStatus()).toEqual({ total: 3, current: 0 })
  })

  it('matches dotless ı and I but keeps letters with other accents apart', async () => {
    const editor = await mount({ content: '<p>IRMAK ırmak şeker seker</p>' })

    editor.commands.setSearch({ query: 'ırmak' })
    const river = editor.query.searchStatus().total
    editor.commands.setSearch({ query: 'şeker' })

    expect(river).toBe(2)
    expect(editor.query.searchStatus().total).toBe(1)
  })

  it('treats regular expression characters in the query as plain text', async () => {
    const editor = await mount({ content: '<p>a.b axb (x) [y]</p>' })

    editor.commands.setSearch({ query: 'a.b' })
    const dot = editor.query.searchStatus().total
    editor.commands.setSearch({ query: '(x) [y]' })

    expect(dot).toBe(1)
    expect(editor.query.searchStatus().total).toBe(1)
    expect(caseInsensitivePattern('?')).toBe('\\?')
  })
})

describe('search options', () => {
  it('respects case sensitivity and whole words', async () => {
    const editor = await mount({ content: '<p>Kar kar karpuz</p>' })

    editor.commands.setSearch({ query: 'kar', caseSensitive: true })
    const exact = editor.query.searchStatus().total
    editor.commands.setSearch({ query: 'kar', wholeWord: true })

    expect(exact).toBe(2)
    expect(editor.query.searchStatus().total).toBe(2)
  })

  it('reports nothing for an empty query and refuses to move', async () => {
    const editor = await mount({ content: '<p>metin</p>' })

    editor.commands.setSearch({ query: '' })

    expect(editor.query.searchStatus()).toEqual({ total: 0, current: 0 })
    expect(editor.can.findNext()).toBe(false)
  })
})

describe('navigation and replace', () => {
  it('steps through matches and wraps around', async () => {
    const editor = await mount({ content: '<p>bir iki bir üç bir</p>' })
    editor.commands.setSearch({ query: 'bir' })

    editor.commands.findNext()
    const first = editor.query.searchStatus().current
    editor.commands.findPrevious()

    expect(first).toBe(1)
    expect(editor.query.searchStatus()).toEqual({ total: 3, current: 3 })
  })

  it('replaces one match, then all, keeping $ in the replacement literal', async () => {
    const editor = await mount({ content: '<p>fiyat fiyat fiyat</p>' })
    editor.commands.setSearch({ query: 'FİYAT', replace: '$1 TL' })

    editor.commands.replaceNext()
    editor.commands.replaceNext()
    const once = editor.getText()
    editor.commands.replaceAll()

    expect(once).toBe('$1 TL fiyat fiyat')
    expect(editor.getText()).toBe('$1 TL $1 TL $1 TL')
  })

  it('deletes every match when the replacement is empty', async () => {
    const editor = await mount({ content: '<p>çok çok güzel</p>' })
    editor.commands.setSearch({ query: 'çok ' })

    editor.commands.replaceAll()

    expect(editor.getHTML()).toBe('<p>güzel</p>')
  })

  it('removes the highlights when the search is cleared', async () => {
    const editor = await mount({ content: '<p>vurgu</p>' })
    editor.commands.setSearch({ query: 'vurgu' })
    const highlighted = editor.dom.querySelectorAll('.ProseMirror-search-match').length

    editor.commands.clearSearch()

    expect(highlighted).toBe(1)
    expect(editor.dom.querySelectorAll('.ProseMirror-search-match')).toHaveLength(0)
  })
})
