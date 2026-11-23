export interface DocumentMessages {
  outlineEmpty: string
  outlineUntitled: string
  checkNone: string
  checkCount: string
  checkShow: string
  checkAgain: string
  checkImageAlt: string
  checkHeadingEmpty: string
  checkHeadingSkip: string
  checkLinkText: string
  checkTableHeader: string
  checkEmbedTitle: string
  checkContrast: string
  shortcutsText: string
  shortcutsParagraph: string
  shortcutsEditing: string
  shortcutsMove: string
  shortcutToolbar: string
  shortcutLeave: string
  shortcutSlash: string
  shortcutBreak: string
  shortcutCase: string
  shortcutBigger: string
  shortcutSmaller: string
  shortcutHelp: string
}

const tr: DocumentMessages = {
  outlineEmpty:
    'Belgede başlık yok. Satırın başına # yazarak ya da blok menüsünden başlık ekleyebilirsiniz.',
  outlineUntitled: '(Boş başlık)',
  checkNone: 'Erişilebilirlik sorunu bulunamadı.',
  checkCount: '{count} sorun bulundu',
  checkShow: 'Göster',
  checkAgain: 'Yeniden denetle',
  checkImageAlt: 'Görselin alternatif metni yok',
  checkHeadingEmpty: 'Başlık boş',
  checkHeadingSkip: 'Başlık düzeyi atlanmış: H{from} sonrası H{to}',
  checkLinkText: 'Bağlantı metni nereye gittiğini anlatmıyor',
  checkTableHeader: 'Tabloda başlık hücresi yok',
  checkEmbedTitle: 'Videonun başlığı yok',
  checkContrast: 'Yazı rengi zor okunuyor ({ratio}:1, en az 4.5:1 olmalı)',
  shortcutsText: 'Metin',
  shortcutsParagraph: 'Paragraf',
  shortcutsEditing: 'Düzenleme',
  shortcutsMove: 'Gezinme',
  shortcutToolbar: 'Araç çubuğuna geç',
  shortcutLeave: 'Kod bloğundan ya da tablodan çık',
  shortcutSlash: 'Blok menüsünü aç (satır başında)',
  shortcutBreak: 'Satır sonu',
  shortcutCase: 'Büyük-küçük harf değiştir',
  shortcutBigger: 'Yazıyı büyüt',
  shortcutSmaller: 'Yazıyı küçült',
  shortcutHelp: 'Bu listeyi aç',
}

const en: DocumentMessages = {
  outlineEmpty:
    'This document has no headings. Type # at the start of a line or use the block menu to add one.',
  outlineUntitled: '(Empty heading)',
  checkNone: 'No accessibility problems found.',
  checkCount: 'Problems found: {count}',
  checkShow: 'Show',
  checkAgain: 'Check again',
  checkImageAlt: 'Image has no alt text',
  checkHeadingEmpty: 'Heading is empty',
  checkHeadingSkip: 'Heading level skipped: H{to} after H{from}',
  checkLinkText: 'Link text does not say where it goes',
  checkTableHeader: 'Table has no header cells',
  checkEmbedTitle: 'Video has no title',
  checkContrast: 'Text colour is hard to read ({ratio}:1, needs at least 4.5:1)',
  shortcutsText: 'Text',
  shortcutsParagraph: 'Paragraphs',
  shortcutsEditing: 'Editing',
  shortcutsMove: 'Navigation',
  shortcutToolbar: 'Move to the toolbar',
  shortcutLeave: 'Leave a code block or table',
  shortcutSlash: 'Open the block menu (at line start)',
  shortcutBreak: 'Line break',
  shortcutCase: 'Change letter case',
  shortcutBigger: 'Larger text',
  shortcutSmaller: 'Smaller text',
  shortcutHelp: 'Open this list',
}

export function documentMessages(
  locale: string,
  overrides: Readonly<Record<string, unknown>> = {},
): DocumentMessages {
  const base = locale === 'tr' ? tr : en
  const result = { ...base }
  for (const key of Object.keys(base) as (keyof DocumentMessages)[]) {
    const value = overrides[key]
    if (typeof value === 'string') result[key] = value
  }
  return result
}
