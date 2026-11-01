import { describe, expect, it } from 'vitest'
import { measureText } from '../src/index.js'
import { createTextMeasurer } from '../src/measure.js'

describe('measureText', () => {
  it('scores Turkish text with the Ateşman formula', () => {
    const text = 'Bu bir deneme cümlesidir. Kısa ve anlaşılır yazmak önemlidir. Okur yorulmaz.'

    const result = measureText(text, 'atesman')

    expect(result.words).toBe(11)
    expect(result.sentences).toBe(3)
    expect(result.syllables).toBe(27)
    expect(result.score).toBe(91)
    expect(result.band).toBe(4)
    expect(result.readingMinutes).toBe(1)
  })

  it('counts dotted capital İ and circumflex vowels as Turkish syllables', () => {
    const result = measureText('İstanbul kâğıt', 'atesman')

    expect(result.syllables).toBe(5)
  })

  it('treats each line as its own sentence so headings and list items count', () => {
    const result = measureText('Başlık\nBirinci madde\nİkinci madde', 'atesman')

    expect(result.sentences).toBe(3)
  })

  it('returns no score below ten words', () => {
    const result = measureText('Merhaba dünya.', 'atesman')

    expect(result.words).toBe(2)
    expect(result.score).toBeNull()
    expect(result.band).toBeNull()
  })

  it('returns zeros for empty text', () => {
    const result = measureText('   ', 'flesch')

    expect(result).toMatchObject({ words: 0, sentences: 0, readingMinutes: 0, score: null })
  })

  it('clamps the Flesch score for very simple English into 0..100', () => {
    const text = 'The cat sat. The dog ran. We all had fun in the sun.'

    const result = measureText(text, 'flesch')

    expect(result.words).toBe(13)
    expect(result.score).toBe(100)
    expect(result.band).toBe(4)
  })
})

describe('createTextMeasurer', () => {
  const lines = Array.from(
    { length: 50 },
    (_, index) => `Satır ${index} kısa bir cümledir. Okunur!`,
  )

  it('gives the same result as a fresh measure after one line changes', () => {
    const measure = createTextMeasurer('atesman')
    measure(lines.join('\n'))
    const edited = [...lines]
    edited[25] = 'Değişen satır artık çok daha uzun bir cümle oldu ve bitmedi'

    const result = measure(edited.join('\n'))

    expect(result).toEqual(measureText(edited.join('\n'), 'atesman'))
  })

  it('counts a repeated line every time it appears', () => {
    const measure = createTextMeasurer('flesch')

    const result = measure('Same line.\nSame line.\nSame line.')

    expect(result.words).toBe(6)
    expect(result.sentences).toBe(3)
  })

  it('drops removed lines from the totals', () => {
    const measure = createTextMeasurer('atesman')
    measure(lines.join('\n'))

    const result = measure('')

    expect(result).toMatchObject({ words: 0, sentences: 0, characters: 0, score: null })
  })
})
