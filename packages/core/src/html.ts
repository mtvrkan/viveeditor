import { type DOMOutputSpec, DOMSerializer, type Fragment, type Schema } from 'prosemirror-model'

const STYLE_ATTRIBUTE = 'data-vive-style'

type Render = (value: never, inline: boolean) => DOMOutputSpec
type Renderers = Record<string, Render>
type Types = Readonly<Record<string, { spec: Readonly<Record<string, unknown>> }>>

const isAttributeObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !('nodeType' in value) &&
  !('dom' in value)

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/ /g, '&nbsp;').replace(/"/g, '&quot;')

function deferStyles(spec: DOMOutputSpec, styles: string[], token: string): DOMOutputSpec {
  if (!Array.isArray(spec)) return spec
  return (spec as unknown[]).map((part, index) => {
    if (index === 0) return part
    if (Array.isArray(part)) return deferStyles(part as unknown as DOMOutputSpec, styles, token)
    if (index !== 1 || !isAttributeObject(part) || typeof part.style !== 'string') return part
    const attributes: Record<string, unknown> = {}
    for (const [name, value] of Object.entries(part)) {
      if (name === 'style') {
        attributes[STYLE_ATTRIBUTE] = `${token}-${styles.length}`
        styles.push(value as string)
      } else attributes[name] = value
    }
    return attributes
  }) as unknown as DOMOutputSpec
}

function wrap(renderers: Renderers, types: Types, styles: string[], token: string): Renderers {
  return Object.fromEntries(
    Object.entries(renderers).map(([name, render]) => [
      name,
      types[name]?.spec.verbatimStyle === true
        ? (value: never, inline: boolean) => deferStyles(render(value, inline), styles, token)
        : render,
    ]),
  )
}

const randomToken = (): string =>
  Array.from(crypto.getRandomValues(new Uint32Array(2)), (part) => part.toString(36)).join('')

export function serializeHtml(schema: Schema, fragment: Fragment): string {
  const styles: string[] = []
  const token = randomToken()
  const serializer = new DOMSerializer(
    wrap(DOMSerializer.nodesFromSchema(schema) as Renderers, schema.nodes, styles, token) as never,
    wrap(DOMSerializer.marksFromSchema(schema) as Renderers, schema.marks, styles, token) as never,
  )
  const container = document.createElement('div')
  container.append(serializer.serializeFragment(fragment))
  if (styles.length === 0) return container.innerHTML
  const placeholder = new RegExp(` ${STYLE_ATTRIBUTE}="${token}-(\\d+)"`, 'g')
  return container.innerHTML.replace(
    placeholder,
    (_match, index: string) => ` style="${escapeAttribute(styles[Number(index)] ?? '')}"`,
  )
}
