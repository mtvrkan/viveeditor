import type { Slice } from 'prosemirror-model'
import { Plugin } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'

const DISCARDED_TAGS = ['style', 'meta', 'link', 'xml', 'o:p', 'title', 'script', 'template']

function removeOfficeListMarkers(root: Node): void {
  const walker = root.ownerDocument?.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
  if (!walker) return
  const openers: Comment[] = []
  while (walker.nextNode()) {
    const comment = walker.currentNode as Comment
    if (/^\[if !supportLists\]/i.test(comment.data.trim())) openers.push(comment)
  }
  for (const opener of openers) {
    let node = opener.nextSibling
    while (
      node &&
      !(node.nodeType === Node.COMMENT_NODE && /\[endif\]/i.test((node as Comment).data))
    ) {
      const next = node.nextSibling
      node.parentNode?.removeChild(node)
      node = next
    }
  }
}

function removeComments(root: Node): void {
  const walker = root.ownerDocument?.createTreeWalker(root, NodeFilter.SHOW_COMMENT)
  if (!walker) return
  const comments: Node[] = []
  while (walker.nextNode()) comments.push(walker.currentNode)
  for (const comment of comments) comment.parentNode?.removeChild(comment)
}

function unwrapGoogleDocsWrapper(body: HTMLElement): void {
  for (const wrapper of body.querySelectorAll('b[id^="docs-internal-guid"]')) {
    wrapper.replaceWith(...wrapper.childNodes)
  }
}

export function cleanPastedHtml(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const { body } = document
  removeOfficeListMarkers(body)
  removeComments(body)
  for (const tag of DISCARDED_TAGS) {
    for (const element of [...document.getElementsByTagName(tag)]) element.remove()
  }
  unwrapGoogleDocsWrapper(body)
  for (const element of body.querySelectorAll('br.Apple-interchange-newline')) element.remove()
  return body.innerHTML
}

function isPlainPasteShortcut(event: KeyboardEvent): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    event.shiftKey &&
    !event.altKey &&
    event.key.toLowerCase() === 'v'
  )
}

function insertSlice(view: EditorView, slice: Slice): void {
  const { content, openStart, openEnd } = slice
  const single =
    openStart === 0 && openEnd === 0 && content.childCount === 1 ? content.firstChild : null
  const transaction = single
    ? view.state.tr.replaceSelectionWith(single, true)
    : view.state.tr.replaceSelection(slice)
  view.dispatch(transaction.scrollIntoView().setMeta('paste', true).setMeta('uiEvent', 'paste'))
}

export function plainTextPaste(): Plugin {
  let shift = false
  let lastKey = ''
  let forced = false
  let pasted = false
  let skipNative = false

  const readClipboardLater = (view: EditorView): void => {
    pasted = false
    const clipboard = globalThis.navigator?.clipboard
    if (typeof clipboard?.readText !== 'function') return
    setTimeout(() => {
      if (pasted || view.isDestroyed || !view.editable) return
      clipboard.readText().then(
        (text) => {
          if (pasted || !text || view.isDestroyed || !view.editable || !view.hasFocus()) return
          forced = true
          try {
            view.pasteText(text)
          } finally {
            forced = false
          }
          skipNative = true
          setTimeout(() => {
            skipNative = false
          }, 1000)
        },
        () => undefined,
      )
    }, 0)
  }

  return new Plugin({
    props: {
      handleDOMEvents: {
        keydown: (view, event) => {
          shift = event.key === 'Shift' || event.shiftKey
          lastKey = event.key
          skipNative = false
          if (isPlainPasteShortcut(event)) readClipboardLater(view)
          return false
        },
        keyup: (_view, event) => {
          if (event.key === 'Shift') shift = false
          return false
        },
        blur: () => {
          shift = false
          return false
        },
        paste: (_view, event) => {
          pasted = true
          if (!skipNative) return false
          skipNative = false
          event.preventDefault()
          return true
        },
      },
      handlePaste: (view, event, slice) => {
        const plain =
          forced || (shift && lastKey !== 'Insert' && !!event.clipboardData?.getData('text/plain'))
        if (!plain || slice.content.size === 0) return false
        insertSlice(view, slice)
        return true
      },
    },
  })
}
