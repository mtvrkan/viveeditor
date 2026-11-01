import { h } from './dom.js'
import type { ReadabilityFormula, TextMeasure } from './measure.js'
import { format, type Locale, type Messages } from './messages.js'

export interface MeasurePanel {
  readonly element: HTMLElement
  render(measure: TextMeasure): void
}

export function createMeasurePanel(
  messages: Messages,
  locale: Locale,
  formula: ReadabilityFormula | false,
): MeasurePanel {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 })
  const value = h('span', { class: 've-numeral' })
  const chip = h('span', { class: 've-chip' })
  const note = h('p', { class: 've-hint', 'data-tone': 'info' })
  const scale = h(
    'div',
    { class: 've-scale', 'aria-hidden': 'true' },
    [0, 1, 2, 3, 4].map(() => h('span')),
  )
  const stat = (): HTMLElement => h('dd')
  const words = stat()
  const sentences = stat()
  const average = stat()
  const reading = stat()
  const readability =
    formula === false
      ? null
      : h('div', { class: 've-readability' }, [
          h('div', { class: 've-eyebrow' }, [
            `${messages.readability} · ${formula === 'atesman' ? messages.atesman : messages.flesch}`,
          ]),
          h('div', { class: 've-big' }, [value, h('span', { class: 've-of' }, ['/100'])]),
          chip,
          scale,
          h('div', { class: 've-scale-labels', 'aria-hidden': 'true' }, [
            h('span', {}, [messages.scaleHard]),
            h('span', {}, [messages.scaleEasy]),
          ]),
          note,
        ])
  const element = h(
    'div',
    {
      class: 've-panel ve-measure ve-glass ve-solid',
      role: 'dialog',
      'aria-label': messages.measure,
      hidden: '',
      tabindex: '-1',
    },
    [
      readability,
      h('dl', { class: 've-stats' }, [
        h('dt', {}, [messages.wordsLabel]),
        words,
        h('dt', {}, [messages.sentences]),
        sentences,
        h('dt', {}, [messages.averageSentence]),
        average,
        h('dt', {}, [messages.readingTime]),
        reading,
      ]),
    ],
  )

  const render = (measure: TextMeasure): void => {
    words.textContent = number.format(measure.words)
    sentences.textContent = number.format(measure.sentences)
    average.textContent = number.format(measure.averageSentence)
    reading.textContent = format(messages.minutes, { count: measure.readingMinutes })
    if (!readability) return
    value.textContent = measure.score === null ? '–' : String(measure.score)
    chip.hidden = measure.band === null
    chip.textContent = measure.band === null ? '' : messages[`band${measure.band}`]
    chip.dataset.band = String(measure.band ?? '')
    note.hidden = measure.score !== null
    note.textContent = measure.score === null ? messages.tooShort : ''
    scale.childNodes.forEach((segment, index) => {
      ;(segment as HTMLElement).classList.toggle('on', index === measure.band)
    })
  }

  return { element, render }
}
