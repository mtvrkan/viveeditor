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
