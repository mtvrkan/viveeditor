export type ReadabilityFormula = 'atesman' | 'flesch'

export type ReadabilityBand = 0 | 1 | 2 | 3 | 4

export interface TextMeasure {
  words: number
  characters: number
  sentences: number
  syllables: number
  averageSentence: number
  readingMinutes: number
  score: number | null
  band: ReadabilityBand | null
}

export const MIN_WORDS_FOR_SCORE = 10

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu
const SENTENCE_BREAK = /[.!?…]+(?=\s|$)|\n+/u
const TURKISH_VOWELS = /[aeıioöuüâîûİ]/giu
const WORDS_PER_MINUTE = 200

function turkishSyllables(word: string): number {
  return Math.max(1, word.match(TURKISH_VOWELS)?.length ?? 0)
}

function englishSyllables(word: string): number {
  const stripped = word
    .toLowerCase()
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '')
  return Math.max(1, stripped.match(/[aeiouy]{1,2}/g)?.length ?? 0)
}

function bandOf(score: number, formula: ReadabilityFormula): ReadabilityBand {
  const limits = formula === 'atesman' ? [30, 50, 70, 90] : [30, 50, 60, 80]
  let band = 0
  for (const limit of limits) if (score >= limit) band += 1
  return band as ReadabilityBand
}

interface LineCounts {
  words: number
  syllables: number
  characters: number
  sentences: number
}

function countLine(line: string, formula: ReadabilityFormula): LineCounts {
  const words = line.match(WORD) ?? []
  const syllableOf = formula === 'atesman' ? turkishSyllables : englishSyllables
  return {
    words: words.length,
    syllables: words.reduce((total, word) => total + syllableOf(word), 0),
    characters: [...line.replace(/\s/g, '')].length,
    sentences: line.split(SENTENCE_BREAK).filter((part) => /[\p{L}\p{N}]/u.test(part)).length,
  }
}

function summarize(totals: LineCounts, formula: ReadabilityFormula): TextMeasure {
  const { words: count, syllables, characters, sentences } = totals
  const sentenceCount = Math.max(sentences, count > 0 ? 1 : 0)
  const averageSentence = sentenceCount === 0 ? 0 : count / sentenceCount
  let score: number | null = null
  if (count >= MIN_WORDS_FOR_SCORE) {
    const perWord = syllables / count
    const raw =
      formula === 'atesman'
        ? 198.825 - 40.175 * perWord - 2.61 * averageSentence
        : 206.835 - 1.015 * averageSentence - 84.6 * perWord
    score = Math.round(Math.min(100, Math.max(0, raw)))
  }
  return {
    words: count,
    characters,
    sentences: sentenceCount,
    syllables,
    averageSentence,
    readingMinutes: count === 0 ? 0 : Math.max(1, Math.ceil(count / WORDS_PER_MINUTE)),
    score,
    band: score === null ? null : bandOf(score, formula),
  }
}

export function createTextMeasurer(
  formula: ReadabilityFormula = 'atesman',
): (text: string) => TextMeasure {
  let cache = new Map<string, LineCounts>()
  return (text) => {
    const next = new Map<string, LineCounts>()
    const totals: LineCounts = { words: 0, syllables: 0, characters: 0, sentences: 0 }
    for (const line of text.split('\n')) {
      const counts = next.get(line) ?? cache.get(line) ?? countLine(line, formula)
      next.set(line, counts)
      totals.words += counts.words
      totals.syllables += counts.syllables
      totals.characters += counts.characters
      totals.sentences += counts.sentences
    }
    cache = next
    return summarize(totals, formula)
  }
}

export function measureText(text: string, formula: ReadabilityFormula = 'atesman'): TextMeasure {
  return createTextMeasurer(formula)(text)
}
