export interface RenderFootnotesOptions {
  backLabel?: string
}

let calls = 0

export function renderFootnotes(root: ParentNode, options: RenderFootnotesOptions = {}): number {
  const notes = Array.from(
    root.querySelectorAll<HTMLElement>('sup[data-footnote]:not([data-rendered])'),
  )
  if (notes.length === 0) return 0
  const prefix = `vive-fn-${++calls}`
  const owner = (root as Node).ownerDocument ?? document
  const list = owner.createElement('ol')
  list.className = 'vive-footnotes'
  notes.forEach((note, index) => {
    const number = String(index + 1)
    const item = owner.createElement('li')
    item.id = `${prefix}-${number}`
    item.append(...Array.from(note.childNodes))
    const reference = `${prefix}-ref-${number}`
    if (note.closest('a')) {
      note.textContent = number
    } else {
      const link = owner.createElement('a')
      link.href = `#${item.id}`
      link.id = reference
      link.textContent = number
      note.replaceChildren(link)
      const back = owner.createElement('a')
      back.href = `#${reference}`
      back.className = 'vive-footnote-back'
      back.textContent = '↩'
      back.setAttribute('aria-label', options.backLabel ?? 'Back to text')
      item.append(' ', back)
    }
    note.dataset.rendered = ''
    list.append(item)
  })
  root.append(list)
  return notes.length
}
