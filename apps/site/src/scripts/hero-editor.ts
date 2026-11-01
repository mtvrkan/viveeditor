import {
  basicExtensions,
  createUI,
  Editor,
  listExtensions,
  measureText,
  type ReadabilityFormula,
  type TextMeasure,
} from 'viveeditor'
import 'viveeditor/style.css'
import { type PluralForms, plural } from '../i18n/plural'
import { followSiteTheme, siteTheme } from './theme'

type MeterLabels = {
  bands: string[]
  minutes: PluralForms
  formula: ReadabilityFormula
  label: string
}

export async function mountHero(stage: HTMLElement): Promise<void> {
  const host = stage.querySelector<HTMLElement>('[data-hero-editor]')
  if (!host) return
  const labels = JSON.parse(stage.dataset.labels ?? '{}') as MeterLabels
  const locale = stage.dataset.lang ?? 'en'
  const content = [...host.querySelectorAll('p')].map((p) => `<p>${p.innerHTML}</p>`).join('')
  const numbers = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const field = (key: string) => stage.querySelector<HTMLElement>(`[data-k="${key}"]`)
  const chip = stage.querySelector<HTMLElement>('.chip')
  const hint = stage.querySelector<HTMLElement>('.hint')
  const bars = [...stage.querySelectorAll<HTMLElement>('.scale i')]

  const render = (measure: TextMeasure) => {
    const score = field('score')
    const next = measure.score === null ? '–' : String(measure.score)
    if (score && score.textContent !== next) {
      score.textContent = next
      score.classList.remove('tick')
      void score.offsetWidth
      score.classList.add('tick')
    }
    const words = field('words')
    if (words) words.textContent = numbers.format(measure.words)
    const sentences = field('sentences')
    if (sentences) sentences.textContent = numbers.format(measure.sentences)
    const average = field('average')
    if (average) average.textContent = numbers.format(measure.averageSentence)
    const reading = field('reading')
    if (reading) reading.textContent = plural(locale, labels.minutes, measure.readingMinutes)
    const band = measure.band
    if (chip) {
      chip.hidden = band === null
      chip.textContent = band === null ? '' : (labels.bands[band] ?? '')
      if (band === null) delete chip.dataset.band
      else chip.dataset.band = String(band)
    }
    if (hint) hint.hidden = measure.score !== null
    bars.forEach((bar, index) => {
      bar.classList.toggle('on', band !== null && index < band)
      bar.classList.toggle('cur', band === index)
    })
  }

  host.replaceChildren()
  const editor = await Editor.create(host, {
    extensions: [...basicExtensions, ...listExtensions],
    content,
    label: labels.label,
  })
  const ui = createUI(editor, {
    locale,
    theme: siteTheme(),
    files: false,
    slash: false,
    source: false,
    readability: labels.formula,
  })
  const stopTheme = followSiteTheme(ui.root)
  editor.on('destroy', stopTheme)
  let timer = 0
  editor.on('change', () => {
    clearTimeout(timer)
    timer = window.setTimeout(() => render(measureText(editor.getText(), labels.formula)), 120)
  })
  render(measureText(editor.getText(), labels.formula))
}
