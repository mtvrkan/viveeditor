import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { NodeSelection, TextSelection } from 'prosemirror-state'
import type { EditorView, NodeView, ViewMutationRecord } from 'prosemirror-view'
import { cleanLatex, type KatexLike, renderLatex } from './katex.js'

export interface MathLabels {
  empty: string
  edit: string
}

export interface MathViewSettings {
  katex: () => Promise<KatexLike | null>
  labels: MathLabels
}

const PREVIEW_DELAY = 100
const views = new WeakMap<Element, MathView>()

export const mathViewOf = (dom: Node | null): MathView | undefined =>
  dom instanceof Element ? views.get(dom) : undefined

export class MathView implements NodeView {
  readonly dom: HTMLElement
  private katex: KatexLike | null = null
  private field: HTMLInputElement | HTMLTextAreaElement | null = null
  private timer = 0
  private destroyed = false

  constructor(
    private node: ProseMirrorNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
    private readonly settings: MathViewSettings,
  ) {
    this.dom = document.createElement(this.display ? 'div' : 'span')
    this.dom.className = 'vive-math'
    this.dom.dataset.math = this.display ? 'block' : 'inline'
    this.dom.contentEditable = 'false'
    this.dom.addEventListener('click', () => this.open())
    views.set(this.dom, this)
    this.render()
    settings.katex().then((katex) => {
      this.katex = katex
      if (katex && !this.destroyed && !this.field) this.render()
    })
  }

  private get display(): boolean {
    return this.node.type.name === 'mathBlock'
  }

  private get latex(): string {
    return cleanLatex(this.node.attrs.latex) ?? ''
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false
    this.node = node
    if (!this.field) this.render()
    return true
  }

  selectNode(): void {
    this.dom.classList.add('ProseMirror-selectednode')
    if (this.latex === '') this.open()
  }

  deselectNode(): void {
    this.dom.classList.remove('ProseMirror-selectednode')
  }

  stopEvent(event: Event): boolean {
    return this.field !== null && event.target instanceof Node && this.dom.contains(event.target)
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return mutation.type !== 'selection' || this.field !== null
  }

  destroy(): void {
    this.destroyed = true
    window.clearTimeout(this.timer)
  }

  open(): void {
    if (this.field || !this.view.editable || this.getPos() === undefined) return
    const field = document.createElement(this.display ? 'textarea' : 'input')
    field.className = 'vive-math-field'
    field.value = this.latex
    field.spellcheck = false
    field.setAttribute('aria-label', this.settings.labels.edit)
    field.setAttribute('maxlength', '2000')
    const preview = document.createElement(this.display ? 'div' : 'span')
    preview.className = 'vive-math-preview'
    preview.setAttribute('aria-hidden', 'true')
    this.field = field
    this.dom.classList.add('is-editing')
    this.dom.replaceChildren(field, preview)
    this.preview(preview)
    field.addEventListener('input', () => {
      window.clearTimeout(this.timer)
      this.timer = window.setTimeout(() => this.preview(preview), PREVIEW_DELAY)
    })
    field.addEventListener('keydown', (event: Event) => {
      if (!(event instanceof KeyboardEvent)) return
      const commit = this.display
        ? event.key === 'Enter' && (event.metaKey || event.ctrlKey)
        : event.key === 'Enter'
      if (commit) {
        event.preventDefault()
        this.close(true)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        this.close(false)
      }
    })
    field.addEventListener('blur', () => this.close(true, false))
    field.focus()
  }

  private preview(target: HTMLElement): void {
    const latex = cleanLatex(this.field?.value ?? '')
    if (this.katex && latex) renderLatex(this.katex, target, latex, this.display)
    else target.replaceChildren()
  }

  private close(save: boolean, refocus = true): void {
    const field = this.field
    if (!field) return
    this.field = null
    window.clearTimeout(this.timer)
    this.dom.classList.remove('is-editing')
    const pos = this.getPos()
    const latex = save ? (cleanLatex(field.value.trim()) ?? this.latex) : this.latex
    this.render()
    if (pos === undefined || !this.view.editable || this.destroyed) return
    const { state } = this.view
    const transaction = state.tr
    if (latex === '') {
      transaction.delete(pos, pos + this.node.nodeSize)
    } else if (save) {
      if (latex !== this.latex) transaction.setNodeMarkup(pos, undefined, { latex })
      const after = pos + this.node.nodeSize
      transaction.setSelection(TextSelection.near(transaction.doc.resolve(after)))
    } else {
      transaction.setSelection(NodeSelection.create(state.doc, pos))
    }
    this.view.dispatch(transaction.scrollIntoView())
    if (refocus) this.view.focus()
  }

  private render(): void {
    const latex = this.latex
    this.dom.classList.toggle('is-empty', latex === '')
    if (latex === '') {
      this.dom.textContent = this.settings.labels.empty
      return
    }
    if (this.katex && renderLatex(this.katex, this.dom, latex, this.display)) return
    const source = document.createElement('code')
    source.className = 'vive-math-source'
    source.textContent = this.display ? latex : `$${latex}$`
    this.dom.replaceChildren(source)
  }
}
