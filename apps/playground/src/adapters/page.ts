import 'viveeditor/style.css'
import '../ui-page.css'

export const START_VALUE = '<p>İlk metin</p>'
export const SAMPLE_VALUE = '<h2>Örnek başlık</h2><p>Dışarıdan yüklenen metin.</p>'
export const LABEL = 'Makale metni'

export interface PageParts {
  host: HTMLElement
  output: HTMLElement
  sample: HTMLButtonElement
}

export function pageParts(): PageParts {
  const host = document.querySelector<HTMLElement>('[data-testid="editor"]')
  const output = document.querySelector<HTMLElement>('[data-testid="output"]')
  const sample = document.querySelector<HTMLButtonElement>('[data-testid="set-value"]')
  if (!host || !output || !sample) throw new Error('Adapter page markup is incomplete.')
  return { host, output, sample }
}
