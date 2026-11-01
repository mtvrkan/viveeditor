export interface KatexLike {
  readonly version: string
  render(latex: string, element: HTMLElement, options: Readonly<Record<string, unknown>>): void
}

export type KatexModule = KatexLike | { default: KatexLike }

export type KatexLoader = () => Promise<KatexModule>

export type MathErrorCode = 'KATEX_OUTDATED' | 'KATEX_LOAD'

export interface MathError {
  code: MathErrorCode
  version?: string
}

export const MIN_KATEX_VERSION = '0.18.2'
export const MAX_LATEX_LENGTH = 2000
const MAX_DEPTH = 64

const optionsFor = (displayMode: boolean): Readonly<Record<string, unknown>> =>
  Object.freeze({
    displayMode,
    throwOnError: false,
    trust: false,
    strict: 'ignore',
    maxSize: 50,
    maxExpand: 1000,
    output: 'htmlAndMathml',
  })

const INLINE = optionsFor(false)
const DISPLAY = optionsFor(true)

export function isSupportedKatex(version: unknown): boolean {
  if (typeof version !== 'string') return false
  const actual = version.split('.').map(Number)
  const minimum = MIN_KATEX_VERSION.split('.').map(Number)
  for (let index = 0; index < minimum.length; index++) {
    const part = actual[index] ?? 0
    const floor = minimum[index] ?? 0
    if (!Number.isInteger(part)) return false
    if (part !== floor) return part > floor
  }
  return true
}

export function cleanLatex(value: unknown): string | null {
  if (typeof value !== 'string') return null
  if (Array.from(value).length > MAX_LATEX_LENGTH) return null
  let depth = 0
  for (const character of value) {
    if (character === '{') depth++
    else if (character === '}') depth = Math.max(0, depth - 1)
    if (depth > MAX_DEPTH) return null
  }
  return value
}

export function katexLoader(
  load: KatexLoader | null,
  report: (error: MathError) => void,
): () => Promise<KatexLike | null> {
  let pending: Promise<KatexLike | null> | null = null
  return () => {
    if (!load) return Promise.resolve(null)
    pending ??= load().then(
      (module) => {
        const katex = 'default' in module ? module.default : module
        if (!isSupportedKatex(katex?.version) || typeof katex.render !== 'function') {
          report({ code: 'KATEX_OUTDATED', version: String(katex?.version ?? '') })
          return null
        }
        return katex
      },
      () => {
        report({ code: 'KATEX_LOAD' })
        pending = null
        return null
      },
    )
    return pending
  }
}

export function renderLatex(
  katex: KatexLike,
  target: HTMLElement,
  latex: string,
  display: boolean,
): boolean {
  const output = document.createElement('span')
  try {
    katex.render(latex, output, display ? DISPLAY : INLINE)
  } catch {
    return false
  }
  target.replaceChildren(output)
  return true
}
