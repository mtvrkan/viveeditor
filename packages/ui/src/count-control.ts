import type { CommandAccess } from './commands.js'
import { placeInDock } from './dom.js'
import type { Listen } from './lifecycle.js'
import {
  createTextMeasurer,
  measureText,
  type ReadabilityFormula,
  type TextMeasure,
} from './measure.js'
import { createMeasurePanel } from './measure-panel.js'
import { format, type Locale, type Messages } from './messages.js'
import type { Toolbar } from './toolbar.js'

const MEASURE_DELAY = 150

export interface CountControlOptions {
  readText: () => string
  commands: CommandAccess
  messages: Messages
  locale: Locale
  formula: ReadabilityFormula | false
  toolbar: Toolbar
  dock: HTMLElement
  status: HTMLElement
  listen: Listen
  closeFloating: () => void
}

export interface CountControl {
  readonly panel: HTMLElement
  close(returnFocus: boolean): void
  updateLimit(): void
  updateMeasure(): void
  measureLater(): void
  cancel(): void
}

export function createCountControl(options: CountControlOptions): CountControl {
  const { commands, messages, locale, formula, toolbar, dock, status, listen } = options
  const { countButton } = toolbar
  const numbers = new Intl.NumberFormat(locale)
  const measurePanel = createMeasurePanel(messages, locale, formula)
  const measureAll = createTextMeasurer(formula || 'atesman')
  let measure: TextMeasure = measureText('', formula || 'atesman')
  let limitState = ''
  let measureTimer = 0

  const isOpen = (): boolean => !measurePanel.element.hidden
  const close = (returnFocus: boolean): void => {
    if (!isOpen()) return
    measurePanel.element.hidden = true
    countButton.setAttribute('aria-expanded', 'false')
    if (returnFocus) countButton.focus()
  }
  const open = (): void => {
    options.closeFloating()
    measurePanel.render(measure)
    measurePanel.element.hidden = false
    countButton.setAttribute('aria-expanded', 'true')
    placeInDock(measurePanel.element, countButton, dock)
    measurePanel.element.focus()
  }

  const characterLimit = (): number | null => {
    const limit = commands.query('characterLimit')
    return typeof limit === 'number' ? limit : null
  }

  const updateLimit = (): void => {
    const limit = characterLimit()
    if (limit === null) return
    const used = Number(commands.query('characterCount')) || 0
    const values = { count: numbers.format(used), limit: numbers.format(limit) }
    toolbar.countText.textContent = `${values.count}/${values.limit}`
    toolbar.countUnit.textContent = messages.charactersUnit
    countButton.setAttribute(
      'aria-label',
      `${format(messages.charactersOf, values)}. ${messages.measure}`,
    )
    const state = used >= limit ? 'full' : used >= limit * 0.9 ? 'near' : ''
    if (state === limitState) return
    if (state === 'full') status.textContent = messages.limitReached
    else if (limitState === 'full') status.textContent = ''
    limitState = state
    if (state) countButton.dataset.limit = state
    else delete countButton.dataset.limit
  }

  const updateMeasure = (): void => {
    measure = measureAll(options.readText())
    if (characterLimit() === null) {
      const label = format(messages.words, { count: numbers.format(measure.words) })
      toolbar.countText.textContent = numbers.format(measure.words)
      countButton.setAttribute('aria-label', `${label}. ${messages.measure}`)
    }
    if (isOpen()) measurePanel.render(measure)
  }

  listen(countButton, 'click', () => (isOpen() ? close(true) : open()))
  listen(measurePanel.element, 'keydown', (event) => {
    if ((event as KeyboardEvent).key !== 'Escape') return
    event.preventDefault()
    close(true)
  })

  return {
    panel: measurePanel.element,
    close,
    updateLimit,
    updateMeasure,
    measureLater: () => {
      window.clearTimeout(measureTimer)
      measureTimer = window.setTimeout(updateMeasure, MEASURE_DELAY)
    },
    cancel: () => window.clearTimeout(measureTimer),
  }
}
