import { DocxError } from './errors.js'

export const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  mc: 'http://schemas.openxmlformats.org/markup-compatibility/2006',
  rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
} as const

const FORBIDDEN = /<!(?:DOCTYPE|ENTITY)/i

function decode(bytes: Uint8Array): string {
  const utf16 =
    bytes.length >= 2 &&
    ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))
  const encoding = utf16 ? (bytes[0] === 0xff ? 'utf-16le' : 'utf-16be') : 'utf-8'
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes)
  } catch {
    throw new DocxError('DAMAGED', 'The Word document is damaged.')
  }
}

export function parseXml(bytes: Uint8Array): Document {
  const source = decode(bytes)
  if (FORBIDDEN.test(source)) {
    throw new DocxError('UNSUPPORTED', 'The Word document contains a document type declaration.')
  }
  const doc = new DOMParser().parseFromString(source, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new DocxError('DAMAGED', 'The Word document is damaged.')
  }
  return doc
}

export const is = (node: Node | null | undefined, ns: string, name: string): boolean =>
  node?.nodeType === Node.ELEMENT_NODE &&
  (node as Element).namespaceURI === ns &&
  (node as Element).localName === name

export function child(
  element: Element | null | undefined,
  ns: string,
  name: string,
): Element | null {
  if (!element) return null
  for (const node of element.children) if (is(node, ns, name)) return node
  return null
}

export function children(element: Element | null | undefined, ns: string, name: string): Element[] {
  return element ? [...element.children].filter((node) => is(node, ns, name)) : []
}

export function descendant(
  element: Element | null,
  path: ReadonlyArray<[string, string]>,
): Element | null {
  let current = element
  for (const [ns, name] of path) current = child(current, ns, name)
  return current
}

export const wAttr = (element: Element | null | undefined, name: string): string | null =>
  element?.getAttributeNS(NS.w, name) ?? null

export function onOff(element: Element | null): boolean {
  if (!element) return false
  const value = wAttr(element, 'val')
  return value === null || !['0', 'false', 'off', 'none'].includes(value)
}
