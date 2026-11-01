import { baseKeymap } from 'prosemirror-commands'
import { type InputRule, inputRules } from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import {
  type DOMOutputSpec,
  type MarkSpec,
  type NodeSpec,
  type ParseRule,
  Schema,
  type AttributeSpec as SchemaAttributeSpec,
  type TagParseRule,
} from 'prosemirror-model'
import type { Plugin } from 'prosemirror-state'
import { Base } from './base.js'
import { ViveEditorError } from './errors.js'
import type {
  AttributeSpec,
  CommandFactory,
  Extension,
  GlobalAttributes,
  QueryFactory,
} from './extension.js'

export interface ResolvedExtensions {
  schema: Schema
  plugins: Plugin[]
  commands: Map<string, CommandFactory>
  queries: Map<string, QueryFactory>
}

type Attributes = Record<string, AttributeSpec>
type SchemaSpec = NodeSpec | MarkSpec
type HtmlAttributes = Record<string, string>

const isAttributeObject = (value: unknown): value is HtmlAttributes =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !('nodeType' in value) &&
  !('dom' in value)

function mergeHtmlAttributes(target: HtmlAttributes, extra: HtmlAttributes): HtmlAttributes {
  const merged = { ...target }
  for (const [name, value] of Object.entries(extra)) {
    const existing = merged[name]
    if (existing && name === 'style') merged[name] = `${existing.replace(/;\s*$/, '')}; ${value}`
    else if (existing && name === 'class') merged[name] = `${existing} ${value}`
    else merged[name] = value
  }
  return merged
}

function withHtmlAttributes(output: DOMOutputSpec, extra: HtmlAttributes): DOMOutputSpec {
  if (Array.isArray(output)) {
    const [tag, second, ...rest] = output as unknown[]
    if (isAttributeObject(second)) {
      return [tag, mergeHtmlAttributes(second, extra), ...rest] as unknown as DOMOutputSpec
    }
    return [
      tag,
      extra,
      ...(second === undefined ? [] : [second]),
      ...rest,
    ] as unknown as DOMOutputSpec
  }
  const element =
    typeof output === 'object' && output !== null && 'dom' in output ? output.dom : output
  if (element instanceof HTMLElement) {
    const current: HtmlAttributes = {}
    for (const name of Object.keys(extra)) {
      const value = element.getAttribute(name)
      if (value !== null) current[name] = value
    }
    for (const [name, value] of Object.entries(mergeHtmlAttributes(current, extra))) {
      element.setAttribute(name, value)
    }
  }
  return output
}

function renderAttributes(
  values: Record<string, unknown>,
  attributes: Attributes,
): HtmlAttributes | null {
  let result: HtmlAttributes | null = null
  for (const [name, spec] of Object.entries(attributes)) {
    const rendered = spec.render(values[name])
    if (rendered) result = mergeHtmlAttributes(result ?? {}, rendered)
  }
  return result
}

function parseRuleWith(rule: ParseRule, attributes: Attributes): ParseRule {
  if ('style' in rule) return rule
  const tagRule = rule as TagParseRule
  const original = tagRule.getAttrs
  const fixed = tagRule.attrs
  return {
    ...tagRule,
    getAttrs: (element: HTMLElement) => {
      const base = original ? original(element) : (fixed ?? null)
      if (base === false) return false
      const parsed: Record<string, unknown> = { ...(base ?? {}) }
      for (const [name, spec] of Object.entries(attributes)) {
        parsed[name] = spec.parse(element)
      }
      return parsed
    },
  }
}

function extendSpec<Spec extends SchemaSpec>(
  spec: Spec,
  attributes: Attributes,
  type: string,
  owner: string,
): Spec {
  const attrs: Record<string, SchemaAttributeSpec> = { ...spec.attrs }
  for (const [name, attribute] of Object.entries(attributes)) {
    if (name in attrs) {
      throw new ViveEditorError(
        'SCHEMA_CONFLICT',
        `Extension "${owner}" redefines attribute "${name}" of "${type}".`,
      )
    }
    attrs[name] = { default: attribute.default }
  }
  const toDOM = spec.toDOM as ((...args: unknown[]) => DOMOutputSpec) | undefined
  return {
    ...spec,
    attrs,
    ...(spec.parseDOM
      ? { parseDOM: spec.parseDOM.map((rule) => parseRuleWith(rule, attributes)) }
      : {}),
    ...(toDOM
      ? {
          toDOM: (item: { attrs: Record<string, unknown> }, ...rest: unknown[]) => {
            const output = toDOM(item, ...rest)
            const extra = renderAttributes(item.attrs, attributes)
            return extra ? withHtmlAttributes(output, extra) : output
          },
        }
      : {}),
  }
}

function applyGlobalAttributes(
  nodes: Record<string, NodeSpec>,
  marks: Record<string, MarkSpec>,
  groups: readonly GlobalAttributes[],
  owner: string,
): void {
  for (const group of groups) {
    for (const type of group.types) {
      const node = nodes[type]
      const mark = marks[type]
      if (node) nodes[type] = extendSpec(node, group.attributes, type, owner)
      else if (mark) marks[type] = extendSpec(mark, group.attributes, type, owner)
    }
  }
}

function mergeSpecs<Spec>(
  target: Record<string, Spec>,
  source: Record<string, Spec> | undefined,
  owner: string,
): void {
  if (!source) return
  for (const [name, spec] of Object.entries(source)) {
    if (name in target) {
      throw new ViveEditorError(
        'SCHEMA_CONFLICT',
        `Extension "${owner}" redefines schema item "${name}".`,
      )
    }
    target[name] = spec
  }
}

function buildSchema(nodes: Record<string, NodeSpec>, marks: Record<string, MarkSpec>): Schema {
  try {
    return new Schema({ nodes, marks })
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause)
    throw new ViveEditorError(
      'INVALID_SCHEMA',
      `The registered extensions do not form a valid schema: ${reason}. A required extension is probably missing.`,
      { cause },
    )
  }
}

export function resolveExtensions(extensions: readonly Extension[]): ResolvedExtensions {
  const all: Extension[] = [Base as Extension, ...extensions]
  const names = new Set<string>()
  for (const extension of all) {
    if (names.has(extension.name)) {
      throw new ViveEditorError(
        'DUPLICATE_EXTENSION',
        `Extension "${extension.name}" is registered twice.`,
      )
    }
    names.add(extension.name)
  }

  const nodes: Record<string, NodeSpec> = {}
  const marks: Record<string, MarkSpec> = {}
  for (const extension of all) {
    mergeSpecs(nodes, extension.config.nodes?.(extension.options), extension.name)
    mergeSpecs(marks, extension.config.marks?.(extension.options), extension.name)
  }
  for (const extension of all) {
    const groups = extension.config.attributes?.(extension.options)
    if (groups) applyGlobalAttributes(nodes, marks, groups, extension.name)
  }
  const schema = buildSchema(nodes, marks)

  const ordered = [...all].sort((a, b) => b.priority - a.priority)
  const commands = new Map<string, CommandFactory>()
  const queries = new Map<string, QueryFactory>()
  const rules: InputRule[] = []
  const keymaps: Plugin[] = []
  const extraPlugins: Plugin[] = []

  for (const extension of ordered) {
    const context = { schema, options: extension.options }
    const { config } = extension
    for (const [name, factory] of Object.entries(config.commands?.(context) ?? {})) {
      if (commands.has(name)) {
        throw new ViveEditorError(
          'DUPLICATE_COMMAND',
          `Command "${name}" from "${extension.name}" is already registered.`,
        )
      }
      commands.set(name, factory as CommandFactory)
    }
    for (const [name, factory] of Object.entries(config.queries?.(context) ?? {})) {
      if (queries.has(name)) {
        throw new ViveEditorError(
          'DUPLICATE_QUERY',
          `Query "${name}" from "${extension.name}" is already registered.`,
        )
      }
      queries.set(name, factory as QueryFactory)
    }
    const bindings = config.keymap?.(context)
    if (bindings) keymaps.push(keymap(bindings))
    rules.push(...(config.inputRules?.(context) ?? []))
    extraPlugins.push(...(config.plugins?.(context) ?? []))
  }

  const plugins = [
    ...(rules.length > 0 ? [inputRules({ rules })] : []),
    ...keymaps,
    keymap(baseKeymap),
    ...extraPlugins,
  ]

  return { schema, plugins, commands, queries }
}
