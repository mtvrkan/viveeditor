import {
  type DefaultTreeAdapterMap,
  html,
  Parser,
  serialize,
  defaultTreeAdapter as tree,
} from 'parse5'
import { cleanEmbed, embedWatchUrl, iframeAttributes, wrapperAttributes } from './embed.js'
import { guardedTreeAdapter, hasCrowdedTag } from './guard.js'
import { VIVE_PROFILE } from './profile.js'
import {
  byteLength,
  cleanColWidth,
  cleanHref,
  cleanImageSrc,
  cleanInteger,
  cleanLanguage,
  cleanLatex,
  cleanMentionLabel,
  cleanStyle,
  cleanText,
  type ImagePolicy,
  isMentionId,
  takeCodePoints,
} from './values.js'

type Element = DefaultTreeAdapterMap['element']
type ParentNode = DefaultTreeAdapterMap['parentNode']

export interface SanitizeOptions {
  embeds?: boolean
  allowBase64?: boolean
  allowRelativeImages?: boolean
  maxBytes?: number
}

export type SanitizeErrorCode = 'TOO_LARGE' | 'TOO_COMPLEX'

export class SanitizeError extends Error {
  readonly code: SanitizeErrorCode

  constructor(code: SanitizeErrorCode, message: string) {
    super(message)
    this.name = 'SanitizeError'
    this.code = code
  }
}

interface Context {
  parent: string
  taskList: boolean
  taskItem: boolean
  inLink: boolean
  footnote: { left: number } | null
}

interface Settings {
  embeds: boolean
  image: ImagePolicy
}

const { limits } = VIVE_PROFILE
const DROP = new Set(VIVE_PROFILE.dropWithContent)
const FOOTNOTE_ELEMENTS = new Set(VIVE_PROFILE.footnoteElements)
const ROOT: Context = {
  parent: '',
  taskList: false,
  taskItem: false,
  inLink: false,
  footnote: null,
}
const BODY = tree.createElement('body', html.NS.HTML, [])

function attributesOf(element: Element): Map<string, string> {
  const result = new Map<string, string>()
  for (const attribute of element.attrs) {
    const max =
      element.tagName === 'img' && attribute.name === 'src'
        ? limits.maxImageSrcLength
        : limits.maxAttributeLength
    if (attribute.namespace || byteLength(attribute.value) > max) continue
    if (!result.has(attribute.name)) result.set(attribute.name, attribute.value)
  }
  return result
}

function append(target: ParentNode, tag: string, attributes: [string, string][]): Element {
  const element = tree.createElement(
    tag,
    html.NS.HTML,
    attributes.map(([name, value]) => ({ name, value })),
  )
  tree.appendChild(target, element)
  return element
}

function styleOf(tag: string, source: Map<string, string>): [string, string][] {
  const allowed = VIVE_PROFILE.elements[tag]?.styles
  const style = source.get('style')
  if (!allowed || style === undefined) return []
  const clean = cleanStyle(style, allowed)
  return clean === null ? [] : [['style', clean]]
}

function textAttribute(source: Map<string, string>, name: string): [string, string][] {
  const value = source.get(name)
  return value === undefined ? [] : [[name, cleanText(value)]]
}

function linkAttributes(source: Map<string, string>): [string, string][] {
  const result: [string, string][] = [['rel', VIVE_PROFILE.linkRel]]
  const href = source.get('href')
  const clean = href === undefined ? null : cleanHref(href)
  if (clean !== null) result.push(['href', clean])
  result.push(...textAttribute(source, 'title'))
  if (source.get('target') === '_blank') result.push(['target', '_blank'])
  return result
}

function imageAttributes(
  source: Map<string, string>,
  policy: ImagePolicy,
): [string, string][] | null {
  const raw = source.get('src')
  const src = raw === undefined ? null : cleanImageSrc(raw, policy)
  if (src === null) return null
  const result: [string, string][] = [['src', src]]
  result.push(...textAttribute(source, 'alt'), ...textAttribute(source, 'title'))
  for (const name of ['width', 'height']) {
    const size = cleanInteger(source.get(name), 1, limits.maxImageSize)
    if (size !== null) result.push([name, String(size)])
  }
  const { loading, decoding, referrerpolicy } = VIVE_PROFILE.image
  result.push(['loading', loading], ['decoding', decoding], ['referrerpolicy', referrerpolicy])
  return result
}

function cellAttributes(source: Map<string, string>): [string, string][] {
  const result: [string, string][] = []
  for (const name of ['colspan', 'rowspan']) {
    const span = cleanInteger(source.get(name), 2, limits.maxSpan)
    if (span !== null) result.push([name, String(span)])
  }
  const widths = cleanColWidth(source.get('data-colwidth'))
  if (widths !== null) result.push(['data-colwidth', widths])
  return result
}

function embed(source: Map<string, string>, node: Element, target: ParentNode): void {
  const data = cleanEmbed(source)
  if (!data) return
  const wrapper = append(target, 'div', wrapperAttributes(data))
  const facade = node.childNodes.some((child) => tree.isElementNode(child) && child.tagName === 'a')
  if (facade) {
    const link = append(wrapper, 'a', [
      ['href', embedWatchUrl(data)],
      ['rel', 'noopener noreferrer'],
    ])
    tree.insertText(link, data.title ?? data.rule.label)
  } else {
    append(wrapper, 'iframe', iframeAttributes(data))
  }
}

function insertText(target: ParentNode, value: string, context: Context): void {
  const text = context.footnote ? takeCodePoints(value, context.footnote) : value
  if (text) tree.insertText(target, text)
}

function textOf(node: ParentNode, depth: number): string {
  let text = ''
  for (const child of node.childNodes) {
    if (tree.isTextNode(child)) text += child.value
    else if (
      tree.isElementNode(child) &&
      depth < limits.maxDepth &&
      child.namespaceURI === html.NS.HTML &&
      !DROP.has(child.tagName)
    ) {
      text += textOf(child, depth + 1)
    }
  }
  return text
}

function mention(
  id: string,
  node: Element,
  target: ParentNode,
  depth: number,
  context: Context,
): void {
  const text = textOf(node, depth)
  if (context.inLink || context.footnote || !isMentionId(id)) {
    insertText(target, text, context)
    return
  }
  const created = append(target, 'span', [
    ['class', VIVE_PROFILE.mentionClass],
    ['data-mention', id],
  ])
  tree.insertText(created, `@${cleanMentionLabel(text) || id}`)
}

function math(
  tag: 'span' | 'div',
  node: Element,
  target: ParentNode,
  depth: number,
  context: Context,
): void {
  const text = textOf(node, depth)
  const latex = context.inLink || context.footnote ? null : cleanLatex(text)
  if (latex === null) {
    insertText(target, text, context)
    return
  }
  const created = append(target, tag, [['data-math', tag === 'span' ? 'inline' : 'block']])
  tree.insertText(created, latex)
}

function footnote(
  node: Element,
  target: ParentNode,
  depth: number,
  context: Context,
  settings: Settings,
): void {
  if (context.inLink || context.footnote) {
    walk(node, target, depth, context, settings)
    return
  }
  const created = append(target, 'sup', [['data-footnote', '']])
  const inner: Context = {
    ...ROOT,
    parent: 'sup',
    footnote: { left: limits.maxFootnoteLength },
  }
  walk(node, created, depth, inner, settings)
}

function walk(
  source: ParentNode,
  target: ParentNode,
  depth: number,
  context: Context,
  settings: Settings,
): void {
  for (const child of source.childNodes) {
    if (tree.isTextNode(child)) insertText(target, child.value, context)
    else if (tree.isElementNode(child)) element(child, target, depth + 1, context, settings)
  }
}

function element(
  node: Element,
  target: ParentNode,
  depth: number,
  context: Context,
  settings: Settings,
): void {
  if (depth > limits.maxDepth || node.namespaceURI !== html.NS.HTML) return
  const tag = node.tagName
  if (DROP.has(tag)) return
  const source = attributesOf(node)
  if (context.footnote && !FOOTNOTE_ELEMENTS.has(tag)) {
    walk(node, target, depth, context, settings)
    return
  }
  const mentionId = source.get('data-mention')
  if (
    tag === 'span' &&
    mentionId !== undefined &&
    source.get('class') === VIVE_PROFILE.mentionClass
  ) {
    mention(mentionId, node, target, depth, context)
    return
  }
  const mathType = source.get('data-math')
  if ((tag === 'span' && mathType === 'inline') || (tag === 'div' && mathType === 'block')) {
    math(tag, node, target, depth, context)
    return
  }
  if (tag === 'sup' && source.has('data-footnote')) {
    footnote(node, target, depth, context, settings)
    return
  }
  const next: Context = {
    parent: tag,
    taskList: false,
    taskItem: false,
    inLink: context.inLink || tag === 'a',
    footnote: context.footnote,
  }
  let attributes: [string, string][] | null = null

  switch (tag) {
    case 'div':
      if (source.get('class') === 'vive-embed' && source.has('data-embed')) {
        if (settings.embeds) embed(source, node, target)
        return
      }
      if (source.has('data-embed-invalid')) return
      attributes = context.taskItem ? [] : null
      break
    case 'input':
      if (!context.taskItem || source.get('type') !== 'checkbox') return
      append(target, 'input', [
        ['type', 'checkbox'],
        ['disabled', ''],
        ...(source.has('checked') ? ([['checked', '']] as [string, string][]) : []),
      ])
      return
    case 'ul':
      next.taskList = source.get('data-type') === 'taskList'
      attributes = next.taskList ? [['data-type', 'taskList']] : []
      break
    case 'li':
      next.taskItem = context.taskList && source.get('data-type') === 'taskItem'
      attributes = next.taskItem
        ? [
            ['data-type', 'taskItem'],
            ['data-checked', source.get('data-checked') === 'true' ? 'true' : 'false'],
          ]
        : []
      break
    case 'ol': {
      const start = cleanInteger(source.get('start'), 0, limits.maxListStart)
      attributes = start !== null && start !== 1 ? [['start', String(start)]] : []
      break
    }
    case 'pre': {
      const language = cleanLanguage(source.get('data-language'))
      attributes = language ? [['data-language', language]] : []
      break
    }
    case 'code': {
      const match = /^language-(.+)$/.exec(source.get('class') ?? '')
      const language = context.parent === 'pre' ? cleanLanguage(match?.[1]) : null
      attributes = language ? [['class', `language-${language}`]] : []
      break
    }
    case 'a':
      attributes = context.inLink ? null : linkAttributes(source)
      break
    case 'sup':
      attributes = null
      break
    case 'img': {
      const image = imageAttributes(source, settings.image)
      if (image) append(target, 'img', image)
      return
    }
    case 'td':
    case 'th':
      attributes = cellAttributes(source)
      break
    default:
      attributes = Object.hasOwn(VIVE_PROFILE.elements, tag) ? styleOf(tag, source) : null
  }

  if (attributes === null) {
    walk(node, target, depth, context, settings)
    return
  }
  const created = append(target, tag, attributes)
  walk(node, created, depth, next, settings)
}

const MAX_ROUNDS = 3

function scrub(input: string): string {
  return input.toWellFormed().replaceAll('\0', '')
}

function tooComplex(): never {
  throw new SanitizeError(
    'TOO_COMPLEX',
    'HTML has too many attributes, elements or nesting levels.',
  )
}

function tagCount(input: string): number {
  let count = 0
  for (let index = input.indexOf('<'); index !== -1; index = input.indexOf('<', index + 1)) count++
  return count
}

function cleanOnce(input: string, settings: Settings): string {
  if (hasCrowdedTag(input, limits.maxAttributes)) tooComplex()
  const treeAdapter = guardedTreeAdapter(
    tagCount(input) + limits.maxExtraElements,
    limits.maxNesting,
    tooComplex,
  )
  const parser = Parser.getFragmentParser(BODY, { scriptingEnabled: false, treeAdapter })
  parser.tokenizer.write(input, true)
  const root = treeAdapter.getFirstChild(parser.document)
  const output = tree.createDocumentFragment()
  if (root && tree.isElementNode(root)) walk(root, output, 0, ROOT, settings)
  return serialize(output)
}

export function sanitizeHtml(input: string, options: SanitizeOptions = {}): string {
  if (typeof input !== 'string') return ''
  const maxBytes = options.maxBytes ?? limits.maxBytes
  if (byteLength(input) > maxBytes) {
    throw new SanitizeError('TOO_LARGE', `HTML is larger than ${maxBytes} bytes.`)
  }
  const settings: Settings = {
    embeds: options.embeds === true,
    image: {
      allowBase64: options.allowBase64 === true,
      allowRelative: options.allowRelativeImages === true,
    },
  }
  let clean = cleanOnce(scrub(input), settings)
  for (let round = 1; round < MAX_ROUNDS; round++) {
    const again = cleanOnce(clean, settings)
    if (again === clean) break
    clean = again
  }
  return clean
}
