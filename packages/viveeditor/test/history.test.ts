import { afterEach, describe, expect, it } from 'vitest'
import { classicPreset, Editor } from '../src/index.js'

interface Case {
  name: string
  content: string
  at: string
  before?: (editor: Editor) => void
  run: (editor: Editor) => boolean
}

const TEXT = '<p>bir iki üç</p>'
const LIST = '<ol><li><p>bir</p></li><li><p>iki</p></li></ol><ul><li><p>madde</p></li></ul>'
const LINK = '<p><a href="https://example.com" title="Örnek">bağlantı</a> metin</p>'
const TABLE =
  '<table><tr><th data-colwidth="80"><p>a</p></th><th data-colwidth="120"><p>b</p></th></tr><tr><td data-colwidth="80"><p>c</p></td><td data-colwidth="120"><p>d</p></td></tr></table><p>son</p>'
const IMAGE = '<p>önce</p><img src="https://images.example.com/a.png" alt="A"><p>sonra</p>'

const CASES: Case[] = [
  { name: 'setFontSize', content: TEXT, at: 'iki', run: (e) => e.commands.setFontSize(14) },
  { name: 'stepFontSize', content: TEXT, at: 'iki', run: (e) => e.commands.stepFontSize(1) },
  {
    name: 'setFontFamily',
    content: TEXT,
    at: 'iki',
    run: (e) => e.commands.setFontFamily('Georgia, serif'),
  },
  { name: 'setLineHeight', content: TEXT, at: 'iki', run: (e) => e.commands.setLineHeight('2') },
  {
    name: 'setTextColor',
    content: TEXT,
    at: 'iki',
    run: (e) => e.commands.setTextColor('#123456'),
  },
  {
    name: 'setHighlight',
    content: TEXT,
    at: 'iki',
    run: (e) => e.commands.setHighlight('#abcdef'),
  },
  { name: 'setListType', content: LIST, at: 'bir', run: (e) => e.commands.setListType('I') },
  { name: 'setListStart', content: LIST, at: 'bir', run: (e) => e.commands.setListStart(0) },
  {
    name: 'setBulletStyle',
    content: LIST,
    at: 'madde',
    run: (e) => e.commands.setBulletStyle('circle'),
  },
  {
    name: 'setLink newTab',
    content: LINK,
    at: 'bağlantı',
    run: (e) => e.commands.setLink({ href: 'https://example.com', title: 'Örnek', newTab: true }),
  },
  {
    name: 'setImageLink',
    content: IMAGE,
    at: 'önce',
    before: (e) => {
      const image = e.dom.querySelector('img')
      if (!image || !e.commands.selectAt(image)) throw new Error('Image not selectable')
    },
    run: (e) => e.commands.setImageLink('https://example.com/a'),
  },
  {
    name: 'setCellTextAlign',
    content: TABLE,
    at: 'c',
    run: (e) => e.commands.setCellTextAlign('right'),
  },
  {
    name: 'setCellBackground',
    content: TABLE,
    at: 'c',
    run: (e) => e.commands.setCellBackground('#ffeeaa'),
  },
  { name: 'setTableWidth', content: TABLE, at: 'c', run: (e) => e.commands.setTableWidth('full') },
  {
    name: 'setTableAlign',
    content: TABLE,
    at: 'c',
    run: (e) => e.commands.setTableAlign('center'),
  },
  {
    name: 'setTableBorder',
    content: TABLE,
    at: 'c',
    run: (e) => e.commands.setTableBorder('none'),
  },
  {
    name: 'setTableStriped',
    content: TABLE,
    at: 'c',
    run: (e) => e.commands.setTableStriped(true),
  },
  {
    name: 'setTableBorderColor',
    content: TABLE,
    at: 'c',
    run: (e) => e.commands.setTableBorderColor('#1565c0'),
  },
  {
    name: 'distributeColumns',
    content: TABLE,
    at: 'c',
    run: (e) => e.commands.distributeColumns(),
  },
  {
    name: 'mergeCells on a selected row',
    content: TABLE,
    at: 'c',
    before: (e) => {
      e.commands.selectRow()
    },
    run: (e) => e.commands.mergeCells(),
  },
  { name: 'deleteTable', content: TABLE, at: 'c', run: (e) => e.commands.deleteTable() },
]

let editors: Editor[] = []

afterEach(() => {
  for (const editor of editors) editor.destroy()
  editors = []
  document.body.innerHTML = ''
})

async function mount(content: string): Promise<Editor> {
  const host = document.createElement('div')
  document.body.append(host)
  const editor = await Editor.create(host, { extensions: classicPreset('tr'), content })
  editors.push(editor)
  return editor
}

interface TextNode {
  isText: boolean
  text?: string
}

function selectWord(editor: Editor, word: string): void {
  const { doc } = (
    editor as unknown as {
      view: {
        state: { doc: { descendants(visit: (node: TextNode, pos: number) => boolean): void } }
      }
    }
  ).view.state
  let from = -1
  doc.descendants((node, position) => {
    const index = node.isText ? (node.text ?? '').indexOf(word) : -1
    if (from < 0 && index >= 0) from = position + index
    return from < 0
  })
  if (from < 0) throw new Error(`Text not found: ${word}`)
  editor.commands.setTextSelection(from, from + word.length)
}

describe('undo history of the 1.0 commands', () => {
  it.each(CASES.map((item) => [item.name, item] as const))(
    '%s is one undo step and redo brings it back',
    async (_name, item) => {
      const editor = await mount(item.content)
      selectWord(editor, item.at)
      item.before?.(editor)
      const original = editor.getHTML()

      const ran = item.run(editor)
      const changed = editor.getHTML()
      const undone = editor.commands.undo()
      const afterUndo = editor.getHTML()
      const redone = editor.commands.redo()

      expect(ran).toBe(true)
      expect(changed).not.toBe(original)
      expect(undone).toBe(true)
      expect(afterUndo).toBe(original)
      expect(redone).toBe(true)
      expect(editor.getHTML()).toBe(changed)
    },
  )
})
