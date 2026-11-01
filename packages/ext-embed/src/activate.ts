import { buildEmbedSrc, cleanEmbed, embedProvider, iframeAttributes } from './providers.js'

export interface ActivateOptions {
  providers?: readonly string[]
}

export function activateEmbeds(root: ParentNode = document, options: ActivateOptions = {}): void {
  for (const wrapper of root.querySelectorAll<HTMLElement>('div[data-embed][data-id]')) {
    const link = wrapper.querySelector('a')
    if (!link || wrapper.dataset.activated) continue
    wrapper.dataset.activated = ''
    link.addEventListener('click', (event) => {
      const embed = cleanEmbed(
        {
          provider: wrapper.dataset.embed,
          id: wrapper.dataset.id,
          hash: wrapper.dataset.hash,
          start: wrapper.dataset.start,
          title: wrapper.dataset.title,
        },
        options.providers,
      )
      const provider = embed && embedProvider(embed.provider)
      const src = embed && buildEmbedSrc(embed, { autoplay: true })
      if (!embed || !provider || !src) return
      event.preventDefault()
      const frame = document.createElement('iframe')
      const values = iframeAttributes(embed, provider, src, true)
      for (const [name, value] of Object.entries(values)) frame.setAttribute(name, value)
      frame.removeAttribute('loading')
      link.replaceWith(frame)
      frame.focus()
    })
  }
}
