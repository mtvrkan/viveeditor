import type { Node as ProseMirrorNode } from 'prosemirror-model'
import { NodeSelection } from 'prosemirror-state'
import type { EditorView, NodeView, ViewMutationRecord } from 'prosemirror-view'
import {
  buildEmbedSrc,
  cleanEmbed,
  type EmbedAttributes,
  type EmbedProvider,
  embedProvider,
  iframeAttributes,
} from './providers.js'

export interface EmbedViewSettings {
  providers: readonly string[]
  labels: { play: string; invalid: string }
}

const SVG = 'http://www.w3.org/2000/svg'

function playIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS(SVG, 'path')
  path.setAttribute('d', 'M8 5.5v13l11-6.5z')
  svg.append(path)
  return svg
}

export class EmbedView implements NodeView {
  readonly dom: HTMLElement
  private embed: EmbedAttributes | null = null
  private playing = false

  constructor(
    private node: ProseMirrorNode,
    private readonly view: EditorView,
    private readonly getPos: () => number | undefined,
    private readonly settings: EmbedViewSettings,
  ) {
    this.dom = document.createElement('div')
    this.dom.contentEditable = 'false'
    this.render()
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false
    const same =
      node.attrs.provider === this.node.attrs.provider && node.attrs.id === this.node.attrs.id
    this.node = node
    if (!same) this.playing = false
    if (!this.playing) this.render()
    return true
  }

  stopEvent(event: Event): boolean {
    return event.target instanceof Element && event.target.closest('button, iframe') !== null
  }

  ignoreMutation(mutation: ViewMutationRecord): boolean {
    return mutation.type !== 'selection'
  }

  private render(): void {
    this.embed = cleanEmbed(this.node.attrs, this.settings.providers)
    const provider = this.embed && embedProvider(this.embed.provider)
    this.dom.className = 'vive-embed'
    this.dom.replaceChildren()
    if (!this.embed || !provider) {
      this.dom.classList.add('is-invalid')
      this.dom.textContent = this.settings.labels.invalid
      return
    }
    const embed = this.embed
    this.dom.dataset.provider = provider.name
    const height = provider.height(embed.id)
    this.dom.style.setProperty(
      '--vive-embed-ratio',
      provider.fluid ? `${provider.width} / ${height}` : 'auto',
    )
    this.dom.style.setProperty('--vive-embed-height', provider.fluid ? 'auto' : `${height}px`)
    const title = embed.title ?? provider.label
    const play = document.createElement('button')
    play.type = 'button'
    play.className = 'vive-embed-play'
    play.setAttribute('aria-label', `${this.settings.labels.play}: ${title} (${provider.label})`)
    play.append(playIcon())
    play.addEventListener('click', (event) => {
      event.preventDefault()
      this.play(embed, provider)
    })
    const meta = document.createElement('span')
    meta.className = 'vive-embed-meta'
    const name = document.createElement('span')
    name.className = 'vive-embed-provider'
    name.textContent = provider.label
    const caption = document.createElement('span')
    caption.className = 'vive-embed-title'
    caption.textContent = embed.title ?? ''
    meta.append(name, caption)
    this.dom.append(play, meta)
  }

  private play(embed: EmbedAttributes, provider: EmbedProvider): void {
    const src = buildEmbedSrc(embed, { autoplay: true, enabled: this.settings.providers })
    if (!src) return
    const frame = document.createElement('iframe')
    for (const [name, value] of Object.entries(iframeAttributes(embed, provider, src, true))) {
      frame.setAttribute(name, value)
    }
    frame.removeAttribute('loading')
    this.playing = true
    this.dom.classList.add('is-playing')
    this.dom.replaceChildren(frame)
    const pos = this.getPos()
    if (pos !== undefined && this.view.editable) {
      const { state } = this.view
      this.view.dispatch(state.tr.setSelection(NodeSelection.create(state.doc, pos)))
    }
  }
}
