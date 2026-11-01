import { isAllowedUrl } from '@viveeditor/core'
import { normalizeColor } from '@viveeditor/ext-format'
import {
  DEFAULT_SOURCE_POLICY,
  type ImageSourcePolicy,
  type ImageUploader,
  imageSize,
  normalizeImageSrc,
  sniffImageType,
} from '@viveeditor/ext-image'
import { DocxError, throwIfAborted } from './errors.js'
import { child, children, descendant, is, NS, onOff, parseXml, wAttr } from './xml.js'
import { readZip } from './zip.js'

export interface ImportLimits {
  fileBytes: number
  totalBytes: number
  documentBytes: number
  partBytes: number
  imageBytes: number
  images: number
  imagePixels: number
  elements: number
  cells: number
}

export interface ImportOptions {
  upload?: ImageUploader | null
  allowBase64?: boolean
  imagePolicy?: Partial<ImageSourcePolicy>
  signal?: AbortSignal
  limits?: Partial<ImportLimits>
}

export type ImportWarningCode =
  | 'HIDDEN_TEXT'
  | 'IMAGE_DROPPED'
  | 'LINK_DROPPED'
  | 'OBJECT_DROPPED'
  | 'NESTING_FLATTENED'

export interface ImportWarning {
  code: ImportWarningCode
  count: number
}

export interface DocxImport {
  html: string
  warnings: ImportWarning[]
}

export const DEFAULT_IMPORT_LIMITS: Readonly<ImportLimits> = Object.freeze({
  fileBytes: 20 * 1024 * 1024,
  totalBytes: 100 * 1024 * 1024,
  documentBytes: 30 * 1024 * 1024,
  partBytes: 5 * 1024 * 1024,
  imageBytes: 10 * 1024 * 1024,
  images: 200,
  imagePixels: 50_000_000,
  elements: 100_000,
  cells: 10_000,
})

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const REL_OFFICE_DOCUMENT = `${REL}/officeDocument`
const REL_HYPERLINK = `${REL}/hyperlink`
const REL_IMAGE = `${REL}/image`
const MAX_DEPTH = 64
const MAX_TABLE_DEPTH = 3
const MAX_COLUMNS = 100
const MAX_DIMENSION = 10_000
const MAX_TEXT = 1000
const MAX_LINK = 2048
const EMU_PER_PIXEL = 9525
const isControl = (code: number): boolean =>
  (code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f
const isInvisible = (code: number): boolean =>
  code <= 0x20 ||
  (code >= 0x7f && code <= 0xa0) ||
  code === 0xad ||
  (code >= 0x200b && code <= 0x200f) ||
  (code >= 0x2028 && code <= 0x202e) ||
  (code >= 0x2060 && code <= 0x206f) ||
  code === 0xfeff

function without(value: string, drop: (code: number) => boolean): string {
  let result = ''
  for (const character of value) if (!drop(character.codePointAt(0) ?? 0)) result += character
  return result
}
const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])
const HIGHLIGHTS: Record<string, string> = {
  yellow: '#ffff00',
  green: '#00ff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  blue: '#0000ff',
  red: '#ff0000',
  darkBlue: '#000080',
  darkCyan: '#008080',
  darkGreen: '#008000',
  darkMagenta: '#800080',
  darkRed: '#800000',
  darkYellow: '#808000',
  darkGray: '#808080',
  lightGray: '#c0c0c0',
  black: '#000000',
}
const CODE_CHARACTER_STYLES = new Set(['code char', 'html code', 'verbatim char', 'source text'])
const ALIGNMENTS: Record<string, string> = {
  center: 'center',
  right: 'right',
  end: 'right',
  both: 'justify',
  distribute: 'justify',
}

interface Relationship {
  type: string
  target: string
  external: boolean
}

interface ParagraphStyle {
  heading: number | null
  quote: boolean
  code: boolean
  listParagraph: boolean
  numId: string | null
  ilvl: number
  basedOn: string | null
}

interface RunFormat {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  color: string | null
  highlight: string | null
  code: boolean
  hidden: boolean
}

interface ListLevel {
  ordered: boolean
  start: number
}

interface ImageJob {
  element: HTMLImageElement
  bytes: Uint8Array
}

interface OpenList {
  ilvl: number
  numId: string
  ordered: boolean
  element: HTMLElement
  lastItem: HTMLElement | null
}

function cleanLimits(input: Partial<ImportLimits> | undefined): ImportLimits {
  const limits = { ...DEFAULT_IMPORT_LIMITS }
  for (const key of Object.keys(limits) as (keyof ImportLimits)[]) {
    const value = input?.[key]
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) limits[key] = value
  }
  return limits
}

function clampInt(value: string | null, min: number, max: number, fallback: number): number {
  const number = Number.parseInt(value ?? '', 10)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

export function cleanText(value: string | null | undefined, max: number = MAX_TEXT): string {
  return without(value ?? '', isControl)
    .trim()
    .slice(0, max)
}

export function cleanLink(target: string): string | null {
  const value = without(target, isInvisible)
  if (value === '' || value.length > MAX_LINK) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (!LINK_PROTOCOLS.has(url.protocol)) return null
  return isAllowedUrl(url.href) ? url.href : null
}

function resolvePart(base: string, target: string): string | null {
  const segments = (target.startsWith('/') ? target.slice(1) : base + target).split('/')
  const resolved: string[] = []
  for (const segment of segments) {
    if (segment === '..') {
      if (resolved.length === 0) return null
      resolved.pop()
    } else if (segment !== '.' && segment !== '') resolved.push(segment)
  }
  return resolved.join('/')
}

function readRelationships(doc: Document | null): Map<string, Relationship> {
  const relationships = new Map<string, Relationship>()
  if (!doc) return relationships
  for (const element of children(doc.documentElement, NS.rel, 'Relationship')) {
    const id = element.getAttribute('Id')
    if (!id || relationships.has(id)) continue
    relationships.set(id, {
      type: element.getAttribute('Type') ?? '',
      target: element.getAttribute('Target') ?? '',
      external: element.getAttribute('TargetMode') === 'External',
    })
  }
  return relationships
}

function readStyles(doc: Document | null): {
  paragraphs: Map<string, ParagraphStyle>
  runs: Map<string, Partial<RunFormat>>
} {
  const paragraphs = new Map<string, ParagraphStyle>()
  const runs = new Map<string, Partial<RunFormat>>()
  if (!doc) return { paragraphs, runs }
  for (const style of children(doc.documentElement, NS.w, 'style')) {
    const id = wAttr(style, 'styleId')
    if (!id) continue
    const type = wAttr(style, 'type')
    const name = (wAttr(child(style, NS.w, 'name'), 'val') ?? '').toLowerCase()
    if (type === 'character') {
      runs.set(
        id,
        name === 'hyperlink'
          ? {}
          : CODE_CHARACTER_STYLES.has(name)
            ? { code: true }
            : readRunFormat(child(style, NS.w, 'rPr')),
      )
      continue
    }
    if (type !== 'paragraph') continue
    const pPr = child(style, NS.w, 'pPr')
    const numPr = child(pPr, NS.w, 'numPr')
    const outline = wAttr(child(pPr, NS.w, 'outlineLvl'), 'val')
    const headingMatch = /^heading ([1-9])$/.exec(name)
    const heading =
      name === 'title'
        ? 1
        : headingMatch
          ? Math.min(6, Number(headingMatch[1]))
          : outline !== null && /^[0-5]$/.test(outline)
            ? Number(outline) + 1
            : null
    paragraphs.set(id, {
      heading,
      quote: name === 'quote' || name === 'intense quote',
      code: name === 'html preformatted' || name === 'code' || name.includes('source code'),
      listParagraph: name === 'list paragraph',
      numId: wAttr(child(numPr, NS.w, 'numId'), 'val'),
      ilvl: clampInt(wAttr(child(numPr, NS.w, 'ilvl'), 'val'), 0, 8, 0),
      basedOn: wAttr(child(style, NS.w, 'basedOn'), 'val'),
    })
  }
  return { paragraphs, runs }
}

function resolveStyle(
  styles: Map<string, ParagraphStyle>,
  id: string | null,
): ParagraphStyle | null {
  let current = id ? styles.get(id) : undefined
  const result: ParagraphStyle | null = current ? { ...current } : null
  for (let step = 0; current?.basedOn && result && step < 10; step++) {
    current = styles.get(current.basedOn)
    if (!current) break
    result.heading ??= current.heading
    result.quote ||= current.quote
    result.code ||= current.code
    result.listParagraph ||= current.listParagraph
    if (result.numId === null) {
      result.numId = current.numId
      result.ilvl = current.ilvl
    }
  }
  return result
}

function readNumbering(doc: Document | null): (numId: string, ilvl: number) => ListLevel {
  const abstracts = new Map<string, Map<number, ListLevel>>()
  const instances = new Map<string, { abstractId: string; starts: Map<number, number> }>()
  if (doc) {
    for (const abstract of children(doc.documentElement, NS.w, 'abstractNum')) {
      const levels = new Map<number, ListLevel>()
      for (const level of children(abstract, NS.w, 'lvl')) {
        const format = wAttr(child(level, NS.w, 'numFmt'), 'val') ?? 'decimal'
        levels.set(clampInt(wAttr(level, 'ilvl'), 0, 8, 0), {
          ordered: format !== 'bullet' && format !== 'none',
          start: clampInt(wAttr(child(level, NS.w, 'start'), 'val'), 1, 9999, 1),
        })
      }
      const id = wAttr(abstract, 'abstractNumId')
      if (id !== null) abstracts.set(id, levels)
    }
    for (const num of children(doc.documentElement, NS.w, 'num')) {
      const id = wAttr(num, 'numId')
      const abstractId = wAttr(child(num, NS.w, 'abstractNumId'), 'val')
      if (id === null || abstractId === null) continue
      const starts = new Map<number, number>()
      for (const override of children(num, NS.w, 'lvlOverride')) {
        const start = wAttr(child(override, NS.w, 'startOverride'), 'val')
        if (start !== null) {
          starts.set(clampInt(wAttr(override, 'ilvl'), 0, 8, 0), clampInt(start, 1, 9999, 1))
        }
      }
      instances.set(id, { abstractId, starts })
    }
  }
  return (numId, ilvl) => {
    const instance = instances.get(numId)
    const level = instance ? abstracts.get(instance.abstractId)?.get(ilvl) : undefined
    return {
      ordered: level?.ordered ?? false,
      start: instance?.starts.get(ilvl) ?? level?.start ?? 1,
    }
  }
}

function readRunFormat(rPr: Element | null): Partial<RunFormat> {
  if (!rPr) return {}
  const format: Partial<RunFormat> = {}
  const flag = (name: string, key: 'bold' | 'italic' | 'strike'): void => {
    const element = child(rPr, NS.w, name)
    if (element) format[key] = onOff(element)
  }
  flag('b', 'bold')
  flag('i', 'italic')
  flag('strike', 'strike')
  if (child(rPr, NS.w, 'dstrike')) format.strike = onOff(child(rPr, NS.w, 'dstrike'))
  const underline = child(rPr, NS.w, 'u')
  if (underline) format.underline = (wAttr(underline, 'val') ?? 'single') !== 'none'
  const color = wAttr(child(rPr, NS.w, 'color'), 'val')
  if (color && /^[0-9A-Fa-f]{6}$/.test(color)) format.color = normalizeColor(`#${color}`)
  const highlight = wAttr(child(rPr, NS.w, 'highlight'), 'val')
  if (highlight && Object.hasOwn(HIGHLIGHTS, highlight)) {
    format.highlight = HIGHLIGHTS[highlight] ?? null
  }
  if (['vanish', 'specVanish', 'webHidden'].some((name) => child(rPr, NS.w, name))) {
    format.hidden = ['vanish', 'specVanish', 'webHidden'].some((name) =>
      onOff(child(rPr, NS.w, name)),
    )
  }
  const fill = wAttr(child(rPr, NS.w, 'shd'), 'fill')
  if (
    !format.highlight &&
    fill &&
    /^[0-9A-Fa-f]{6}$/.test(fill) &&
    fill.toLowerCase() !== 'ffffff'
  ) {
    format.highlight = normalizeColor(`#${fill}`)
  }
  return format
}

class Reader {
  readonly doc: Document = document.implementation.createHTMLDocument('')
  readonly images: ImageJob[] = []
  private readonly warnings = new Map<ImportWarningCode, number>()
  private elements = 0
  private cells = 0
  private fieldStack: ('instruction' | 'result')[] = []
  private instructions = 0

  constructor(
    private readonly limits: ImportLimits,
    private readonly relationships: Map<string, Relationship>,
    private readonly media: Map<string, Uint8Array>,
    private readonly paragraphStyles: Map<string, ParagraphStyle>,
    private readonly runStyles: Map<string, Partial<RunFormat>>,
    private readonly listLevel: (numId: string, ilvl: number) => ListLevel,
  ) {}

  warn(code: ImportWarningCode): void {
    this.warnings.set(code, (this.warnings.get(code) ?? 0) + 1)
  }

  warningList(): ImportWarning[] {
    return [...this.warnings].slice(0, 100).map(([code, count]) => ({ code, count }))
  }

  private visit(depth: number): boolean {
    this.elements += 1
    if (this.elements > this.limits.elements) {
      throw new DocxError('TOO_COMPLEX', 'The Word document has too many elements.')
    }
    return depth <= MAX_DEPTH
  }

  blocks(container: Element, target: BlockWriter, depth: number, tableDepth: number): void {
    for (const node of container.children) {
      if (!this.visit(depth)) return
      if (is(node, NS.w, 'p')) this.paragraph(node, target, depth + 1)
      else if (is(node, NS.w, 'tbl')) this.table(node, target, depth + 1, tableDepth + 1)
      else if (is(node, NS.w, 'sdt')) {
        const content = child(node, NS.w, 'sdtContent')
        if (content) this.blocks(content, target, depth + 1, tableDepth)
      } else if (is(node, NS.w, 'customXml') || is(node, NS.w, 'ins') || is(node, NS.w, 'moveTo')) {
        this.blocks(node, target, depth + 1, tableDepth)
      } else if (is(node, NS.mc, 'AlternateContent')) {
        const fallback = child(node, NS.mc, 'Fallback')
        if (fallback) this.blocks(fallback, target, depth + 1, tableDepth)
      } else if (is(node, NS.w, 'altChunk')) this.warn('OBJECT_DROPPED')
    }
  }

  private paragraph(paragraph: Element, target: BlockWriter, depth: number): void {
    const pPr = child(paragraph, NS.w, 'pPr')
    const style = resolveStyle(this.paragraphStyles, wAttr(child(pPr, NS.w, 'pStyle'), 'val'))
    const numPr = child(pPr, NS.w, 'numPr')
    const numId = numPr ? wAttr(child(numPr, NS.w, 'numId'), 'val') : (style?.numId ?? null)
    const ilvl = numPr
      ? clampInt(wAttr(child(numPr, NS.w, 'ilvl'), 'val'), 0, 8, 0)
      : (style?.ilvl ?? 0)
    const content = this.doc.createElement('span')
    this.inline(paragraph, content, {}, depth)

    if (style?.code) {
      target.code(content.textContent ?? '')
      return
    }
    const heading = style?.heading ?? null
    const block = this.doc.createElement(heading ? `h${heading}` : 'p')
    block.append(...content.childNodes)
    const jc = wAttr(child(pPr, NS.w, 'jc'), 'val') ?? ''
    const align = Object.hasOwn(ALIGNMENTS, jc) ? ALIGNMENTS[jc] : undefined
    if (align) block.style.setProperty('text-align', align)
    if (numId && numId !== '0' && !heading) {
      target.listItem(block, numId, ilvl, this.listLevel(numId, ilvl))
    } else if (style?.listParagraph && !heading && target.continueItem(block)) {
      return
    } else if (style?.quote) target.quote(block)
    else target.block(block)
  }

  private inline(
    container: Element,
    target: Element,
    inherited: Partial<RunFormat>,
    depth: number,
  ): void {
    for (const node of container.children) {
      if (!this.visit(depth)) return
      if (is(node, NS.w, 'r')) this.run(node, target, inherited, depth + 1)
      else if (is(node, NS.w, 'hyperlink')) this.hyperlink(node, target, inherited, depth + 1)
      else if (
        is(node, NS.w, 'ins') ||
        is(node, NS.w, 'moveTo') ||
        is(node, NS.w, 'smartTag') ||
        is(node, NS.w, 'customXml') ||
        is(node, NS.w, 'fldSimple')
      ) {
        this.inline(node, target, inherited, depth + 1)
      } else if (is(node, NS.w, 'sdt')) {
        const content = child(node, NS.w, 'sdtContent')
        if (content) this.inline(content, target, inherited, depth + 1)
      } else if (is(node, NS.mc, 'AlternateContent')) {
        const fallback = child(node, NS.mc, 'Fallback')
        if (fallback) this.inline(fallback, target, inherited, depth + 1)
      } else if (
        node.namespaceURI === 'http://schemas.openxmlformats.org/officeDocument/2006/math'
      ) {
        this.warn('OBJECT_DROPPED')
      }
    }
  }

  private hyperlink(
    link: Element,
    target: Element,
    inherited: Partial<RunFormat>,
    depth: number,
  ): void {
    const id = link.getAttributeNS(NS.r, 'id')
    const relationship = id ? this.relationships.get(id) : undefined
    const href =
      relationship?.type === REL_HYPERLINK && relationship.external
        ? cleanLink(relationship.target)
        : null
    if (id && !href) this.warn('LINK_DROPPED')
    if (!href) {
      this.inline(link, target, inherited, depth)
      return
    }
    const anchor = this.doc.createElement('a')
    anchor.setAttribute('href', href)
    this.inline(link, anchor, inherited, depth)
    target.append(anchor)
  }

  private run(run: Element, target: Element, inherited: Partial<RunFormat>, depth: number): void {
    const rPr = child(run, NS.w, 'rPr')
    const style = this.runStyles.get(wAttr(child(rPr, NS.w, 'rStyle'), 'val') ?? '') ?? {}
    const format: Partial<RunFormat> = { ...inherited, ...style, ...readRunFormat(rPr) }
    if (format.hidden) {
      if (run.textContent) this.warn('HIDDEN_TEXT')
      return
    }
    for (const node of run.children) {
      if (!this.visit(depth)) return
      if (is(node, NS.w, 'fldChar')) {
        const type = wAttr(node, 'fldCharType')
        if (type === 'begin') {
          this.fieldStack.push('instruction')
          this.instructions += 1
        } else if (type === 'separate' && this.fieldStack.at(-1) === 'instruction') {
          this.fieldStack[this.fieldStack.length - 1] = 'result'
          this.instructions -= 1
        } else if (type === 'end' && this.fieldStack.pop() === 'instruction') {
          this.instructions -= 1
        }
        continue
      }
      if (this.instructions > 0) continue
      if (is(node, NS.w, 't')) this.text(node.textContent ?? '', format, target)
      else if (is(node, NS.w, 'tab')) this.text(' ', format, target)
      else if (is(node, NS.w, 'noBreakHyphen')) this.text('\u2011', format, target)
      else if (is(node, NS.w, 'br') || is(node, NS.w, 'cr')) {
        const type = wAttr(node, 'type')
        if (type !== 'page' && type !== 'column') target.append(this.doc.createElement('br'))
      } else if (is(node, NS.w, 'drawing')) this.drawing(node, target)
      else if (is(node, NS.w, 'pict') || is(node, NS.w, 'object')) this.warn('OBJECT_DROPPED')
      else if (is(node, NS.mc, 'AlternateContent')) {
        const fallback = child(node, NS.mc, 'Fallback')
        if (fallback && child(fallback, NS.w, 'drawing'))
          this.drawing(child(fallback, NS.w, 'drawing') as Element, target)
        else this.warn('OBJECT_DROPPED')
      }
    }
  }

  private text(value: string, format: Partial<RunFormat>, target: Element): void {
    const text = without(value, isControl)
    if (!text) return
    let node: Node = this.doc.createTextNode(text)
    const wrap = (tag: string, style?: [string, string]): void => {
      const element = this.doc.createElement(tag)
      if (style) element.style.setProperty(style[0], style[1])
      element.append(node)
      node = element
    }
    if (format.highlight) wrap('mark', ['background-color', format.highlight])
    if (format.color) wrap('span', ['color', format.color])
    if (format.strike) wrap('s')
    if (format.underline) wrap('u')
    if (format.italic) wrap('em')
    if (format.code) wrap('code')
    if (format.bold) wrap('strong')
    target.append(node)
  }

  private drawing(drawing: Element, target: Element): void {
    const frame = child(drawing, NS.wp, 'inline') ?? child(drawing, NS.wp, 'anchor')
    const blip = descendant(frame, [
      [NS.a, 'graphic'],
      [NS.a, 'graphicData'],
      [NS.pic, 'pic'],
      [NS.pic, 'blipFill'],
      [NS.a, 'blip'],
    ])
    const id = blip?.getAttributeNS(NS.r, 'embed')
    const relationship = id ? this.relationships.get(id) : undefined
    const path =
      relationship && relationship.type === REL_IMAGE && !relationship.external
        ? resolvePart('word/', relationship.target)
        : null
    const bytes = path ? this.media.get(path) : undefined
    if (!bytes || this.images.length >= this.limits.images) {
      this.warn('IMAGE_DROPPED')
      return
    }
    const image = this.doc.createElement('img')
    const docPr = child(frame, NS.wp, 'docPr')
    const alt = cleanText(docPr?.getAttribute('descr') || docPr?.getAttribute('title'))
    if (alt) image.setAttribute('alt', alt)
    const extent = child(frame, NS.wp, 'extent')
    const width = Math.round(Number(extent?.getAttribute('cx')) / EMU_PER_PIXEL)
    const height = Math.round(Number(extent?.getAttribute('cy')) / EMU_PER_PIXEL)
    if (width >= 1 && height >= 1 && width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
      image.setAttribute('width', String(width))
      image.setAttribute('height', String(height))
    }
    this.images.push({ element: image, bytes })
    target.append(image)
  }

  private table(table: Element, target: BlockWriter, depth: number, tableDepth: number): void {
    if (tableDepth > MAX_TABLE_DEPTH) {
      this.warn('NESTING_FLATTENED')
      this.flatten(table, target, depth)
      return
    }
    const widths = children(child(table, NS.w, 'tblGrid'), NS.w, 'gridCol').map((column) =>
      Math.max(0, Math.round(clampInt(wAttr(column, 'w'), 0, 100_000, 0) / 15)),
    )
    const element = this.doc.createElement('table')
    const body = this.doc.createElement('tbody')
    element.append(body)
    const origins = new Map<number, HTMLTableCellElement>()
    const rows = children(table, NS.w, 'tr').filter((row) => child(row, NS.w, 'tc'))
    let widest = 0
    rows.forEach((row, rowIndex) => {
      if (!this.visit(depth)) return
      const header = onOff(child(child(row, NS.w, 'trPr'), NS.w, 'tblHeader'))
      const tableRow = this.doc.createElement('tr')
      let column = 0
      for (const cell of children(row, NS.w, 'tc')) {
        const tcPr = child(cell, NS.w, 'tcPr')
        const span = clampInt(wAttr(child(tcPr, NS.w, 'gridSpan'), 'val'), 1, 63, 1)
        const merge = child(tcPr, NS.w, 'vMerge')
        const continues = merge !== null && wAttr(merge, 'val') !== 'restart'
        if (column + span > MAX_COLUMNS) {
          throw new DocxError('TOO_COMPLEX', 'The Word document has a table that is too wide.')
        }
        const origin = origins.get(column)
        if (continues && origin) {
          const rowspan = Math.min(rows.length - rowIndex + 1, (origin.rowSpan || 1) + 1)
          origin.setAttribute('rowspan', String(rowspan))
          column += span
          continue
        }
        this.cells += 1
        if (this.cells > this.limits.cells) {
          throw new DocxError('TOO_COMPLEX', 'The Word document has too many table cells.')
        }
        const tableCell = this.doc.createElement(header ? 'th' : 'td')
        if (span > 1) tableCell.setAttribute('colspan', String(span))
        const cellWidths = widths.slice(column, column + span)
        const sized = clampInt(wAttr(child(tcPr, NS.w, 'tcW'), 'w'), 0, 100_000, 0) > 0
        if (sized && cellWidths.length === span && cellWidths.every((width) => width > 0)) {
          tableCell.setAttribute('data-colwidth', cellWidths.join(','))
        }
        for (let offset = 0; offset < span; offset++) {
          if (merge) origins.set(column + offset, tableCell)
          else origins.delete(column + offset)
        }
        this.blocks(cell, new BlockWriter(this.doc, tableCell), depth + 1, tableDepth)
        if (!tableCell.firstChild) tableCell.append(this.doc.createElement('p'))
        tableRow.append(tableCell)
        column += span
      }
      widest = Math.max(widest, column)
      if (widest * (rowIndex + 1) > this.limits.cells) {
        throw new DocxError('TOO_COMPLEX', 'The Word document has too many table cells.')
      }
      body.append(tableRow)
    })
    target.block(element)
  }

  private flatten(container: Element, target: BlockWriter, depth: number): void {
    for (const node of container.children) {
      if (!this.visit(depth)) return
      if (is(node, NS.w, 'p')) this.paragraph(node, target, depth + 1)
      else if (
        ['tbl', 'tr', 'tc', 'sdt', 'sdtContent', 'ins', 'moveTo', 'customXml'].some((name) =>
          is(node, NS.w, name),
        )
      ) {
        this.flatten(node, target, depth + 1)
      } else if (is(node, NS.mc, 'AlternateContent')) {
        const fallback = child(node, NS.mc, 'Fallback')
        if (fallback) this.flatten(fallback, target, depth + 1)
      }
    }
  }
}

class BlockWriter {
  private lists: OpenList[] = []
  private quoteElement: HTMLElement | null = null
  private codeElement: HTMLElement | null = null

  constructor(
    private readonly doc: Document,
    private readonly parent: Element,
  ) {}

  private reset(keep: 'list' | 'quote' | 'code' | null): void {
    if (keep !== 'list') this.lists = []
    if (keep !== 'quote') this.quoteElement = null
    if (keep !== 'code') this.codeElement = null
  }

  block(element: Element): void {
    this.reset(null)
    this.parent.append(element)
  }

  quote(element: Element): void {
    this.reset('quote')
    if (!this.quoteElement) {
      this.quoteElement = this.doc.createElement('blockquote')
      this.parent.append(this.quoteElement)
    }
    this.quoteElement.append(element)
  }

  code(text: string): void {
    this.reset('code')
    if (this.codeElement) {
      this.codeElement.append(`\n${text}`)
      return
    }
    const pre = this.doc.createElement('pre')
    this.codeElement = this.doc.createElement('code')
    this.codeElement.append(text)
    pre.append(this.codeElement)
    this.parent.append(pre)
  }

  continueItem(element: Element): boolean {
    const item = this.lists.at(-1)?.lastItem
    if (!item) return false
    item.append(element)
    return true
  }

  listItem(element: Element, numId: string, ilvl: number, level: ListLevel): void {
    this.reset('list')
    while (this.lists.length > 0 && (this.lists.at(-1)?.ilvl ?? 0) > ilvl) this.lists.pop()
    let top = this.lists.at(-1)
    if (top && top.ilvl === ilvl && (top.numId !== numId || top.ordered !== level.ordered)) {
      this.lists.pop()
      top = this.lists.at(-1)
    }
    if (!top || top.ilvl < ilvl) {
      const list = this.doc.createElement(level.ordered ? 'ol' : 'ul')
      if (level.ordered && level.start !== 1) list.setAttribute('start', String(level.start))
      ;(top?.lastItem ?? this.parent).append(list)
      top = { ilvl, numId, ordered: level.ordered, element: list, lastItem: null }
      this.lists.push(top)
    }
    const item = this.doc.createElement('li')
    item.append(element)
    top.element.append(item)
    top.lastItem = item
  }
}

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  }
  return btoa(binary)
}

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
}

async function resolveImages(
  reader: Reader,
  options: ImportOptions,
  limits: ImportLimits,
): Promise<void> {
  const policy: ImageSourcePolicy = {
    ...DEFAULT_SOURCE_POLICY,
    ...options.imagePolicy,
    allowBase64: options.allowBase64 === true,
  }
  let index = 0
  for (const { element, bytes } of reader.images) {
    throwIfAborted(options.signal)
    if (!reader.doc.body.contains(element)) continue
    index += 1
    const type = sniffImageType(bytes)
    const size = imageSize(bytes)
    const tooBig =
      bytes.length > limits.imageBytes ||
      size === null ||
      size.width * size.height > limits.imagePixels
    let src: string | null = null
    if (type && !tooBig && options.upload) {
      try {
        const file = new File([bytes as BlobPart], `image-${index}.${EXTENSIONS[type] ?? 'bin'}`, {
          type,
        })
        const result = await options.upload(file, {
          signal: options.signal ?? new AbortController().signal,
          onProgress: () => undefined,
        })
        src = normalizeImageSrc(typeof result === 'string' ? result : result.src, policy)
        const width = typeof result === 'string' ? 0 : Math.round(Number(result.width))
        const height = typeof result === 'string' ? 0 : Math.round(Number(result.height))
        if (src && width >= 1 && height >= 1 && width <= MAX_DIMENSION && height <= MAX_DIMENSION) {
          element.setAttribute('width', String(width))
          element.setAttribute('height', String(height))
        }
      } catch {
        throwIfAborted(options.signal)
      }
    } else if (type && !tooBig && policy.allowBase64) {
      src = normalizeImageSrc(`data:${type};base64,${base64(bytes)}`, policy)
    }
    if (src) element.setAttribute('src', src)
    else {
      element.remove()
      reader.warn('IMAGE_DROPPED')
    }
  }
}

export async function importDocx(file: Blob, options: ImportOptions = {}): Promise<DocxImport> {
  const limits = cleanLimits(options.limits)
  if (file.size > limits.fileBytes) {
    throw new DocxError('TOO_LARGE', 'The Word document is too large.')
  }
  throwIfAborted(options.signal)
  const bytes = new Uint8Array(await file.arrayBuffer())
  throwIfAborted(options.signal)
  const zipLimits = { totalBytes: limits.totalBytes, partBytes: () => limits.partBytes }
  const root = readZip(bytes, (name) => name === '_rels/.rels', zipLimits).get('_rels/.rels')
  const office = [...readRelationships(root ? parseXml(root) : null).values()].find(
    (relationship) => relationship.type === REL_OFFICE_DOCUMENT,
  )
  const documentPath = office ? resolvePart('', office.target) : null
  if (!documentPath || !/^word\/[^/]+\.xml$/.test(documentPath)) {
    throw new DocxError('NOT_DOCX', 'The file is not a Word document.')
  }
  const relsPath = documentPath.replace(/^word\/(.+)$/, 'word/_rels/$1.rels')
  let mediaCount = 0
  const parts = readZip(
    bytes,
    (name) => {
      if ([documentPath, relsPath, 'word/styles.xml', 'word/numbering.xml'].includes(name)) {
        return true
      }
      if (!/^word\/media\/[^/]+$/.test(name) || mediaCount >= limits.images) return false
      mediaCount += 1
      return true
    },
    {
      totalBytes: limits.totalBytes,
      partBytes: (name) =>
        name === documentPath
          ? limits.documentBytes
          : name.startsWith('word/media/')
            ? limits.imageBytes
            : limits.partBytes,
    },
  )
  const part = (name: string): Document | null => {
    const data = parts.get(name)
    return data ? parseXml(data) : null
  }
  const main = part(documentPath)
  const body = child(main?.documentElement, NS.w, 'body')
  if (!body) throw new DocxError('UNSUPPORTED', 'This kind of Word document is not supported.')
  const styles = readStyles(part('word/styles.xml'))
  const media = new Map([...parts].filter(([name]) => name.startsWith('word/media/')))
  const reader = new Reader(
    limits,
    readRelationships(part(relsPath)),
    media,
    styles.paragraphs,
    styles.runs,
    readNumbering(part('word/numbering.xml')),
  )
  reader.blocks(body, new BlockWriter(reader.doc, reader.doc.body), 0, 0)
  await resolveImages(reader, options, limits)
  throwIfAborted(options.signal)
  return { html: reader.doc.body.innerHTML, warnings: reader.warningList() }
}
