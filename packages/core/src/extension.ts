import type { InputRule } from 'prosemirror-inputrules'
import type { MarkSpec, NodeSpec, Schema } from 'prosemirror-model'
import type { Command, EditorState, Plugin } from 'prosemirror-state'
import type { EditorContent } from './editor.js'

export interface CommandRegistry {
  selectAll: () => Command
  undo: () => Command
  redo: () => Command
  setParagraph: () => Command
  deleteRange: (from: number, to: number) => Command
  replaceContent: (content: EditorContent) => Command
  insertContent: (content: EditorContent) => Command
  insertText: (text: string) => Command
  setTextSelection: (from: number, to?: number) => Command
}

export type CommandName = keyof CommandRegistry

export type CommandFactory = (...args: never[]) => Command

export type CommandFactories = { [Name in CommandName]?: CommandRegistry[Name] }

export interface QueryRegistry {
  selectedText: () => string
  textBetween: (from: number, to: number) => string
}

export type QueryName = keyof QueryRegistry

export type QueryFactory = (state: EditorState, ...args: never[]) => unknown

export type QueryFactories = {
  [Name in QueryName]?: (
    state: EditorState,
    ...args: Parameters<QueryRegistry[Name]>
  ) => ReturnType<QueryRegistry[Name]>
}

export interface AttributeSpec {
  default: unknown
  parse(element: HTMLElement): unknown
  render(value: unknown): Record<string, string> | null
}

export interface GlobalAttributes {
  types: readonly string[]
  attributes: Record<string, AttributeSpec>
}

export interface ExtensionContext<Options> {
  schema: Schema
  options: Options
}

export interface ExtensionConfig<Options> {
  name: string
  priority?: number
  defaultOptions: Options
  nodes?(options: Options): Record<string, NodeSpec>
  marks?(options: Options): Record<string, MarkSpec>
  attributes?(options: Options): GlobalAttributes[]
  commands?(context: ExtensionContext<Options>): CommandFactories
  queries?(context: ExtensionContext<Options>): QueryFactories
  keymap?(context: ExtensionContext<Options>): Record<string, Command>
  inputRules?(context: ExtensionContext<Options>): InputRule[]
  plugins?(context: ExtensionContext<Options>): Plugin[]
}

export interface Extension<Options = unknown> {
  readonly name: string
  readonly priority: number
  readonly options: Options
  readonly config: ExtensionConfig<Options>
  configure(options: Partial<Options>): Extension<Options>
}

export const DEFAULT_PRIORITY = 100

function createExtension<Options>(
  config: ExtensionConfig<Options>,
  options: Options,
): Extension<Options> {
  return Object.freeze({
    name: config.name,
    priority: config.priority ?? DEFAULT_PRIORITY,
    options,
    config,
    configure: (overrides: Partial<Options>) =>
      createExtension(config, { ...options, ...overrides }),
  })
}

export function defineExtension<Options = Record<string, never>>(
  config: ExtensionConfig<Options>,
): Extension<Options> {
  return createExtension(config, config.defaultOptions)
}
