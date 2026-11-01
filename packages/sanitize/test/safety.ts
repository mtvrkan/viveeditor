import { type DefaultTreeAdapterMap, parseFragment, defaultTreeAdapter as tree } from 'parse5'
import { VIVE_PROFILE } from '../src/index.js'

type ParentNode = DefaultTreeAdapterMap['parentNode']

const ALLOWED_TAGS = new Set([...Object.keys(VIVE_PROFILE.elements), 'iframe'])
const EMBED_HOSTS = Object.values(VIVE_PROFILE.embedProviders).map(
  (rule) => `https://${rule.host}/`,
)
const UNSAFE_URL = /^\s*(?:javascript|vbscript|data:(?!image\/(?:png|jpeg|gif|webp|avif);))/i

export function unsafeParts(html: string): string[] {
  const problems: string[] = []
  const visit = (parent: ParentNode, insideEmbed: boolean): void => {
    for (const child of parent.childNodes) {
      if (!tree.isElementNode(child)) continue
      const names = child.attrs.map((attribute) => attribute.name)
      if (!ALLOWED_TAGS.has(child.tagName)) problems.push(`tag ${child.tagName}`)
      if (names.some((name) => name.startsWith('on'))) problems.push(`handler on ${child.tagName}`)
      if (names.some((name) => ['id', 'name', 'form', 'srcdoc'].includes(name))) {
        problems.push(`clobbering on ${child.tagName}`)
      }
      for (const { name, value } of child.attrs) {
        if ((name === 'href' || name === 'src') && UNSAFE_URL.test(value)) problems.push(value)
      }
      if (child.tagName === 'iframe') {
        const src = child.attrs.find((attribute) => attribute.name === 'src')?.value ?? ''
        if (!insideEmbed || !EMBED_HOSTS.some((host) => src.startsWith(host))) {
          problems.push(`iframe ${src}`)
        }
      }
      const embed = child.attrs.some(
        (attribute) => attribute.name === 'class' && attribute.value === 'vive-embed',
      )
      visit(child, embed)
    }
  }
  visit(parseFragment(html), false)
  return problems
}
