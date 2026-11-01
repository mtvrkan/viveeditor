import { defineExtension, type Extension, getNodeType } from '@viveeditor/core'
import { newlineInCode, setBlockType } from 'prosemirror-commands'
import { textblockTypeInputRule } from 'prosemirror-inputrules'
import type { Node as ProseMirrorNode, Schema } from 'prosemirror-model'
import { type Command, type EditorState, Plugin, TextSelection } from 'prosemirror-state'
import type { EditorView, NodeView } from 'prosemirror-view'

export interface CodeLanguage {
  value: string
  label: string
}

export interface CodeBlockOptions {
  languages: readonly CodeLanguage[]
  languageLabel: string
  plainTextLabel: string
  tabSize: number
}

declare module '@viveeditor/core' {
  interface CommandRegistry {
    toggleCodeBlock: (language?: string | null) => Command
    setCodeBlockLanguage: (language: string | null) => Command
  }
  interface QueryRegistry {
    codeBlockLanguage: () => string | null
  }
}

const LANGUAGE = /^[a-z0-9][a-z0-9+#.-]{0,31}$/i

export function normalizeLanguage(value: unknown): string | null {
  return typeof value === 'string' && LANGUAGE.test(value) ? value.toLowerCase() : null
}

function languageOf(element: HTMLElement): string | null {
  const fromData = normalizeLanguage(element.dataset.language)
  if (fromData) return fromData
  const code = element.querySelector('code') ?? element
  const match = /(?:^|\s)(?:language|lang)-(\S+)/.exec(code.className)
  return normalizeLanguage(match?.[1])
}

export const DEFAULT_LANGUAGES: readonly CodeLanguage[] = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'python', label: 'Python' },
  { value: 'php', label: 'PHP' },
  { value: 'java', label: 'Java' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'swift', label: 'Swift' },
  { value: 'csharp', label: 'C#' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' },
]

const inCodeBlock = (state: EditorState): boolean =>
  state.selection.$from.parent.type.spec.code === true

function toggleCodeBlock(schema: Schema, language: string | null): Command {
  return (state, dispatch) => {
    const codeBlock = getNodeType(schema, 'codeBlock')
    const paragraph = getNodeType(schema, 'paragraph')
    const { $from, $to } = state.selection
    if ($from.parent.type === codeBlock) {
      if (!dispatch) return true
      const start = $from.before()
      const lines = $from.parent.textContent.split('\n')
      const paragraphs = lines.map((line) =>
        paragraph.create(null, line ? schema.text(line) : null),
      )
      const transaction = state.tr.replaceWith(start, $from.after(), paragraphs)
      transaction.setSelection(TextSelection.near(transaction.doc.resolve(start + 1)))
      dispatch(transaction.scrollIntoView())
      return true
    }
    const attrs = { language: normalizeLanguage(language) }
    const range = $from.blockRange($to)
    if (
      !range ||
      range.endIndex - range.startIndex < 2 ||
      ($from.parent.isTextblock && $from.sameParent($to))
    ) {
      return setBlockType(codeBlock, attrs)(state, dispatch)
    }
    if (!range.parent.canReplaceWith(range.startIndex, range.endIndex, codeBlock)) return false
    if (dispatch) {
      const lines: string[] = []
      state.doc.nodesBetween(range.start, range.end, (node) => {
        if (!node.isTextblock) return true
        lines.push(node.textContent)
        return false
      })
      const text = lines.join('\n')
      const block = codeBlock.create(attrs, text ? schema.text(text) : null)
      const transaction = state.tr.replaceWith(range.start, range.end, block)
      transaction.setSelection(TextSelection.near(transaction.doc.resolve(range.start + 1)))
      dispatch(transaction.scrollIntoView())
    }
    return true
  }
}

function setLanguage(language: string | null): Command {
  return (state, dispatch) => {
    const { $from } = state.selection
    if ($from.parent.type.name !== 'codeBlock') return false
    const normalized = normalizeLanguage(language)
    if (language !== null && language !== '' && normalized === null) return false
    dispatch?.(
      state.tr.setNodeMarkup($from.before(), undefined, {
        ...$from.parent.attrs,
        language: normalized,
      }),
    )
    return true
  }
}

const exitOnTripleEnter: Command = (state, dispatch) => {
  const { $from, empty } = state.selection
  const block = $from.parent
  if (!empty || !block.type.spec.code || $from.parentOffset !== block.content.size) return false
  if (!block.textContent.endsWith('\n\n')) return false
  const after = $from.after()
  const paragraph = state.schema.nodes.paragraph
  if (!paragraph) return false
  if (dispatch) {
    const transaction = state.tr.delete($from.pos - 2, $from.pos)
    const position = transaction.mapping.map(after)
    transaction.insert(position, paragraph.create())
    transaction.setSelection(TextSelection.create(transaction.doc, position + 1))
    dispatch(transaction.scrollIntoView())
  }
  return true
}

const leaveEmptyBlock: Command = (state, dispatch) => {
  const { $from, empty } = state.selection
  const block = $from.parent
  if (!empty || !block.type.spec.code || block.content.size > 0) return false
  const paragraph = state.schema.nodes.paragraph
  return paragraph ? setBlockType(paragraph)(state, dispatch) : false
}

function indent(outdent: boolean, tabSize: number): Command {
  return (state, dispatch) => {
    if (!inCodeBlock(state)) return false
    const { $from, from, to } = state.selection
    const blockStart = $from.start()
    const text = $from.parent.textContent
    const firstLine = text.lastIndexOf('\n', from - blockStart - 1) + 1
    const lineStarts: number[] = []
    for (let offset = firstLine; offset <= to - blockStart; ) {
      lineStarts.push(offset)
      const next = text.indexOf('\n', offset)
      if (next < 0) break
      offset = next + 1
    }
    const transaction = state.tr
    const unit = ' '.repeat(tabSize)
    if (!outdent && from === to) {
      transaction.insertText(unit, from)
    } else {
      for (const offset of [...lineStarts].reverse()) {
        const position = blockStart + offset
        if (outdent) {
          const spaces = /^ */.exec(text.slice(offset, offset + tabSize))?.[0].length ?? 0
          if (spaces > 0) transaction.delete(position, position + spaces)
        } else {
          transaction.insertText(unit, position)
        }
      }
    }
    if (dispatch && transaction.docChanged) dispatch(transaction.scrollIntoView())
    return true
  }
}

class CodeBlockView implements NodeView {
  readonly dom: HTMLElement
  readonly contentDOM: HTMLElement
  private readonly header: HTMLElement
  private readonly select: HTMLSelectElement

  constructor(
    private node: ProseMirrorNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
    private readonly options: CodeBlockOptions,
  ) {
    this.dom = document.createElement('div')
    this.dom.className = 'vive-code'
    this.header = document.createElement('div')
    this.header.className = 'vive-code-header'
    this.header.contentEditable = 'false'
    this.select = document.createElement('select')
    this.select.setAttribute('aria-label', options.languageLabel)
    this.select.addEventListener('change', () => this.choose())
    this.header.append(this.select)
    const pre = document.createElement('pre')
    this.contentDOM = document.createElement('code')
    pre.append(this.contentDOM)
    this.dom.append(this.header, pre)
    this.render()
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    this.render()
    return true
  }

  stopEvent(event: Event): boolean {
    return event.target instanceof Node && this.header.contains(event.target)
  }

  ignoreMutation(mutation: MutationRecord | { type: 'selection'; target: Node }): boolean {
    if (mutation.type === 'selection') return false
    if (mutation.type === 'attributes' && mutation.target === this.dom) return true
    return this.header.contains(mutation.target)
  }

  private render(): void {
    const language = normalizeLanguage(this.node.attrs.language) ?? ''
    const choices: CodeLanguage[] = [
      { value: '', label: this.options.plainTextLabel },
      ...this.options.languages,
    ]
    if (language && !choices.some((choice) => choice.value === language)) {
      choices.push({ value: language, label: language })
    }
    const signature = choices.map((choice) => choice.value).join('|')
    if (this.select.dataset.signature !== signature) {
      this.select.dataset.signature = signature
      this.select.replaceChildren(
        ...choices.map((choice) => {
          const option = document.createElement('option')
          option.value = choice.value
          option.textContent = choice.label
          return option
        }),
      )
    }
    this.select.value = language
    this.select.disabled = !this.view.editable
    if (this.dom.dataset.language !== language) this.dom.dataset.language = language
  }

  private choose(): void {
    const position = this.getPos()
    if (position === undefined || !this.view.editable) {
      this.render()
      return
    }
    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(position, undefined, {
        ...this.node.attrs,
        language: normalizeLanguage(this.select.value),
      }),
    )
  }
}

export const CodeBlock: Extension<CodeBlockOptions> = defineExtension({
  name: 'codeBlock',
  priority: 150,
  defaultOptions: {
    languages: DEFAULT_LANGUAGES,
    languageLabel: 'Language',
    plainTextLabel: 'Plain text',
    tabSize: 2,
  },
  nodes: () => ({
    codeBlock: {
      group: 'block',
      content: 'text*',
      marks: '',
      code: true,
      defining: true,
      attrs: { language: { default: null } },
      parseDOM: [
        {
          tag: 'pre',
          preserveWhitespace: 'full',
          getAttrs: (element) => ({ language: languageOf(element) }),
        },
      ],
      toDOM: (node) => {
        const language = normalizeLanguage(node.attrs.language)
        return language
          ? ['pre', { 'data-language': language }, ['code', { class: `language-${language}` }, 0]]
          : ['pre', ['code', 0]]
      },
    },
  }),
  commands: ({ schema }) => ({
    toggleCodeBlock: (language?: string | null) => toggleCodeBlock(schema, language ?? null),
    setCodeBlockLanguage: (language: string | null) => setLanguage(language),
  }),
  queries: () => ({
    codeBlockLanguage: (state) =>
      state.selection.$from.parent.type.name === 'codeBlock'
        ? normalizeLanguage(state.selection.$from.parent.attrs.language)
        : null,
  }),
  keymap: ({ schema, options }) => ({
    Tab: indent(false, options.tabSize),
    'Shift-Tab': indent(true, options.tabSize),
    Enter: (state, dispatch, view) =>
      inCodeBlock(state) &&
      (exitOnTripleEnter(state, dispatch, view) || newlineInCode(state, dispatch, view)),
    Backspace: leaveEmptyBlock,
    'Mod-Alt-c': toggleCodeBlock(schema, null),
  }),
  inputRules: ({ schema }) => [
    textblockTypeInputRule(
      /^```([a-z0-9+#.-]*)[\s]$/i,
      getNodeType(schema, 'codeBlock'),
      (match) => ({
        language: normalizeLanguage(match[1]),
      }),
    ),
  ],
  plugins: ({ options }) => {
    let escaped = false
    return [
      new Plugin({
        props: {
          nodeViews: {
            codeBlock: (node, view, getPos) => new CodeBlockView(node, view, getPos, options),
          },
          handleDOMEvents: {
            keydown: (view, event) => {
              if (event.key === 'Escape') {
                escaped = inCodeBlock(view.state)
                return false
              }
              if (event.key === 'Tab' && escaped) {
                escaped = false
                return inCodeBlock(view.state)
              }
              if (event.key !== 'Shift') escaped = false
              return false
            },
          },
        },
      }),
    ]
  },
})
