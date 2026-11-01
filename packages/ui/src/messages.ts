export interface Messages {
  toolbar: string
  blockType: string
  paragraph: string
  heading: string
  bold: string
  italic: string
  underline: string
  strike: string
  code: string
  bulletList: string
  orderedList: string
  taskList: string
  blockquote: string
  codeBlock: string
  table: string
  tableInsert: string
  image: string
  imageInsert: string
  imageUpload: string
  imageDropHint: string
  imageUrl: string
  imageAlt: string
  imageAltHint: string
  imageDecorative: string
  imageSize: string
  imageAdd: string
  imageApply: string
  imageUnsafe: string
  imageNeedsUrl: string
  embed: string
  embedInsert: string
  embedUrl: string
  embedTitle: string
  embedTitleHint: string
  embedSupported: string
  embedUnsupported: string
  tableSize: string
  rowAbove: string
  rowBelow: string
  columnLeft: string
  columnRight: string
  mergeCells: string
  splitCell: string
  headerRow: string
  widenColumn: string
  narrowColumn: string
  deleteRow: string
  deleteColumn: string
  deleteTable: string
  search: string
  source: string
  sourceLabel: string
  file: string
  fileOpen: string
  fileSaveDocx: string
  fileSaveMarkdown: string
  fileSaveHtml: string
  filePrint: string
  fileName: string
  fileOpening: string
  fileOpened: string
  fileSaved: string
  fileTooLarge: string
  fileUnsupported: string
  fileDamaged: string
  fileEncrypted: string
  fileLoadFailed: string
  fileImagesDropped: string
  fileContentDropped: string
  fileSaveFailed: string
  filePrintFailed: string
  findLabel: string
  replaceLabel: string
  findPrevious: string
  findNext: string
  matchCase: string
  wholeWord: string
  replaceOne: string
  replaceEvery: string
  searchCount: string
  searchNone: string
  horizontalRule: string
  link: string
  undo: string
  redo: string
  more: string
  panelLoading: string
  panelFailed: string
  panelRetry: string
  selection: string
  slashTitle: string
  slashEmpty: string
  linkDialog: string
  linkLabel: string
  linkApply: string
  linkRemove: string
  linkSafe: string
  linkUnsafe: string
  linkNeedsSelection: string
  words: string
  charactersUnit: string
  charactersOf: string
  limitReached: string
  measure: string
  readability: string
  atesman: string
  flesch: string
  band0: string
  band1: string
  band2: string
  band3: string
  band4: string
  tooShort: string
  wordsLabel: string
  sentences: string
  averageSentence: string
  readingTime: string
  minutes: string
  scaleHard: string
  scaleEasy: string
  glyphBold: string
  glyphItalic: string
  glyphUnderline: string
  align: string
  alignLeft: string
  alignCenter: string
  alignRight: string
  alignJustify: string
  textColor: string
  highlight: string
  colorDefault: string
  highlightNone: string
  colorRed: string
  colorOrange: string
  colorYellow: string
  colorGreen: string
  colorTeal: string
  colorBlue: string
  colorPurple: string
  colorPink: string
  colorGray: string
}

export type MessageKey = keyof Messages

export type Locale = 'tr' | 'en'

const tr: Messages = {
  toolbar: 'Biçimlendirme',
  blockType: 'Paragraf biçimi',
  paragraph: 'Paragraf',
  heading: 'Başlık {level}',
  bold: 'Kalın',
  italic: 'İtalik',
  underline: 'Altı çizili',
  strike: 'Üstü çizili',
  code: 'Satır içi kod',
  bulletList: 'Madde işaretli liste',
  orderedList: 'Numaralı liste',
  taskList: 'Görev listesi',
  blockquote: 'Alıntı',
  codeBlock: 'Kod bloğu',
  table: 'Tablo',
  tableInsert: 'Tablo ekle',
  image: 'Görsel',
  imageInsert: 'Görsel ekle',
  imageUpload: 'Bilgisayardan seç',
  imageDropHint: 'Ya da görseli sürükleyip bırakın veya yapıştırın',
  imageUrl: 'Görsel adresi',
  imageAlt: 'Alternatif metin',
  imageAltHint: 'Görmeyenler için görseli kısaca anlatın',
  imageDecorative: 'Süs amaçlı, açıklama gerekmez',
  imageSize: 'Boyut',
  imageAdd: 'Ekle',
  imageApply: 'Uygula',
  imageUnsafe: 'Bu adres kullanılamaz, https ile başlayan bir görsel adresi girin',
  imageNeedsUrl: 'Bir görsel adresi girin',
  embed: 'Video',
  embedInsert: 'Video veya ses ekle',
  embedUrl: 'Bağlantı',
  embedTitle: 'Başlık',
  embedTitleHint: 'Ekran okuyucular bu başlığı okur',
  embedSupported: 'Desteklenenler: {providers}',
  embedUnsupported: 'Bu bağlantı desteklenmiyor. Desteklenenler: {providers}',
  tableSize: '{rows} satır, {cols} sütun',
  rowAbove: 'Üste satır ekle',
  rowBelow: 'Alta satır ekle',
  columnLeft: 'Sola sütun ekle',
  columnRight: 'Sağa sütun ekle',
  mergeCells: 'Hücreleri birleştir',
  splitCell: 'Hücreyi böl',
  headerRow: 'Başlık satırı',
  widenColumn: 'Sütunu genişlet',
  narrowColumn: 'Sütunu daralt',
  deleteRow: 'Satırı sil',
  deleteColumn: 'Sütunu sil',
  deleteTable: 'Tabloyu sil',
  search: 'Bul ve değiştir',
  source: 'HTML kaynağı',
  sourceLabel: 'HTML kaynak kodu',
  file: 'Dosya',
  fileOpen: 'Dosya aç…',
  fileSaveDocx: 'Word olarak kaydet (.docx)',
  fileSaveMarkdown: 'Markdown olarak kaydet (.md)',
  fileSaveHtml: 'HTML olarak kaydet (.html)',
  filePrint: 'Yazdır veya PDF',
  fileName: 'belge',
  fileOpening: 'Dosya açılıyor…',
  fileOpened: 'Dosya açıldı.',
  fileSaved: 'Dosya kaydedildi.',
  fileTooLarge: 'Dosya çok büyük ya da çok karmaşık.',
  fileUnsupported:
    'Bu dosya türü açılamıyor. Word (.docx), Markdown, HTML ya da metin dosyası seçin.',
  fileDamaged: 'Dosya bozuk ya da okunamıyor.',
  fileEncrypted: 'Parola korumalı dosyalar açılamıyor. Parolayı kaldırıp tekrar deneyin.',
  fileLoadFailed: 'Dönüştürücü yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.',
  fileImagesDropped: 'Dosya açıldı, ancak {count} görsel eklenemedi.',
  fileContentDropped: 'Dosya açıldı; desteklenmeyen bazı içerikler atlandı.',
  fileSaveFailed: 'Dosya kaydedilemedi.',
  filePrintFailed: 'Yazdırma başlatılamadı.',
  findLabel: 'Bul',
  replaceLabel: 'Yerine yaz',
  findPrevious: 'Önceki sonuç',
  findNext: 'Sonraki sonuç',
  matchCase: 'Büyük/küçük harfe duyarlı',
  wholeWord: 'Yalnız tam kelime',
  replaceOne: 'Değiştir',
  replaceEvery: 'Tümünü değiştir',
  searchCount: '{current} / {total}',
  searchNone: 'Sonuç yok',
  horizontalRule: 'Yatay çizgi',
  link: 'Bağlantı',
  undo: 'Geri al',
  redo: 'Yinele',
  more: 'Diğer araçlar',
  panelLoading: 'Yükleniyor…',
  panelFailed: 'Bu panel yüklenemedi.',
  panelRetry: 'Tekrar dene',
  selection: 'Seçim araçları',
  slashTitle: 'Blok ekle',
  slashEmpty: 'Eşleşen blok yok',
  linkDialog: 'Bağlantıyı düzenle',
  linkLabel: 'Bağlantı adresi',
  linkApply: 'Uygula',
  linkRemove: 'Bağlantıyı kaldır',
  linkSafe: 'Güvenli adres',
  linkUnsafe: 'Bu adres kabul edilmez. http, https, mailto veya tel kullanın.',
  linkNeedsSelection: 'Önce bağlantı yapılacak metni seçin.',
  words: '{count} kelime',
  charactersUnit: 'karakter',
  charactersOf: '{count} / {limit} karakter',
  limitReached: 'Karakter sınırına ulaşıldı',
  measure: 'Metin ölçümü',
  readability: 'Okunabilirlik',
  atesman: 'Ateşman',
  flesch: 'Flesch',
  band0: 'Çok zor',
  band1: 'Zor',
  band2: 'Orta',
  band3: 'Kolay',
  band4: 'Çok kolay',
  tooShort: 'Puan için en az 10 kelime yazın.',
  wordsLabel: 'Kelime',
  sentences: 'Cümle',
  averageSentence: 'Ort. cümle',
  readingTime: 'Okuma',
  minutes: '{count} dk',
  scaleHard: 'Zor',
  scaleEasy: 'Kolay',
  glyphBold: 'K',
  glyphItalic: 'T',
  glyphUnderline: 'A',
  align: 'Hizalama',
  alignLeft: 'Sola hizala',
  alignCenter: 'Ortala',
  alignRight: 'Sağa hizala',
  alignJustify: 'İki yana yasla',
  textColor: 'Yazı rengi',
  highlight: 'Vurgu',
  colorDefault: 'Varsayılan renk',
  highlightNone: 'Vurguyu kaldır',
  colorRed: 'Kırmızı',
  colorOrange: 'Turuncu',
  colorYellow: 'Sarı',
  colorGreen: 'Yeşil',
  colorTeal: 'Turkuaz',
  colorBlue: 'Mavi',
  colorPurple: 'Mor',
  colorPink: 'Pembe',
  colorGray: 'Gri',
}

const en: Messages = {
  toolbar: 'Formatting',
  blockType: 'Block type',
  paragraph: 'Paragraph',
  heading: 'Heading {level}',
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strike: 'Strikethrough',
  code: 'Inline code',
  bulletList: 'Bulleted list',
  orderedList: 'Numbered list',
  taskList: 'Task list',
  blockquote: 'Quote',
  codeBlock: 'Code block',
  table: 'Table',
  tableInsert: 'Insert table',
  image: 'Image',
  imageInsert: 'Insert image',
  imageUpload: 'Choose from device',
  imageDropHint: 'Or drag and drop or paste an image',
  imageUrl: 'Image address',
  imageAlt: 'Alt text',
  imageAltHint: 'Briefly describe the image for people who cannot see it',
  imageDecorative: 'Decorative, no description needed',
  imageSize: 'Size',
  imageAdd: 'Insert',
  imageApply: 'Apply',
  imageUnsafe: 'This address cannot be used, enter an image address starting with https',
  imageNeedsUrl: 'Enter an image address',
  embed: 'Video',
  embedInsert: 'Insert video or audio',
  embedUrl: 'Link',
  embedTitle: 'Title',
  embedTitleHint: 'Screen readers announce this title',
  embedSupported: 'Supported: {providers}',
  embedUnsupported: 'This link is not supported. Supported: {providers}',
  tableSize: '{rows} rows, {cols} columns',
  rowAbove: 'Insert row above',
  rowBelow: 'Insert row below',
  columnLeft: 'Insert column left',
  columnRight: 'Insert column right',
  mergeCells: 'Merge cells',
  splitCell: 'Split cell',
  headerRow: 'Header row',
  widenColumn: 'Widen column',
  narrowColumn: 'Narrow column',
  deleteRow: 'Delete row',
  deleteColumn: 'Delete column',
  deleteTable: 'Delete table',
  search: 'Find and replace',
  source: 'HTML source',
  sourceLabel: 'HTML source code',
  file: 'File',
  fileOpen: 'Open file…',
  fileSaveDocx: 'Save as Word (.docx)',
  fileSaveMarkdown: 'Save as Markdown (.md)',
  fileSaveHtml: 'Save as HTML (.html)',
  filePrint: 'Print or PDF',
  fileName: 'document',
  fileOpening: 'Opening file…',
  fileOpened: 'File opened.',
  fileSaved: 'File saved.',
  fileTooLarge: 'The file is too large or too complex.',
  fileUnsupported:
    'This kind of file cannot be opened. Choose a Word (.docx), Markdown, HTML or text file.',
  fileDamaged: 'The file is damaged or cannot be read.',
  fileEncrypted: 'Password-protected files cannot be opened. Remove the password and try again.',
  fileLoadFailed: 'The converter could not be loaded. Check your connection and try again.',
  fileImagesDropped: 'The file was opened, but {count} images could not be added.',
  fileContentDropped: 'The file was opened; some unsupported content was left out.',
  fileSaveFailed: 'The file could not be saved.',
  filePrintFailed: 'Printing could not start.',
  findLabel: 'Find',
  replaceLabel: 'Replace with',
  findPrevious: 'Previous match',
  findNext: 'Next match',
  matchCase: 'Match case',
  wholeWord: 'Whole word only',
  replaceOne: 'Replace',
  replaceEvery: 'Replace all',
  searchCount: '{current} of {total}',
  searchNone: 'No results',
  horizontalRule: 'Divider',
  link: 'Link',
  undo: 'Undo',
  redo: 'Redo',
  more: 'More tools',
  panelLoading: 'Loading…',
  panelFailed: 'This panel could not be loaded.',
  panelRetry: 'Try again',
  selection: 'Selection tools',
  slashTitle: 'Insert block',
  slashEmpty: 'No matching block',
  linkDialog: 'Edit link',
  linkLabel: 'Link address',
  linkApply: 'Apply',
  linkRemove: 'Remove link',
  linkSafe: 'Safe address',
  linkUnsafe: 'This address is not allowed. Use http, https, mailto or tel.',
  linkNeedsSelection: 'Select the text to link first.',
  words: '{count} words',
  charactersUnit: 'characters',
  charactersOf: '{count} of {limit} characters',
  limitReached: 'Character limit reached',
  measure: 'Text statistics',
  readability: 'Readability',
  atesman: 'Ateşman',
  flesch: 'Flesch',
  band0: 'Very hard',
  band1: 'Hard',
  band2: 'Fair',
  band3: 'Easy',
  band4: 'Very easy',
  tooShort: 'Write at least 10 words for a score.',
  wordsLabel: 'Words',
  sentences: 'Sentences',
  averageSentence: 'Avg. sentence',
  readingTime: 'Reading',
  minutes: '{count} min',
  scaleHard: 'Hard',
  scaleEasy: 'Easy',
  glyphBold: 'B',
  glyphItalic: 'I',
  glyphUnderline: 'U',
  align: 'Alignment',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
  alignJustify: 'Justify',
  textColor: 'Text color',
  highlight: 'Highlight',
  colorDefault: 'Default color',
  highlightNone: 'Remove highlight',
  colorRed: 'Red',
  colorOrange: 'Orange',
  colorYellow: 'Yellow',
  colorGreen: 'Green',
  colorTeal: 'Teal',
  colorBlue: 'Blue',
  colorPurple: 'Purple',
  colorPink: 'Pink',
  colorGray: 'Gray',
}

export const MESSAGES: Readonly<Record<Locale, Messages>> = { tr, en }

export function resolveLocale(requested?: string): Locale {
  const source =
    requested ??
    (typeof document === 'undefined' ? undefined : document.documentElement.lang) ??
    (typeof navigator === 'undefined' ? undefined : navigator.language)
  return source?.toLowerCase().startsWith('tr') ? 'tr' : 'en'
}

export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  )
}
