import type { Locale } from '../messages.js'

export interface ExtrasMessages {
  mentionTitle: string
  emojiTitle: string
  loading: string
  noResults: string
  results: string
  template: string
  math: string
  mathBlock: string
  footnote: string
  ai: string
  aiTitle: string
  aiInstruction: string
  aiSend: string
  aiStop: string
  aiReplace: string
  aiInsert: string
  aiRetry: string
  aiDiscard: string
  aiWorking: string
  aiDone: string
  aiFailed: string
  aiTooLong: string
  aiEmptySelection: string
  aiChanged: string
  aiImprove: string
  aiFix: string
  aiShorten: string
  aiExpand: string
  aiTone: string
  aiTranslate: string
  aiSummarize: string
  aiContinue: string
}

export const EXTRAS_MESSAGES: Record<Locale, ExtrasMessages> = {
  tr: {
    mentionTitle: 'Kişiler',
    emojiTitle: 'Emoji',
    loading: 'Yükleniyor…',
    noResults: 'Sonuç yok',
    results: '{count} sonuç',
    template: 'Şablon',
    math: 'Formül',
    mathBlock: 'Blok formül',
    footnote: 'Dipnot',
    ai: 'Yapay zekâ',
    aiTitle: 'Yapay zekâ yardımı',
    aiInstruction: 'Ne yapılsın?',
    aiSend: 'Gönder',
    aiStop: 'Durdur',
    aiReplace: 'Seçimin yerine koy',
    aiInsert: 'Altına ekle',
    aiRetry: 'Yeniden dene',
    aiDiscard: 'Vazgeç',
    aiWorking: 'Yazılıyor…',
    aiDone: 'Öneri hazır',
    aiFailed: 'Öneri alınamadı. Yeniden deneyin.',
    aiTooLong: 'Seçim çok uzun. Daha kısa bir bölüm seçin.',
    aiEmptySelection: 'Önce bir metin seçin.',
    aiChanged: 'Metin değişti; öneriyi altına ekleyebilirsiniz.',
    aiImprove: 'Daha iyi yaz',
    aiFix: 'Yazım ve dil bilgisini düzelt',
    aiShorten: 'Kısalt',
    aiExpand: 'Uzat',
    aiTone: 'Tonu değiştir',
    aiTranslate: 'Çevir',
    aiSummarize: 'Özetle',
    aiContinue: 'Devam ettir',
  },
  en: {
    mentionTitle: 'People',
    emojiTitle: 'Emoji',
    loading: 'Loading…',
    noResults: 'No results',
    results: '{count} results',
    template: 'Template',
    math: 'Formula',
    mathBlock: 'Block formula',
    footnote: 'Footnote',
    ai: 'AI',
    aiTitle: 'AI assistant',
    aiInstruction: 'What should it do?',
    aiSend: 'Send',
    aiStop: 'Stop',
    aiReplace: 'Replace selection',
    aiInsert: 'Insert below',
    aiRetry: 'Try again',
    aiDiscard: 'Discard',
    aiWorking: 'Writing…',
    aiDone: 'Suggestion ready',
    aiFailed: 'Could not get a suggestion. Try again.',
    aiTooLong: 'The selection is too long. Select a shorter part.',
    aiEmptySelection: 'Select some text first.',
    aiChanged: 'The text changed; you can still insert the suggestion below.',
    aiImprove: 'Improve writing',
    aiFix: 'Fix spelling and grammar',
    aiShorten: 'Make shorter',
    aiExpand: 'Make longer',
    aiTone: 'Change tone',
    aiTranslate: 'Translate',
    aiSummarize: 'Summarize',
    aiContinue: 'Continue writing',
  },
}

export const extrasMessages = (
  locale: Locale,
  overrides: Partial<ExtrasMessages> = {},
): ExtrasMessages => ({ ...EXTRAS_MESSAGES[locale], ...overrides })
