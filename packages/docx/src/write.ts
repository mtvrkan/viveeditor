import { imageSize, sniffImageType } from '@viveeditor/ext-image'
import { type Zippable, zipSync } from 'fflate'
import type { Mark, Node as ProseMirrorNode, Schema } from 'prosemirror-model'
import { cleanLink } from './read.js'

export interface ExportSource {
  readonly schema: Schema
  getJSON(): unknown
}

export interface ExportOptions {
  title?: string
  fetchImages?: boolean
  signal?: AbortSignal
  limits?: Partial<ExportLimits>
}

export interface ExportLimits {
  imageBytes: number
  images: number
  timeout: number
}

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const DEFAULT_EXPORT_LIMITS: Readonly<ExportLimits> = Object.freeze({
  imageBytes: 10 * 1024 * 1024,
  images: 200,
  timeout: 15_000,
})

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PACKAGE_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const DECLARATION = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
const PAGE_WIDTH_TWIPS = 9360
const MAX_IMAGE_PIXELS = 624
const EMU_PER_PIXEL = 9525
const TWIPS_PER_PIXEL = 15
const MAX_LEVEL = 8
const WATCH_URLS: Record<string, (id: string) => string> = {
  youtube: (id) => `https://www.youtube.com/watch?v=${id}`,
  vimeo: (id) => `https://vimeo.com/${id}`,
  spotify: (id) => `https://open.spotify.com/${id.replace(':', '/')}`,
}
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/gif': 'gif',
}
const MAX_DIMENSION = 10_000
const ALIGNMENTS: Record<string, string> = { center: 'center', right: 'right', justify: 'both' }
const MAX_CONVERT_PIXELS = 50_000_000
const EMBEDDABLE = new Set(Object.keys(IMAGE_EXTENSIONS))
const CONVERTIBLE = new Set(['image/webp', 'image/avif'])

interface EmbeddedImage {
  bytes: Uint8Array
  type: string
  width: number
  height: number
}

function validXmlCharacter(code: number): boolean {
  return (
    code === 0x09 ||
    code === 0x0a ||
    code === 0x0d ||
    (code >= 0x20 && code <= 0xd7ff) ||
    (code >= 0xe000 && code <= 0xfffd) ||
    code >= 0x10000
  )
}

export function escapeXml(value: unknown): string {
  let result = ''
  for (const character of String(value ?? '')) {
    if (!validXmlCharacter(character.codePointAt(0) ?? 0)) continue
    if (character === '&') result += '&amp;'
    else if (character === '<') result += '&lt;'
    else if (character === '>') result += '&gt;'
    else if (character === '"') result += '&quot;'
    else if (character === "'") result += '&apos;'
    else result += character
  }
  return result
}

function cleanLimits(input: Partial<ExportLimits> | undefined): ExportLimits {
  const limits = { ...DEFAULT_EXPORT_LIMITS }
  for (const key of Object.keys(limits) as (keyof ExportLimits)[]) {
    const value = input?.[key]
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) limits[key] = value
  }
  return limits
}

const hexColor = (value: unknown): string | null => {
  const match = typeof value === 'string' ? /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(value) : null
  return match?.[1] ? match[1].toUpperCase() : null
}

const positiveInt = (value: unknown): number | null => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 1 ? Math.min(MAX_DIMENSION, Math.round(number)) : null
}

function combinedSignal(signal: AbortSignal | undefined, timeout: number): AbortSignal {
  const timer = AbortSignal.timeout(timeout)
  if (!signal) return timer
  const controller = new AbortController()
  const abort = (): void => controller.abort()
  if (signal.aborted || timer.aborted) abort()
  signal.addEventListener('abort', abort, { once: true })
  timer.addEventListener('abort', abort, { once: true })
  return controller.signal
}

function decodeDataUrl(src: string): Uint8Array | null {
  const match = /^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/=\s]+)$/i.exec(src)
  if (!match?.[1]) return null
  try {
    const binary = atob(match[1].replace(/\s+/g, ''))
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
    return bytes
  } catch {
    return null
  }
}

async function readLimited(response: Response, max: number): Promise<Uint8Array | null> {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > max) return null
  const reader = response.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > max) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}

async function toPng(bytes: Uint8Array, type: string): Promise<Uint8Array | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null
  try {
    const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type }))
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null
  } catch {
    return null
  }
}

class Writer {
  private readonly relationships: string[] = []
  private readonly numbering: string[] = []
  readonly media: Zippable = {}
  private relationshipCount = 2
  private numCount = 0
  private imageCount = 0
  private imageAttempts = 0
  private drawingCount = 0
  private readonly notes: ProseMirrorNode[] = []

  constructor(
    private readonly options: ExportOptions,
    private readonly limits: ExportLimits,
  ) {}

  private relationship(type: string, target: string, external = false): string {
    this.relationshipCount += 1
    const id = `rId${this.relationshipCount}`
    this.relationships.push(
      `<Relationship Id="${id}" Type="${R}/${type}" Target="${escapeXml(target)}"${external ? ' TargetMode="External"' : ''}/>`,
    )
    return id
  }

  relationshipsXml(): string {
    return `${DECLARATION}<Relationships xmlns="${PACKAGE_REL}"><Relationship Id="rId1" Type="${R}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="${R}/numbering" Target="numbering.xml"/>${this.relationships.join('')}</Relationships>`
  }

  notesXml(): string {
    if (this.notes.length === 0) return ''
    const rule =
      '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>'
    return (
      rule +
      this.notes
        .map(
          (note, index) => `<w:p>${this.textRun(`${index + 1}. `, '')}${this.inline(note)}</w:p>`,
        )
        .join('')
    )
  }

  numberingXml(): string {
    const levels = (ordered: boolean): string =>
      Array.from({ length: MAX_LEVEL + 1 }, (_, level) => {
        const format = ordered ? 'decimal' : 'bullet'
        const text = ordered ? `%${level + 1}.` : ['\u2022', '◦', '▪'][level % 3]
        const indent = 720 * (level + 1)
        return `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="${format}"/><w:lvlText w:val="${text}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${indent}" w:hanging="360"/></w:pPr></w:lvl>`
      }).join('')
    return `${DECLARATION}<w:numbering xmlns:w="${W}"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${levels(false)}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${levels(true)}</w:abstractNum>${this.numbering.join('')}</w:numbering>`
  }

  private newList(ordered: boolean, level: number, start: number): number {
    this.numCount += 1
    const override = ordered
      ? `<w:lvlOverride w:ilvl="${level}"><w:startOverride w:val="${Math.min(9999, Math.max(1, start))}"/></w:lvlOverride>`
      : ''
    this.numbering.push(
      `<w:num w:numId="${this.numCount}"><w:abstractNumId w:val="${ordered ? 1 : 0}"/>${override}</w:num>`,
    )
    return this.numCount
  }

  async blocks(parent: ProseMirrorNode, level: number, quote: boolean): Promise<string> {
    let xml = ''
    for (let index = 0; index < parent.childCount; index++) {
      const node = parent.child(index)
      xml += await this.block(node, level, quote)
      const next = index + 1 < parent.childCount ? parent.child(index + 1) : null
      if (node.type.name === 'table' && (!next || next.type.name === 'table')) xml += '<w:p/>'
    }
    return xml
  }

  private async block(node: ProseMirrorNode, level: number, quote: boolean): Promise<string> {
    switch (node.type.name) {
      case 'paragraph':
        return this.paragraph(node, quote ? 'Quote' : null)
      case 'heading':
        return this.paragraph(
          node,
          `Heading${Math.min(6, Math.max(1, Number(node.attrs.level) || 1))}`,
        )
      case 'blockquote':
        return this.blocks(node, level, true)
      case 'bulletList':
      case 'orderedList':
      case 'taskList':
        return this.list(node, level)
      case 'codeBlock':
        return node.textContent
          .split('\n')
          .map(
            (line) => `<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr>${this.textRun(line, '')}</w:p>`,
          )
          .join('')
      case 'horizontalRule':
        return '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>'
      case 'table':
        return this.table(node)
      case 'image':
        return `<w:p>${await this.image(node)}</w:p>`
      case 'embed':
        return `<w:p>${this.embed(node)}</w:p>`
      case 'mathBlock':
        return String(node.attrs.latex ?? '')
          .split('\n')
          .map(
            (line) => `<w:p><w:pPr><w:pStyle w:val="Code"/></w:pPr>${this.textRun(line, '')}</w:p>`,
          )
          .join('')
      default:
        return node.isTextblock
          ? this.paragraph(node, null)
          : node.childCount > 0
            ? this.blocks(node, level, quote)
            : ''
    }
  }

  private paragraphProperties(
    node: ProseMirrorNode,
    style: string | null,
    list?: [number, number],
  ): string {
    let properties = style ? `<w:pStyle w:val="${style}"/>` : ''
    if (list)
      properties += `<w:numPr><w:ilvl w:val="${list[1]}"/><w:numId w:val="${list[0]}"/></w:numPr>`
    const textAlign = String(node.attrs.textAlign)
    const align = Object.hasOwn(ALIGNMENTS, textAlign) ? ALIGNMENTS[textAlign] : undefined
    if (align) properties += `<w:jc w:val="${align}"/>`
    return properties ? `<w:pPr>${properties}</w:pPr>` : ''
  }

  private paragraph(
    node: ProseMirrorNode,
    style: string | null,
    list?: [number, number],
    prefix = '',
  ): string {
    return `<w:p>${this.paragraphProperties(node, style, list)}${prefix ? this.textRun(prefix, '') : ''}${this.inline(node)}</w:p>`
  }

  private async list(node: ProseMirrorNode, level: number): Promise<string> {
    const ordered = node.type.name === 'orderedList'
    const depth = Math.min(MAX_LEVEL, level)
    const numId = this.newList(ordered, depth, Number(node.attrs.start) || 1)
    let xml = ''
    for (let index = 0; index < node.childCount; index++) {
      const item = node.child(index)
      const prefix = item.type.name === 'taskItem' ? (item.attrs.checked ? '☑ ' : '☐ ') : ''
      let first = true
      for (let offset = 0; offset < item.childCount; offset++) {
        const content = item.child(offset)
        if (first && content.isTextblock && content.type.name !== 'codeBlock') {
          xml += this.paragraph(content, null, [numId, depth], prefix)
        } else if (content.isTextblock && content.type.name === 'paragraph') {
          xml += this.paragraph(content, 'ListParagraph')
        } else {
          xml += await this.block(content, level + 1, false)
        }
        first = false
      }
      if (first) xml += this.paragraph(item, null, [numId, depth], prefix)
    }
    return xml
  }

  private inline(node: ProseMirrorNode): string {
    let xml = ''
    let link: { href: string; id: string } | null = null
    let linkRuns = ''
    const flush = (): void => {
      if (link) xml += `<w:hyperlink r:id="${link.id}">${linkRuns}</w:hyperlink>`
      link = null
      linkRuns = ''
    }
    node.forEach((child) => {
      const linkMark = child.marks.find((mark) => mark.type.name === 'link')
      const href = linkMark ? cleanLink(String(linkMark.attrs.href ?? '')) : null
      if (link?.href !== href) {
        flush()
        if (href) link = { href, id: this.relationship('hyperlink', href, true) }
      }
      const properties = this.runProperties(child.marks, href !== null)
      const run = child.isText
        ? this.textRun(child.text ?? '', properties)
        : this.inlineNode(child, properties)
      if (link) linkRuns += run
      else xml += run
    })
    flush()
    return xml
  }

  private inlineNode(node: ProseMirrorNode, properties: string): string {
    switch (node.type.name) {
      case 'hardBreak':
        return '<w:r><w:br/></w:r>'
      case 'mention':
        return this.textRun(String(node.type.spec.leafText?.(node) ?? ''), properties)
      case 'mathInline':
        return this.textRun(String(node.attrs.latex ?? ''), '<w:rStyle w:val="CodeChar"/>')
      case 'footnote':
        this.notes.push(node)
        return this.textRun(String(this.notes.length), '<w:vertAlign w:val="superscript"/>')
      default:
        return ''
    }
  }

  private runProperties(marks: readonly Mark[], linked: boolean): string {
    let properties = linked ? '<w:rStyle w:val="Hyperlink"/>' : ''
    const names = new Set(marks.map((mark) => mark.type.name))
    if (names.has('code') && !linked) properties += '<w:rStyle w:val="CodeChar"/>'
    if (names.has('bold')) properties += '<w:b/>'
    if (names.has('italic')) properties += '<w:i/>'
    if (names.has('strike')) properties += '<w:strike/>'
    const color = hexColor(marks.find((mark) => mark.type.name === 'textColor')?.attrs.color)
    if (color) properties += `<w:color w:val="${color}"/>`
    if (names.has('underline')) properties += '<w:u w:val="single"/>'
    const fill = hexColor(marks.find((mark) => mark.type.name === 'highlight')?.attrs.color)
    if (names.has('highlight')) {
      properties += `<w:shd w:val="clear" w:color="auto" w:fill="${fill ?? 'FFFF00'}"/>`
    }
    return properties
  }

  private textRun(text: string, properties: string): string {
    const parts = text.split('\t')
    const body = parts
      .map((part) => (part ? `<w:t xml:space="preserve">${escapeXml(part)}</w:t>` : ''))
      .join('<w:tab/>')
    return body ? `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}${body}</w:r>` : ''
  }

  private linkParagraphContent(href: string | null, text: string): string {
    const label = text || href || ''
    if (!href) return this.textRun(label, '')
    const id = this.relationship('hyperlink', href, true)
    return `<w:hyperlink r:id="${id}">${this.textRun(label, '<w:rStyle w:val="Hyperlink"/>')}</w:hyperlink>`
  }

  private embed(node: ProseMirrorNode): string {
    const provider = String(node.attrs.provider)
    const watch = Object.hasOwn(WATCH_URLS, provider) ? WATCH_URLS[provider] : undefined
    const href = watch && typeof node.attrs.id === 'string' ? cleanLink(watch(node.attrs.id)) : null
    return this.linkParagraphContent(href, String(node.attrs.title ?? ''))
  }

  private async loadImage(src: string): Promise<Uint8Array | null> {
    if (src.startsWith('data:')) return decodeDataUrl(src)
    if (!this.options.fetchImages || !/^https:\/\//i.test(src)) return null
    const signal = combinedSignal(this.options.signal, this.limits.timeout)
    try {
      const response = await fetch(src, {
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        mode: 'cors',
        redirect: 'follow',
        signal,
      })
      if (!response.ok || !/^https:\/\//i.test(response.url || src)) return null
      return await readLimited(response, this.limits.imageBytes)
    } catch {
      if (this.options.signal?.aborted) throw this.options.signal.reason
      return null
    }
  }

  private async embedImage(node: ProseMirrorNode): Promise<EmbeddedImage | null> {
    if (this.imageAttempts >= this.limits.images) return null
    this.imageAttempts += 1
    const src = typeof node.attrs.src === 'string' ? node.attrs.src : ''
    let bytes = await this.loadImage(src)
    if (!bytes || bytes.length > this.limits.imageBytes) return null
    let type = sniffImageType(bytes)
    const measured = imageSize(bytes)
    if (
      type &&
      CONVERTIBLE.has(type) &&
      measured &&
      measured.width * measured.height <= MAX_CONVERT_PIXELS
    ) {
      bytes = await toPng(bytes, type)
      type = bytes ? 'image/png' : null
    }
    if (!bytes || !type || !EMBEDDABLE.has(type)) return null
    const natural = imageSize(bytes)
    let width = positiveInt(node.attrs.width) ?? natural?.width ?? MAX_IMAGE_PIXELS
    let height =
      positiveInt(node.attrs.height) ??
      (natural ? Math.round((natural.height * width) / natural.width) : Math.round(width * 0.75))
    if (width > MAX_IMAGE_PIXELS) {
      height = Math.max(1, Math.round((height * MAX_IMAGE_PIXELS) / width))
      width = MAX_IMAGE_PIXELS
    }
    this.imageCount += 1
    return { bytes, type, width, height: Math.min(MAX_DIMENSION, Math.max(1, height)) }
  }

  private async image(node: ProseMirrorNode): Promise<string> {
    const image = await this.embedImage(node)
    const alt = String(node.attrs.alt ?? '')
    if (!image) {
      const src = typeof node.attrs.src === 'string' ? cleanLink(node.attrs.src) : null
      return this.linkParagraphContent(src, alt)
    }
    const name = `image${this.imageCount}.${IMAGE_EXTENSIONS[image.type]}`
    this.media[`word/media/${name}`] = [image.bytes, { level: 0 }]
    const id = this.relationship('image', `media/${name}`)
    this.drawingCount += 1
    const cx = image.width * EMU_PER_PIXEL
    const cy = image.height * EMU_PER_PIXEL
    const number = this.drawingCount
    return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${number}" name="Picture ${number}" descr="${escapeXml(alt)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${number}" name="${name}" descr="${escapeXml(alt)}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`
  }

  private async table(node: ProseMirrorNode): Promise<string> {
    const rows: ProseMirrorNode[] = []
    node.forEach((row) => {
      rows.push(row)
    })
    const pending = new Map<number, { left: number; span: number }>()
    const firstWidths: (number | null)[] = []
    rows[0]?.forEach((cell) => {
      const span = positiveInt(cell.attrs.colspan) ?? 1
      const widths: unknown = cell.attrs.colwidth
      for (let index = 0; index < span; index++) {
        firstWidths.push(Array.isArray(widths) ? positiveInt(widths[index]) : null)
      }
    })
    let rowXml = ''
    let gridColumns = 0
    for (const row of rows) {
      let column = 0
      let cellIndex = 0
      let cells = ''
      let header = row.childCount > 0
      const continuation = (): boolean => {
        const merge = pending.get(column)
        if (!merge) return false
        cells += `<w:tc><w:tcPr>${merge.span > 1 ? `<w:gridSpan w:val="${merge.span}"/>` : ''}<w:vMerge/></w:tcPr><w:p/></w:tc>`
        merge.left -= 1
        if (merge.left <= 0) pending.delete(column)
        column += merge.span
        return true
      }
      while (cellIndex < row.childCount) {
        if (continuation()) continue
        const cell = row.child(cellIndex)
        cellIndex += 1
        if (cell.type.name !== 'tableHeader') header = false
        const span = Math.min(63, positiveInt(cell.attrs.colspan) ?? 1)
        const rowspan = positiveInt(cell.attrs.rowspan) ?? 1
        const widths: unknown = cell.attrs.colwidth
        const width = Array.isArray(widths)
          ? widths.reduce((sum: number, value) => sum + (positiveInt(value) ?? 0), 0) *
            TWIPS_PER_PIXEL
          : 0
        let properties = width > 0 ? `<w:tcW w:w="${width}" w:type="dxa"/>` : ''
        if (span > 1) properties += `<w:gridSpan w:val="${span}"/>`
        if (rowspan > 1) {
          properties += '<w:vMerge w:val="restart"/>'
          pending.set(column, { left: rowspan - 1, span })
        }
        let content = await this.blocks(cell, 0, false)
        if (!content.endsWith('</w:p>')) content += '<w:p/>'
        cells += `<w:tc>${properties ? `<w:tcPr>${properties}</w:tcPr>` : ''}${content}</w:tc>`
        column += span
      }
      while (pending.has(column)) continuation()
      gridColumns = Math.max(gridColumns, column)
      rowXml += `<w:tr>${header ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells}</w:tr>`
    }
    gridColumns = Math.max(1, gridColumns)
    const fallback = Math.round(PAGE_WIDTH_TWIPS / gridColumns)
    const grid = Array.from({ length: gridColumns }, (_, index) => {
      const width = firstWidths[index]
      return `<w:gridCol w:w="${width ? width * TWIPS_PER_PIXEL : fallback}"/>`
    }).join('')
    return `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${rowXml}</w:tbl>`
  }
}

function stylesXml(): string {
  const heading = (level: number, size: number): string =>
    `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="80"/><w:outlineLvl w:val="${level - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${size}"/></w:rPr></w:style>`
  return `${DECLARATION}<w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:eastAsia="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:qFormat/><w:rPr><w:sz w:val="56"/></w:rPr></w:style>${heading(1, 40)}${heading(2, 32)}${heading(3, 28)}${heading(4, 24)}${heading(5, 22)}${heading(6, 22)}<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="BFBFBF"/></w:pBdr><w:ind w:left="567"/></w:pPr><w:rPr><w:i/><w:color w:val="404040"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Code"><w:name w:val="Code"/><w:basedOn w:val="Normal"/><w:pPr><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:sz w:val="20"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:ind w:left="720"/></w:pPr></w:style><w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/></w:style><w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:basedOn w:val="DefaultParagraphFont"/><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr></w:style><w:style w:type="character" w:styleId="CodeChar"><w:name w:val="Code Char"/><w:basedOn w:val="DefaultParagraphFont"/><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas" w:cs="Consolas"/><w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/></w:rPr></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:left w:w="108" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/><w:pPr><w:spacing w:after="0"/></w:pPr><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr></w:style></w:styles>`
}

const encoder = new TextEncoder()

export async function exportDocx(source: ExportSource, options: ExportOptions = {}): Promise<Blob> {
  const doc = source.schema.nodeFromJSON(source.getJSON())
  doc.check()
  const writer = new Writer(options, cleanLimits(options.limits))
  const body = (await writer.blocks(doc, 0, false)) + writer.notesXml()
  options.signal?.throwIfAborted()
  const title = escapeXml((options.title ?? '').trim().slice(0, 255))
  const files: Zippable = {
    '[Content_Types].xml': encoder.encode(
      `${DECLARATION}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`,
    ),
    '_rels/.rels': encoder.encode(
      `${DECLARATION}<Relationships xmlns="${PACKAGE_REL}"><Relationship Id="rId1" Type="${R}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
    ),
    'docProps/core.xml': encoder.encode(
      `${DECLARATION}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">${title ? `<dc:title>${title}</dc:title>` : ''}</cp:coreProperties>`,
    ),
    'word/document.xml': encoder.encode(
      `${DECLARATION}<w:document xmlns:w="${W}" xmlns:r="${R}" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1273" w:bottom="1440" w:left="1273" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    ),
    'word/styles.xml': encoder.encode(stylesXml()),
    'word/numbering.xml': encoder.encode(writer.numberingXml()),
    'word/_rels/document.xml.rels': encoder.encode(writer.relationshipsXml()),
    ...writer.media,
  }
  return new Blob([zipSync(files) as BlobPart], { type: DOCX_MIME })
}
