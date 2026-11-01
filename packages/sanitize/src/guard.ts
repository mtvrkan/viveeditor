import { type DefaultTreeAdapterMap, type TreeAdapter, defaultTreeAdapter as tree } from 'parse5'

type ChildNode = DefaultTreeAdapterMap['childNode']
type ParentNode = DefaultTreeAdapterMap['parentNode']
type Template = DefaultTreeAdapterMap['template']

enum State {
  TagName,
  BeforeName,
  Name,
  AfterName,
  BeforeValue,
  DoubleQuoted,
  SingleQuoted,
  Unquoted,
  AfterQuoted,
  SelfClosing,
}

const STATES = 10
const END = -1

function isSpace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0c || code === 0x0d
}

function isAsciiLetter(code: number): boolean {
  return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a)
}

const move = (state: State, added = 0): number => state * 2 + added

function transition(state: State, code: number): number {
  switch (state) {
    case State.TagName:
      if (isSpace(code)) return move(State.BeforeName)
      if (code === 0x2f) return move(State.SelfClosing)
      return code === 0x3e ? END : move(State.TagName)
    case State.BeforeName:
      if (isSpace(code)) return move(State.BeforeName)
      if (code === 0x2f || code === 0x3e) return transition(State.AfterName, code)
      return move(State.Name, 1)
    case State.Name:
      if (isSpace(code) || code === 0x2f || code === 0x3e) return transition(State.AfterName, code)
      return code === 0x3d ? move(State.BeforeValue) : move(State.Name)
    case State.AfterName:
      if (isSpace(code)) return move(State.AfterName)
      if (code === 0x2f) return move(State.SelfClosing)
      if (code === 0x3d) return move(State.BeforeValue)
      return code === 0x3e ? END : move(State.Name, 1)
    case State.BeforeValue:
      if (isSpace(code)) return move(State.BeforeValue)
      if (code === 0x22) return move(State.DoubleQuoted)
      if (code === 0x27) return move(State.SingleQuoted)
      return code === 0x3e ? END : move(State.Unquoted)
    case State.DoubleQuoted:
      return move(code === 0x22 ? State.AfterQuoted : State.DoubleQuoted)
    case State.SingleQuoted:
      return move(code === 0x27 ? State.AfterQuoted : State.SingleQuoted)
    case State.Unquoted:
      if (isSpace(code)) return move(State.BeforeName)
      return code === 0x3e ? END : move(State.Unquoted)
    case State.AfterQuoted:
      if (isSpace(code)) return move(State.BeforeName)
      if (code === 0x2f) return move(State.SelfClosing)
      return code === 0x3e ? END : transition(State.BeforeName, code)
    case State.SelfClosing:
      return code === 0x3e ? END : transition(State.BeforeName, code)
  }
}

function opensTag(input: string, index: number): boolean {
  if (!isAsciiLetter(input.charCodeAt(index))) return false
  const previous = input.charCodeAt(index - 1)
  return previous === 0x3c || (previous === 0x2f && input.charCodeAt(index - 2) === 0x3c)
}

export function hasCrowdedTag(input: string, maxAttributes: number): boolean {
  let counts = new Int32Array(STATES).fill(END)
  let next = new Int32Array(STATES)
  let active = false
  for (let index = 0; index < input.length; index++) {
    if (!active) {
      const open = input.indexOf('<', index)
      if (open === -1) return false
      index = open
    }
    const code = input.charCodeAt(index)
    if (opensTag(input, index)) counts[State.TagName] = Math.max(counts[State.TagName] ?? END, 0)
    next.fill(END)
    for (let state = 0; state < STATES; state++) {
      const count = counts[state] ?? END
      if (count === END) continue
      const target = transition(state, code)
      if (target === END) continue
      const total = count + (target & 1)
      if (total > maxAttributes) return true
      const reached = target >> 1
      if (total > (next[reached] ?? END)) next[reached] = total
    }
    ;[counts, next] = [next, counts]
    active =
      counts.some((count) => count !== END) ||
      code === 0x3c ||
      (code === 0x2f && input.charCodeAt(index - 1) === 0x3c)
  }
  return false
}

export function guardedTreeAdapter(
  maxElements: number,
  maxNesting: number,
  onLimit: () => never,
): TreeAdapter<DefaultTreeAdapterMap> {
  let created = 0
  const owners = new WeakMap<ParentNode, Template>()
  const checkDepth = (node: ChildNode): void => {
    if (!tree.isElementNode(node)) return
    let depth = 0
    let current: ParentNode | null | undefined = node
    while (current) {
      depth++
      if (depth > maxNesting) onLimit()
      current = ('parentNode' in current ? current.parentNode : null) ?? owners.get(current) ?? null
    }
  }
  return {
    ...tree,
    createElement(tagName, namespaceURI, attrs) {
      created++
      if (created > maxElements) onLimit()
      return tree.createElement(tagName, namespaceURI, attrs)
    },
    appendChild(parentNode, newNode) {
      tree.appendChild(parentNode, newNode)
      checkDepth(newNode)
    },
    insertBefore(parentNode, newNode, referenceNode) {
      tree.insertBefore(parentNode, newNode, referenceNode)
      checkDepth(newNode)
    },
    setTemplateContent(templateElement, contentElement) {
      tree.setTemplateContent(templateElement, contentElement)
      owners.set(contentElement, templateElement)
    },
  }
}
