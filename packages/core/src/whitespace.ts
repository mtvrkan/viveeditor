import { Fragment, type Node as ProseMirrorNode } from 'prosemirror-model'

const NBSP = ' '
const OPAQUE = '￼'
const SPACE_RUN = / +/g
const LOOSE_RUN = /[  ]+/g

type Convert = (text: string) => string

const isLineBreak = (node: ProseMirrorNode): boolean => node.type.name === 'hardBreak'

function keepSpaces(text: string): string {
  return text.replace(SPACE_RUN, (run, index: number) => {
    if (index === 0 || index + run.length === text.length) return NBSP.repeat(run.length)
    return run.length === 1 ? run : ` ${NBSP.repeat(run.length - 1)}`
  })
}

function restoreSpaces(text: string): string {
  return text.replace(LOOSE_RUN, (run, index: number) => {
    const edge = index === 0 || index + run.length === text.length
    return edge || run.includes(' ') ? ' '.repeat(run.length) : run
  })
}

function convertLine(line: ProseMirrorNode[], convert: Convert): ProseMirrorNode[] {
  const joined = line.map((node) => (node.isText ? (node.text ?? '') : OPAQUE)).join('')
  const converted = convert(joined)
  if (converted === joined) return line
  let offset = 0
  return line.map((node) => {
    const length = node.isText ? (node.text?.length ?? 0) : 1
    const text = converted.slice(offset, offset + length)
    offset += length
    return node.isText && text !== node.text ? node.type.schema.text(text, node.marks) : node
  })
}

function convertTextblock(block: ProseMirrorNode, convert: Convert): ProseMirrorNode {
  const children: ProseMirrorNode[] = []
  let line: ProseMirrorNode[] = []
  block.forEach((child) => {
    if (!isLineBreak(child)) {
      line.push(child)
      return
    }
    children.push(...convertLine(line, convert), child)
    line = []
  })
  children.push(...convertLine(line, convert))
  return children.every((child, index) => child === block.child(index))
    ? block
    : block.copy(Fragment.from(children))
}

function convertNode(node: ProseMirrorNode, convert: Convert): ProseMirrorNode {
  if (node.type.spec.code || node.type.spec.whitespace === 'pre') return node
  if (node.isTextblock) return convertTextblock(node, convert)
  if (node.isLeaf) return node
  let changed = false
  const children: ProseMirrorNode[] = []
  node.forEach((child) => {
    const converted = convertNode(child, convert)
    changed ||= converted !== child
    children.push(converted)
  })
  return changed ? node.copy(Fragment.from(children)) : node
}

export const withKeptSpaces = (doc: ProseMirrorNode): ProseMirrorNode =>
  convertNode(doc, keepSpaces)

export const withRestoredSpaces = (doc: ProseMirrorNode): ProseMirrorNode =>
  convertNode(doc, restoreSpaces)
