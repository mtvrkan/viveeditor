import type { JSONContent } from '@viveeditor/core'
import {
  defaultMarkdownSerializer,
  MarkdownSerializer,
  MarkdownSerializerState,
} from 'prosemirror-markdown'
import type { Node as ProseMirrorNode, Schema } from 'prosemirror-model'

type NodeWriter = (
  state: MarkdownSerializerState,
  node: ProseMirrorNode,
  parent: ProseMirrorNode,
  index: number,
) => void

export interface MarkdownSource {
  readonly schema: Schema
  getJSON(): JSONContent
}

export interface ToMarkdownOptions {
  embedUrl?: (attrs: Record<string, unknown>) => string | null
}

const WATCH_URLS: Record<string, (id: string) => string> = {
  youtube: (id) => `https://www.youtube.com/watch?v=${id}`,
  vimeo: (id) => `https://vimeo.com/${id}`,
  spotify: (id) => `https://open.spotify.com/${id.replace(':', '/')}`,
}

const defaults = defaultMarkdownSerializer.nodes as Record<string, NodeWriter>
const defaultMarks = defaultMarkdownSerializer.marks

function fenceFor(text: string): string {
  const runs = text.match(/`{3,}/g) ?? []
  const longest = runs.reduce((length, run) => Math.max(length, run.length), 2)
  return '`'.repeat(longest + 1)
}

function codeSpan(text: string): string {
  const flat = text.replace(/\s*\n\s*/g, ' ')
  const runs = flat.match(/`+/g) ?? []
  const ticks = '`'.repeat(runs.reduce((length, run) => Math.max(length, run.length), 0) + 1)
  const pad = flat.startsWith('`') || flat.endsWith('`') ? ' ' : ''
  return `${ticks}${pad}${flat}${pad}${ticks}`
}

const safeLatex = (latex: string): string => latex.replace(/</g, '\\lt ').replace(/>/g, '\\gt ')

function inlineMath(latex: string): string {
  const source = latex.trim()
  if (source === '') return ''
  if (/[$`\n]/.test(source)) return codeSpan(source)
  return `$${safeLatex(source)}$`
}

function blockMathLines(latex: string): string[] {
  const lines = latex.trim().split('\n')
  if (lines.some((line) => line.trim() === '' || line.trim().startsWith('$$'))) {
    const fence = fenceFor(latex)
    return [`${fence}math`, ...lines, fence]
  }
  return ['$$', ...lines.map(safeLatex), '$$']
}

const ENTITY_LIKE = /&(?=#?[A-Za-z0-9]+;)/g

const BULLET_LISTS = new Set(['bulletList', 'taskList'])

function followsSameKind(parent: ProseMirrorNode, index: number, kinds: Set<string>): boolean {
  let run = 0
  for (let position = index - 1; position >= 0; position--) {
    if (!kinds.has(parent.child(position).type.name)) break
    run++
  }
  return run % 2 === 1
}

function writeLines(state: MarkdownSerializerState, lines: string[], node: ProseMirrorNode): void {
  lines.forEach((line, index) => {
    if (index > 0) state.ensureNewLine()
    state.write(line)
  })
  state.closeBlock(node)
}

function rowAt<Value>(rows: Value[][], index: number): Value[] {
  const existing = rows[index]
  if (existing) return existing
  const row: Value[] = []
  rows[index] = row
  return row
}

function tableLines(node: ProseMirrorNode, cellText: (cell: ProseMirrorNode) => string): string[] {
  const grid: string[][] = []
  const taken: boolean[][] = []
  const headerRow = node.firstChild?.firstChild?.type.name === 'tableHeader'
  node.forEach((row, _offset, rowIndex) => {
    let column = 0
    row.forEach((cell) => {
      while (rowAt(taken, rowIndex)[column]) column++
      const colspan = Number(cell.attrs.colspan) || 1
      const rowspan = Number(cell.attrs.rowspan) || 1
      for (let down = 0; down < rowspan; down++) {
        for (let right = 0; right < colspan; right++) {
          rowAt(taken, rowIndex + down)[column + right] = true
          rowAt(grid, rowIndex + down)[column + right] =
            down === 0 && right === 0 ? cellText(cell) : ''
        }
      }
      column += colspan
    })
  })
  const width = Math.max(1, ...grid.map((row) => row.length))
  const rows = grid.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ''))
  const header = headerRow ? (rows.shift() ?? []) : Array.from({ length: width }, () => '')
  const line = (cells: string[]): string => `| ${cells.join(' | ')} |`
  return [line(header), line(header.map(() => '---')), ...rows.map(line)]
}

interface Serializer {
  serializer: MarkdownSerializer
  notes: ProseMirrorNode[]
}

function createSerializer(schema: Schema, options: ToMarkdownOptions): Serializer {
  const embedUrl =
    options.embedUrl ??
    ((attrs: Record<string, unknown>): string | null => {
      const watch = WATCH_URLS[String(attrs.provider)]
      return watch && typeof attrs.id === 'string' ? watch(attrs.id) : null
    })

  const inlineText = (node: ProseMirrorNode): string =>
    serialize(serializer, node, { tightLists: true })
      .trim()
      .replace(/\s*\n+\s*/g, ' ')
      .replace(/\|/g, '\\|')

  const notes: ProseMirrorNode[] = []

  const nodes: Record<string, NodeWriter> = {
    doc: (state, node) => state.renderContent(node),
    text: (state, node, parent, index) => {
      const start = index === 0 ? /^\s+/ : /^$/
      const end = index === parent.childCount - 1 ? /\s+$/ : /^$/
      const text = (node.text ?? '').replace(start, '').replace(end, '')
      if (text) defaults.text?.(state, node.type.schema.text(text, node.marks), parent, index)
    },
    paragraph: defaults.paragraph as NodeWriter,
    heading: defaults.heading as NodeWriter,
    blockquote: defaults.blockquote as NodeWriter,
    horizontalRule: defaults.horizontal_rule as NodeWriter,
    hardBreak: defaults.hard_break as NodeWriter,
    image: (state, node, parent, index) => {
      defaults.image?.(state, node, parent, index)
      state.closeBlock(node)
    },
    listItem: (state, node, parent, index) => {
      const first = node.firstChild
      if (node.childCount < 2 || !first?.isTextblock || first.content.size > 0) {
        defaults.list_item?.(state, node, parent, index)
        return
      }
      node.forEach((child, _offset, position) => {
        if (position > 0) state.render(child, node, position)
      })
    },
    bulletList: (state, node, parent, index) => {
      const marker = followsSameKind(parent, index, BULLET_LISTS) ? '* ' : '- '
      state.renderList(node, '  ', () => marker)
    },
    taskList: (state, node, parent, index) => {
      const marker = followsSameKind(parent, index, BULLET_LISTS) ? '* ' : '- '
      state.renderList(node, '  ', () => marker)
    },
    taskItem: (state, node) => {
      state.write(node.attrs.checked === true ? '[x] ' : '[ ] ')
      state.renderContent(node)
    },
    orderedList: (state, node, parent, index) => {
      const delimiter = followsSameKind(parent, index, new Set(['orderedList'])) ? ')' : '.'
      const start = Number(node.attrs.start) || 1
      const width = String(start + node.childCount - 1).length
      const space = ' '.repeat(width + 2)
      state.renderList(node, space, (index) => {
        const number = String(start + index)
        return `${' '.repeat(width - number.length)}${number}${delimiter} `
      })
    },
    codeBlock: (state, node) => {
      const fence = fenceFor(node.textContent)
      const language = typeof node.attrs.language === 'string' ? node.attrs.language : ''
      state.write(`${fence}${language}\n`)
      state.text(node.textContent, false)
      state.ensureNewLine()
      state.write(fence)
      state.closeBlock(node)
    },
    table: (state, node) => writeLines(state, tableLines(node, inlineText), node),
    embed: (state, node) => {
      const url = embedUrl(node.attrs)
      if (url) {
        const label =
          typeof node.attrs.title === 'string' && node.attrs.title ? node.attrs.title : url
        state.write(`[${state.esc(label)}](${url})`)
      }
      state.closeBlock(node)
    },
    mention: (state, node) => state.text(String(node.type.spec.leafText?.(node) ?? '')),
    mathInline: (state, node) => state.write(inlineMath(String(node.attrs.latex ?? ''))),
    mathBlock: (state, node) => {
      const latex = String(node.attrs.latex ?? '')
      if (latex.trim()) writeLines(state, blockMathLines(latex), node)
      else state.closeBlock(node)
    },
    footnote: (state, node) => {
      notes.push(node)
      state.write(`[^${notes.length}]`)
    },
  }

  for (const [name, type] of Object.entries(schema.nodes)) {
    if (nodes[name]) continue
    nodes[name] = type.isTextblock
      ? (defaults.paragraph as NodeWriter)
      : type.isBlock
        ? (state, node) => state.renderContent(node)
        : (state, node) => state.text(node.textContent)
  }

  const plain = { open: '', close: '', mixable: true }
  const marks: Record<string, (typeof defaultMarks)[string]> = {
    bold: defaultMarks.strong as (typeof defaultMarks)[string],
    italic: defaultMarks.em as (typeof defaultMarks)[string],
    code: defaultMarks.code as (typeof defaultMarks)[string],
    link: defaultMarks.link as (typeof defaultMarks)[string],
    strike: { open: '~~', close: '~~', mixable: true, expelEnclosingWhitespace: true },
  }
  for (const name of Object.keys(schema.marks)) marks[name] ??= plain

  const serializer = new MarkdownSerializer(nodes, marks, { escapeExtraCharacters: ENTITY_LIKE })
  return { serializer, notes }
}

interface StateInternals {
  out: string
  atBlank(): boolean
  renderContent(content: ProseMirrorNode): void
}

type StateConstructor = new (
  nodes: MarkdownSerializer['nodes'],
  marks: MarkdownSerializer['marks'],
  options: MarkdownSerializer['options'],
) => StateInternals

const OUTPUT_CHUNK = 1024
const KEPT_TAIL = 2

class LinearSerializerState extends (MarkdownSerializerState as unknown as StateConstructor) {
  readonly done: string[] = []

  override atBlank(): boolean {
    if (this.out.length > OUTPUT_CHUNK) {
      this.done.push(this.out.slice(0, -KEPT_TAIL))
      this.out = this.out.slice(-KEPT_TAIL)
    }
    return this.done.length === 0 ? /(^|\n)$/.test(this.out) : this.out.endsWith('\n')
  }

  output(): string {
    return this.done.join('') + this.out
  }
}

function serialize(
  serializer: MarkdownSerializer,
  content: ProseMirrorNode,
  options: { tightLists?: boolean } = {},
): string {
  const state = new LinearSerializerState(serializer.nodes, serializer.marks, {
    ...serializer.options,
    ...options,
  })
  state.renderContent(content)
  return state.output()
}

export function toMarkdown(source: MarkdownSource, options: ToMarkdownOptions = {}): string {
  const doc = source.schema.nodeFromJSON(source.getJSON())
  const { serializer, notes } = createSerializer(source.schema, options)
  const body = serialize(serializer, doc, { tightLists: true })
  const paragraph = source.schema.nodes.paragraph
  if (notes.length === 0 || !paragraph) return body
  const definitions = notes.map((note, index) => {
    const wrapper = source.schema.topNodeType.create(null, paragraph.create(null, note.content))
    return `[^${index + 1}]: ${serialize(serializer, wrapper)}`
  })
  return [body, ...definitions].join('\n\n')
}
