import { redo, undo } from 'prosemirror-history'
import { keymap } from 'prosemirror-keymap'
import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { EditorState, TextSelection, type Transaction } from 'prosemirror-state'
import { StepMap } from 'prosemirror-transform'
import { EditorView, type NodeView } from 'prosemirror-view'

export interface FootnoteLabels {
  footnote: string
  edit: string
}

export const MAX_FOOTNOTE_LENGTH = 5000

const editors = new WeakMap<Element, EditorView>()

export const footnoteEditorOf = (dom: Element | null): EditorView | undefined =>
  dom ? editors.get(dom) : undefined

export class FootnoteView implements NodeView {
  readonly dom: HTMLElement
  private inner: EditorView | null = null
  private popup: HTMLElement | null = null

  constructor(
    private node: ProseMirrorNode,
    private readonly outer: EditorView,
    private readonly getPos: () => number | undefined,
    private readonly labels: FootnoteLabels,
  ) {
    this.dom = document.createElement('sup')
    this.dom.className = 'vive-footnote'
    this.dom.dataset.footnote = ''
    this.describe()
  }

  update(node: ProseMirrorNode): boolean {
    if (!node.sameMarkup(this.node)) return false
    this.node = node
    this.describe()
    const inner = this.inner
    if (inner) {
      const state = inner.state
      const start = node.content.findDiffStart(state.doc.content)
      if (start != null) {
        const ends = node.content.findDiffEnd(state.doc.content)
        let { a: endA, b: endB } = ends ?? { a: start, b: start }
        const overlap = start - Math.min(endA, endB)
        if (overlap > 0) {
          endA += overlap
          endB += overlap
        }
        inner.dispatch(
          state.tr.replace(start, endB, node.slice(start, endA)).setMeta('fromOutside', true),
        )
      }
    }
    return true
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode')
    if (this.outer.editable) this.open()
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode')
    this.close()
  }

  stopEvent(event: Event): boolean {
    return Boolean(this.popup && event.target instanceof Node && this.popup.contains(event.target))
  }

  ignoreMutation(): boolean {
    return true
  }

  destroy(): void {
    this.close()
  }

  private describe(): void {
    const text = this.node.textContent.replace(/\s+/g, ' ').trim()
    this.dom.setAttribute(
      'aria-label',
      `${this.labels.footnote}: ${Array.from(text).slice(0, 100).join('')}`,
    )
  }

  private open(): void {
    if (this.popup) return
    const popup = document.createElement('span')
    this.dom.append(popup)
    this.popup = popup
    const outer = this.outer
    const inner = new EditorView(
      { mount: popup },
      {
        state: EditorState.create({
          doc: this.node,
          plugins: [
            keymap({
              'Mod-z': () => undo(outer.state, outer.dispatch),
              'Mod-y': () => redo(outer.state, outer.dispatch),
              'Shift-Mod-z': () => redo(outer.state, outer.dispatch),
              Escape: () => this.leave(),
              Enter: () => this.leave(),
            }),
          ],
        }),
        editable: () => outer.editable,
        attributes: {
          role: 'textbox',
          'aria-label': this.labels.edit,
          class: 'vive-footnote-popup vive-footnote-field',
        },
        transformPastedHTML: (html) =>
          outer.someProp('transformPastedHTML', (transform) => transform(html, outer)) ?? html,
        dispatchTransaction: (transaction) => this.dispatchInner(transaction),
      },
    )
    this.inner = inner
    editors.set(inner.dom, inner)
    inner.focus()
  }

  private dispatchInner(transaction: Transaction): void {
    const inner = this.inner
    if (!inner) return
    if (transaction.doc.textContent.length > MAX_FOOTNOTE_LENGTH && transaction.docChanged) return
    const { state, transactions } = inner.state.applyTransaction(transaction)
    inner.updateState(state)
    if (transaction.getMeta('fromOutside')) return
    const pos = this.getPos()
    if (pos === undefined || !this.outer.editable) return
    const outerTransaction = this.outer.state.tr
    const offset = StepMap.offset(pos + 1)
    for (const applied of transactions) {
      for (const step of applied.steps) {
        const mapped = step.map(offset)
        if (mapped) outerTransaction.step(mapped)
      }
    }
    if (outerTransaction.docChanged) this.outer.dispatch(outerTransaction)
  }

  private leave(): boolean {
    const pos = this.getPos()
    if (pos === undefined) return false
    const { state } = this.outer
    const after = pos + this.node.nodeSize
    this.outer.dispatch(state.tr.setSelection(TextSelection.create(state.doc, after)))
    this.outer.focus()
    return true
  }

  private close(): void {
    this.inner?.destroy()
    this.inner = null
    this.popup?.remove()
    this.popup = null
  }
}
