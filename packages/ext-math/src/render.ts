import { cleanLatex, type KatexLoader, katexLoader, type MathError, renderLatex } from './katex.js'

export interface RenderMathOptions {
  load: KatexLoader
  onError?: (error: MathError) => void
}

const MAX_FORMULAS = 1000
const BATCH = 50

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
    else setTimeout(resolve, 0)
  })

export async function renderMath(root: ParentNode, options: RenderMathOptions): Promise<number> {
  const elements = Array.from(
    root.querySelectorAll<HTMLElement>(
      'span[data-math="inline"]:not([data-rendered]), div[data-math="block"]:not([data-rendered])',
    ),
  ).slice(0, MAX_FORMULAS)
  if (elements.length === 0) return 0
  const katex = await katexLoader(options.load, (error) => options.onError?.(error))()
  if (!katex) return 0
  let rendered = 0
  for (let index = 0; index < elements.length; index++) {
    if (index > 0 && index % BATCH === 0) await nextFrame()
    const element = elements[index]
    if (!element) continue
    const latex = cleanLatex(element.textContent?.trim() ?? '')
    const display = element.dataset.math === 'block'
    if (!latex || !renderLatex(katex, element, latex, display)) continue
    element.dataset.rendered = ''
    element.setAttribute('aria-label', latex)
    element.classList.add('vive-math')
    rendered++
  }
  return rendered
}
