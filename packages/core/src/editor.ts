import {
  DOMSerializer,
  type Mark,
  type Node as ProseMirrorNode,
  type Schema,
} from 'prosemirror-model'
import { type Command, EditorState, type Transaction } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { parseContent } from './content.js'
import { ViveEditorError } from './errors.js'
import { Emitter } from './events.js'
import type {
  CommandFactory,
  CommandName,
  CommandRegistry,
  Extension,
  QueryFactory,
  QueryName,
  QueryRegistry,
} from './extension.js'
import { resolveExtensions } from './extension-manager.js'
import { withKeptSpaces } from './whitespace.js'

export interface JSONMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface JSONContent {
  type: string
  attrs?: Record<string, unknown>
  content?: JSONContent[]
  marks?: JSONMark[]
  text?: string
}

export type EditorContent = string | JSONContent

export interface EditorSelection {
  from: number
  to: number
  empty: boolean
}

export interface EditorRect {
  top: number
  bottom: number
  left: number
  right: number
}

export interface EditorOptions {
  extensions?: readonly Extension[]
  content?: EditorContent
  editable?: boolean
  label?: string
}

export interface EditorEventMap {
  change: { editor: Editor }
  update: { editor: Editor }
  focus: { editor: Editor; event: FocusEvent }
  blur: { editor: Editor; event: FocusEvent }
  destroy: { editor: Editor }
  error: { editor: Editor; error: unknown }
}

export type EditorCommands = {
  [Name in CommandName]: (...args: Parameters<CommandRegistry[Name]>) => boolean
}

export type EditorQueries = {
  [Name in QueryName]: (...args: Parameters<QueryRegistry[Name]>) => ReturnType<QueryRegistry[Name]>
}

export class Editor {
  readonly schema: Schema
  readonly commands: EditorCommands
  readonly can: EditorCommands
  readonly query: EditorQueries
  private readonly view: EditorView
  private readonly commandFactories: Map<string, CommandFactory>
  private readonly queryFactories: Map<string, QueryFactory>
  private readonly events: Emitter<EditorEventMap> = new Emitter((error, name) =>
    this.reportListenerError(error, name),
  )
  private lastDoc: ProseMirrorNode
  private destroyed = false
  private editable: boolean

  static async create(element: HTMLElement, options: EditorOptions = {}): Promise<Editor> {
    return new Editor(element, options)
  }

  private constructor(element: HTMLElement, options: EditorOptions) {
    const resolved = resolveExtensions(options.extensions ?? [])
    this.schema = resolved.schema
    this.commandFactories = resolved.commands
    this.queryFactories = resolved.queries
    const state = EditorState.create({
      doc: parseContent(this.schema, options.content),
      plugins: resolved.plugins,
    })
    this.lastDoc = state.doc
    this.editable = options.editable ?? true
    this.view = new EditorView(element, {
      state,
      editable: () => this.editable,
      attributes: {
        class: 'vive-content',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': options.label ?? 'Rich text editor',
      },
      dispatchTransaction: (transaction) => this.dispatch(transaction),
      handleDOMEvents: {
        focus: (_view, event) => {
          this.events.emit('focus', { editor: this, event })
          return false
        },
        blur: (_view, event) => {
          this.events.emit('blur', { editor: this, event })
          return false
        },
      },
    })
    this.commands = this.createCommandProxy(true)
    this.can = this.createCommandProxy(false)
    this.query = this.createQueryProxy()
  }

  get isDestroyed(): boolean {
    return this.destroyed
  }

  get isEditable(): boolean {
    return !this.destroyed && this.view.editable
  }

  get isEmpty(): boolean {
    const doc = this.currentDoc()
    return (
      doc.childCount === 1 &&
      doc.firstChild?.isTextblock === true &&
      doc.firstChild.content.size === 0
    )
  }

  get dom(): HTMLElement {
    return this.view.dom
  }

  getText(): string {
    const doc = this.currentDoc()
    return doc.textBetween(0, doc.content.size, '\n', ' ')
  }

  getSelection(): EditorSelection {
    if (this.destroyed) return { from: 0, to: 0, empty: true }
    const { from, to, empty } = this.view.state.selection
    return { from, to, empty }
  }

  getSelectionRect(): EditorRect | null {
    if (this.destroyed) return null
    const { from, to } = this.view.state.selection
    try {
      const start = this.view.coordsAtPos(from)
      const end = this.view.coordsAtPos(to, -1)
      return {
        top: Math.min(start.top, end.top),
        bottom: Math.max(start.bottom, end.bottom),
        left: Math.min(start.left, end.left),
        right: Math.max(start.right, end.right),
      }
    } catch {
      return null
    }
  }

  getTextBeforeCursor(): string {
    if (this.destroyed) return ''
    const { $from, empty } = this.view.state.selection
    if (!empty || !$from.parent.isTextblock) return ''
    return $from.parent.textBetween(0, $from.parentOffset, undefined, ' ')
  }

  getAttributes(name: string): Record<string, unknown> {
    if (this.destroyed) return {}
    const { state } = this.view
    const { from, to, empty, $from } = state.selection
    const markType = this.schema.marks[name]
    if (markType) {
      const candidates: Mark[] = [...(state.storedMarks ?? $from.marks())]
      if (empty) {
        candidates.push(...($from.nodeAfter?.marks ?? []), ...($from.nodeBefore?.marks ?? []))
      } else {
        state.doc.nodesBetween(from, to, (node) => {
          candidates.push(...node.marks)
        })
      }
      const mark = candidates.find((candidate) => candidate.type === markType)
      return mark ? { ...mark.attrs } : {}
    }
    for (let depth = $from.depth; depth >= 0; depth--) {
      const node = $from.node(depth)
      if (node.type.name === name) return { ...node.attrs }
    }
    return {}
  }

  getJSON(): JSONContent {
    return this.currentDoc().toJSON() as JSONContent
  }

  isActive(name: string, attrs: Record<string, unknown> = {}): boolean {
    if (this.destroyed) return false
    const { state } = this.view
    const { from, to, empty, $from } = state.selection
    const markType = this.schema.marks[name]
    if (markType) {
      if (empty) return markType.isInSet(state.storedMarks ?? $from.marks()) !== undefined
      return state.doc.rangeHasMark(from, to, markType)
    }
    const nodeType = this.schema.nodes[name]
    if (!nodeType) return false
    const matches = (node: ProseMirrorNode): boolean =>
      node.type === nodeType &&
      Object.entries(attrs).every(([key, value]) => node.attrs[key] === value)
    for (let depth = $from.depth; depth >= 0; depth--) {
      if (matches($from.node(depth))) return true
    }
    let found = false
    state.doc.nodesBetween(from, to, (node) => {
      if (matches(node)) found = true
      return !found
    })
    return found
  }

  getHTML(): string {
    const container = document.createElement('div')
    container.append(
      DOMSerializer.fromSchema(this.schema).serializeFragment(
        withKeptSpaces(this.currentDoc()).content,
      ),
    )
    return container.innerHTML
  }

  setContent(content: EditorContent): void {
    this.assertAlive()
    const doc = parseContent(this.schema, content)
    const { state } = this.view
    const transaction = state.tr
      .replaceWith(0, state.doc.content.size, doc.content)
      .setMeta('addToHistory', false)
    this.view.dispatch(transaction)
  }

  setEditable(editable: boolean): void {
    this.assertAlive()
    this.editable = editable
    this.view.setProps({})
  }

  focus(): void {
    this.assertAlive()
    this.view.focus()
  }

  on<Name extends keyof EditorEventMap>(
    name: Name,
    listener: (payload: EditorEventMap[Name]) => void,
  ): () => void {
    return this.events.on(name, listener)
  }

  off<Name extends keyof EditorEventMap>(
    name: Name,
    listener: (payload: EditorEventMap[Name]) => void,
  ): void {
    this.events.off(name, listener)
  }

  destroy(): void {
    if (this.destroyed) return
    this.lastDoc = this.view.state.doc
    this.view.destroy()
    this.destroyed = true
    this.events.emit('destroy', { editor: this })
    this.events.clear()
  }

  private currentDoc(): ProseMirrorNode {
    return this.destroyed ? this.lastDoc : this.view.state.doc
  }

  private reportListenerError(error: unknown, name: keyof EditorEventMap): void {
    if (name !== 'error' && this.events.has('error')) {
      this.events.emit('error', { editor: this, error })
      return
    }
    console.error(error)
  }

  private createCommandProxy(execute: boolean): EditorCommands {
    return new Proxy({} as EditorCommands, {
      get: (_target, name) => {
        if (typeof name !== 'string') return undefined
        return (...args: never[]) => {
          const factory = this.commandFactories.get(name)
          if (!factory) {
            throw new ViveEditorError(
              'UNKNOWN_COMMAND',
              `Command "${name}" is not registered. Add the extension that provides it.`,
            )
          }
          return this.run(factory(...args), execute)
        }
      },
      has: (_target, name) => typeof name === 'string' && this.commandFactories.has(name),
    })
  }

  private createQueryProxy(): EditorQueries {
    return new Proxy({} as EditorQueries, {
      get: (_target, name) => {
        if (typeof name !== 'string') return undefined
        return (...args: never[]) => {
          const factory = this.queryFactories.get(name)
          if (!factory) {
            throw new ViveEditorError(
              'UNKNOWN_QUERY',
              `Query "${name}" is not registered. Add the extension that provides it.`,
            )
          }
          this.assertAlive()
          return factory(this.view.state, ...args)
        }
      },
      has: (_target, name) => typeof name === 'string' && this.queryFactories.has(name),
    })
  }

  private run(command: Command, execute: boolean): boolean {
    this.assertAlive()
    if (!execute) return command(this.view.state, undefined, this.view)
    return command(this.view.state, this.view.dispatch, this.view)
  }

  private dispatch(transaction: Transaction): void {
    const state = this.view.state.apply(transaction)
    this.view.updateState(state)
    if (transaction.docChanged) {
      this.events.emit('change', { editor: this })
    }
    this.events.emit('update', { editor: this })
  }

  private assertAlive(): void {
    if (this.destroyed) {
      throw new ViveEditorError('DESTROYED', 'The editor has been destroyed.')
    }
  }
}
