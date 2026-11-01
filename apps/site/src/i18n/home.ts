import type { Locale } from '.'
import type { PluralForms } from './plural'

export type Feature = { icon: string; title: string; body: string; doc: string }
export type SecurityPoint = { title: string; body: string }
export type InstallTab = { id: string; label: string; lead: string }

export type HomeCopy = {
  title: string
  description: string
  hero: {
    eyebrow: string
    heading: string
    headingEm: string
    lede: [string, string, string]
    tryIt: string
    copy: string
    copied: string
    copyLabel: string
    factsLabel: string
    facts: string[]
    sheetLabel: string
    sheet: string[]
  }
  meter: {
    eyebrow: string
    hard: string
    easy: string
    hint: string
    bands: [string, string, string, string, string]
    words: string
    sentences: string
    average: string
    reading: string
    minutes: PluralForms
    scoreLabel: string
  }
  demo: {
    eyebrow: string
    heading: string
    headingEm: string
    lead: string
    note: string
    label: string
    waiting: string
    loading: string
    failed: string
    retry: string
    showHtml: string
    hideHtml: string
    reset: string
    htmlLabel: string
    fileName: string
    content: string
    people: Array<{ id: string; label: string; description: string }>
    templates: Array<{ id: string; label: string; description: string; content: string }>
  }
  features: { eyebrow: string; heading: string; headingEm: string; lead: string; items: Feature[] }
  install: {
    eyebrow: string
    heading: string
    headingEm: string
    lead: string
    tabsLabel: string
    copy: string
    copied: string
    tabs: InstallTab[]
    versionNote: string
  }
  security: {
    eyebrow: string
    heading: string
    headingEm: string
    lead: string
    points: SecurityPoint[]
  }
  cta: { heading: string; lead: string; docs: string; github: string }
}

const tr: HomeCopy = {
  title: 'viveEditor · Her siteye takılan ücretsiz metin editörü',
  description:
    'Ücretsiz, MIT lisanslı zengin metin editörü. Bir betik ve bir metin alanı yeter; görsel yükleme, tablolar, video ve Word dahil, ücretli katmanı yok.',
  hero: {
    eyebrow: 'Ücretsiz · MIT · açık kaynak',
    heading: 'Her siteye takılan',
    headingEm: 'ücretsiz metin editörü.',
    lede: [
      'Bir ',
      ' ve bir ',
      ' yeter. Görsel yükleme, tablolar, video, Word açıp kaydetme: hepsi MIT lisanslı, ücretli katmanı yok.',
    ],
    tryIt: 'Dene',
    copy: 'Kopyala',
    copied: 'Kopyalandı',
    copyLabel: 'Kurulum komutunu kopyala',
    factsLabel: 'Özet',
    facts: ['Ücretli katman yok', 'WCAG 2.2 AA', 'Varsayılan güvenli'],
    sheetLabel: 'Deneme metni. Yazın, okunabilirlik puanı değişsin.',
    sheet: [
      'Bu kutu gerçek bir viveEditor. İçine yazdıkça yukarıdaki sayı yeniden hesaplanır.',
      'Kısa cümleler ve sık kullanılan kelimeler metni kolaylaştırır. Uzun cümleler puanı düşürür.',
    ],
  },
  meter: {
    eyebrow: 'Okunabilirlik · Ateşman',
    hard: 'Zor',
    easy: 'Kolay',
    hint: 'Puan için en az 10 kelime yazın.',
    bands: ['Çok zor', 'Zor', 'Orta', 'Kolay', 'Çok kolay'],
    words: 'Kelime',
    sentences: 'Cümle',
    average: 'Ort. cümle',
    reading: 'Okuma',
    minutes: { one: '# dk', other: '# dk' },
    scoreLabel: 'Okunabilirlik puanı',
  },
  demo: {
    eyebrow: 'Canlı deneme',
    heading: 'Bütün araçlar,',
    headingEm: 'bu sayfada.',
    lead: 'Tablo ekleyin, Word dosyası açın, formül yazın, @ ile birini anın, : ile emoji seçin. Boş satırda / yazınca blok menüsü açılır.',
    note: 'Eklediğiniz görseller ve açtığınız dosyalar tarayıcınızdan çıkmaz; hiçbir şey bir sunucuya gönderilmez.',
    label: 'Deneme editörü',
    waiting: 'Editör, bu bölüme gelince yüklenir.',
    loading: 'Editör yükleniyor…',
    failed: 'Editör yüklenemedi.',
    retry: 'Yeniden dene',
    showHtml: "HTML'i gör",
    hideHtml: "HTML'i gizle",
    reset: 'Sıfırla',
    htmlLabel: 'Editörün ürettiği HTML',
    fileName: 'viveEditor denemesi',
    content: `<h2>Haftalık bülten</h2>
<p>viveEditor ile yazarken <strong>biçim kaybolmuyor</strong>, <mark>vurgular</mark> korunuyor ve Word'den yapıştırılan metin temiz geliyor<sup data-footnote="">Word, Google Dokümanlar ve LibreOffice'ten yapıştırma.</sup>.</p>
<p><span class="vive-mention" data-mention="r_editor">@Editör</span> bu sayının taslağını hazırladı.</p>
<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><div><p>Taslağı yaz</p></div></li><li data-type="taskItem" data-checked="false"><div><p>Görselleri ekle</p></div></li></ul>
<table><tbody><tr><th><p>Bölüm</p></th><th><p>Durum</p></th></tr><tr><td><p>Giriş</p></td><td><p>Hazır</p></td></tr><tr><td><p>Röportaj</p></td><td><p>Düzeltmede</p></td></tr></tbody></table>
<p>Dairenin alanı <span data-math="inline">\\pi r^2</span> ile hesaplanır.</p>
<pre data-language="javascript"><code class="language-javascript">import { upgradeAll } from 'viveeditor'

upgradeAll()</code></pre>
<blockquote><p>Metni seçin; biçim balonu seçimin üstünde açılır.</p></blockquote>`,
    people: [
      { id: 'r_editor', label: 'Editör', description: 'Yazı işleri' },
      { id: 'r_writer', label: 'Yazar', description: 'Haber masası' },
      { id: 'r_photo', label: 'Fotoğraf', description: 'Görsel masası' },
      { id: 'r_proof', label: 'Düzelti', description: 'Son okuma' },
    ],
    templates: [
      {
        id: 'interview',
        label: 'Röportaj',
        description: 'Soru ve cevap düzeni',
        content: '<h2>Röportaj</h2><p><strong>Soru:</strong> </p><p><strong>Cevap:</strong> </p>',
      },
      {
        id: 'news',
        label: 'Haber',
        description: 'Başlık, giriş ve kaynak',
        content: '<h2>Başlık</h2><p>Giriş paragrafı.</p><p><em>Kaynak:</em> </p>',
      },
    ],
  },
  features: {
    eyebrow: 'Özellikler',
    heading: 'Yazanın işine yarayan',
    headingEm: 'her şey, ücretsiz.',
    lead: 'Her özellik ayrı bir paket. Ağır parçalar yalnız kullanıldığında iner.',
    items: [
      {
        icon: 'i-merge',
        title: "Word'den temiz yapıştırma",
        body: "Word'ün sahte madde işaretleri gerçek iç içe listelere döner. Google Dokümanlar'ın yanlış iç içe listeleri düzelir.",
        doc: 'officePaste',
      },
      {
        icon: 'i-convert',
        title: 'Word ve Markdown aç, kaydet',
        body: '.docx, .md, .html ve .txt dosyalarını açar; Word, Markdown ya da HTML olarak kaydeder ve yazdırır.',
        doc: 'files',
      },
      {
        icon: 'i-search',
        title: 'Türkçe bul ve değiştir',
        body: 'Arama Türkçe büyük harfleri doğru eşler: “İSTANBUL” araması “istanbul”u bulur.',
        doc: 'search',
      },
      {
        icon: 'i-present',
        title: 'Gizliliği koruyan video',
        body: 'YouTube, Vimeo ve Spotify bağlantıları oynatıcıya döner. Oynat’a basılana kadar sağlayıcıdan hiçbir şey yüklenmez.',
        doc: 'video',
      },
      {
        icon: 'i-board',
        title: 'Tablolar',
        body: 'Hücre birleştirme, başlık satırı ve sütun genişliği; Word dosyalarında da korunur.',
        doc: 'tables',
      },
      {
        icon: 'i-form',
        title: 'Formül, dipnot, bahsetme',
        body: 'LaTeX formülleri, yerinde düzenlenen dipnotlar, @ ile bahsetme, emoji ve şablonlar npm eklentisi olarak gelir.',
        doc: 'math',
      },
    ],
  },
  install: {
    eyebrow: 'Kurulum',
    heading: 'Bir dakikada',
    headingEm: 'sayfanızda.',
    lead: 'Derleme adımı olmadan bir betikle, ya da React, Vue, Svelte ve Angular için türlü paketlerle.',
    tabsLabel: 'Kurulum yolu',
    copy: 'Kodu kopyala',
    copied: 'Kopyalandı',
    tabs: [
      {
        id: 'cdn',
        label: 'CDN',
        lead: 'Form gönderildiğinde metin alanının adıyla temiz HTML gider. Sunucuda yine de temizleyin.',
      },
      {
        id: 'npm',
        label: 'npm',
        lead: 'Yalnız istediğiniz eklentileri alın; her biri ayrı paket.',
      },
      { id: 'react', label: 'React', lead: 'React 18 ve 19. Paket "use client" olarak işaretli.' },
      { id: 'vue', label: 'Vue', lead: 'Vue 3.5, v-model ile.' },
      { id: 'svelte', label: 'Svelte', lead: 'Svelte 5, bind:value ile.' },
      { id: 'angular', label: 'Angular', lead: 'Angular 21 ve 22; ngModel ya da reactive forms.' },
      {
        id: 'element',
        label: '<vive-editor>',
        lead: 'Her sayfada form alanı: değerini formla gönderir, required iken boşsa gönderimi durdurur.',
      },
      {
        id: 'laravel',
        label: 'Laravel',
        lead: 'Laravel 12+ ve PHP 8.4+: Blade bileşeni, editör dosyaları ve PHP temizleyici.',
      },
    ],
    versionNote:
      'CDN adresinde her zaman tam sürüm kullanın; ek dosyalar o sürüme gömülü parmak izleriyle denetlenir.',
  },
  security: {
    eyebrow: 'Güvenlik ve gizlilik',
    heading: 'Varsayılan olarak',
    headingEm: 'güvenli.',
    lead: 'Tarayıcı bir güvenlik sınırı değildir. viveEditor bu yüzden hem editörde hem sunucuda aynı kuralları uygular.',
    points: [
      {
        title: 'Belge şeması bir izin listesi',
        body: 'Tanınmayan biçim çıktıya hiç ulaşmaz; yapıştırılan, açılan ve şablondan gelen içerik aynı kurallardan geçer.',
      },
      {
        title: 'Node ve PHP aynı çıktıyı verir',
        body: '@viveeditor/sanitize ve viveeditor/sanitizer tek izin listesini ve tek test derlemini paylaşır.',
      },
      {
        title: 'Oynatıcılar yeniden kurulur',
        body: 'Kaydedilen HTML verilen adresi tutmaz; sağlayıcı ve video kimliğinden sabit sandbox ile yeniden kurulur.',
      },
      {
        title: 'Görsel adresleri denetlenir',
        body: 'Görseller https adresi ister; her adres ve yüklenen her dosya belgeye girmeden önce denetlenir.',
      },
      {
        title: 'Kendiliğinden hiçbir yere bağlanmaz',
        body: 'Editör yazı tipi indirmez, izleme yapmaz. Yapay zekâ eklentisi bile yalnız sizin sunucunuza konuşur.',
      },
      {
        title: 'Erişilebilir',
        body: 'Açık ve koyu temada WCAG 2.2 AA; tam klavye denetimi ve ekran okuyucu duyuruları.',
      },
    ],
  },
  cta: {
    heading: 'Başlamaya hazır mısınız?',
    lead: 'Belgeler kurulumdan sunucuda temizlemeye kadar her adımı gerçek API ile anlatır.',
    docs: 'Belgeleri oku',
    github: "GitHub'da gör",
  },
}

const en: HomeCopy = {
  title: 'viveEditor · The free rich text editor for any website',
  description:
    'A free, MIT-licensed rich text editor. One script and a textarea are enough; image uploads, tables, video and Word included, with no paid tier.',
  hero: {
    eyebrow: 'Free · MIT · open source',
    heading: 'The free text editor',
    headingEm: 'that fits any website.',
    lede: [
      'One ',
      ' and one ',
      ' are enough. Image uploads, tables, video, opening and saving Word files: all MIT licensed, with no paid tier.',
    ],
    tryIt: 'Try it',
    copy: 'Copy',
    copied: 'Copied',
    copyLabel: 'Copy the install command',
    factsLabel: 'Summary',
    facts: ['No paid tier', 'WCAG 2.2 AA', 'Safe by default'],
    sheetLabel: 'Sample text. Type and watch the readability score change.',
    sheet: [
      'This box is a real viveEditor. The number above is worked out again as you type.',
      'Short sentences and common words make a text easy to read. Long sentences pull the score down.',
    ],
  },
  meter: {
    eyebrow: 'Readability · Flesch',
    hard: 'Hard',
    easy: 'Easy',
    hint: 'Type at least 10 words for a score.',
    bands: ['Very hard', 'Hard', 'Fair', 'Easy', 'Very easy'],
    words: 'Words',
    sentences: 'Sentences',
    average: 'Avg. sentence',
    reading: 'Reading',
    minutes: { one: '# min', other: '# min' },
    scoreLabel: 'Readability score',
  },
  demo: {
    eyebrow: 'Live demo',
    heading: 'Every tool,',
    headingEm: 'right on this page.',
    lead: 'Insert a table, open a Word file, write a formula, mention someone with @, pick an emoji with :. Type / on an empty line for the block menu.',
    note: 'Images you add and files you open stay in your browser; nothing is sent to a server.',
    label: 'Demo editor',
    waiting: 'The editor loads when you reach this section.',
    loading: 'Loading the editor…',
    failed: 'The editor could not load.',
    retry: 'Try again',
    showHtml: 'Show HTML',
    hideHtml: 'Hide HTML',
    reset: 'Reset',
    htmlLabel: 'HTML produced by the editor',
    fileName: 'viveEditor demo',
    content: `<h2>Weekly newsletter</h2>
<p>With viveEditor <strong>formatting stays put</strong>, <mark>highlights</mark> are kept and text pasted from Word arrives clean<sup data-footnote="">Paste from Word, Google Docs and LibreOffice.</sup>.</p>
<p><span class="vive-mention" data-mention="r_editor">@Editor</span> drafted this issue.</p>
<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><div><p>Write the draft</p></div></li><li data-type="taskItem" data-checked="false"><div><p>Add the images</p></div></li></ul>
<table><tbody><tr><th><p>Section</p></th><th><p>Status</p></th></tr><tr><td><p>Intro</p></td><td><p>Ready</p></td></tr><tr><td><p>Interview</p></td><td><p>In review</p></td></tr></tbody></table>
<p>The area of a circle is <span data-math="inline">\\pi r^2</span>.</p>
<pre data-language="javascript"><code class="language-javascript">import { upgradeAll } from 'viveeditor'

upgradeAll()</code></pre>
<blockquote><p>Select some text; the format bubble opens above it.</p></blockquote>`,
    people: [
      { id: 'r_editor', label: 'Editor', description: 'Editorial desk' },
      { id: 'r_writer', label: 'Writer', description: 'News desk' },
      { id: 'r_photo', label: 'Photo', description: 'Picture desk' },
      { id: 'r_proof', label: 'Proofreader', description: 'Final read' },
    ],
    templates: [
      {
        id: 'interview',
        label: 'Interview',
        description: 'Question and answer layout',
        content:
          '<h2>Interview</h2><p><strong>Question:</strong> </p><p><strong>Answer:</strong> </p>',
      },
      {
        id: 'news',
        label: 'News story',
        description: 'Headline, intro and source',
        content: '<h2>Headline</h2><p>Intro paragraph.</p><p><em>Source:</em> </p>',
      },
    ],
  },
  features: {
    eyebrow: 'Features',
    heading: 'Everything a writer needs,',
    headingEm: 'free.',
    lead: 'Every feature is its own package. Heavy parts download only when used.',
    items: [
      {
        icon: 'i-merge',
        title: 'Clean paste from Word',
        body: "Word's fake bullets become real nested lists, and lists that Google Docs nests the wrong way are fixed.",
        doc: 'officePaste',
      },
      {
        icon: 'i-convert',
        title: 'Open and save Word and Markdown',
        body: 'Opens .docx, .md, .html and .txt files, saves as Word, Markdown or HTML, and prints.',
        doc: 'files',
      },
      {
        icon: 'i-search',
        title: 'Find and replace that knows Turkish',
        body: 'Search matches Turkish capitals correctly: “İSTANBUL” finds “istanbul”.',
        doc: 'search',
      },
      {
        icon: 'i-present',
        title: 'Privacy-first video',
        body: 'YouTube, Vimeo and Spotify links become players. Nothing loads from the provider until someone presses play.',
        doc: 'video',
      },
      {
        icon: 'i-board',
        title: 'Tables',
        body: 'Merged cells, header rows and column widths, kept in Word files too.',
        doc: 'tables',
      },
      {
        icon: 'i-form',
        title: 'Formulas, footnotes, mentions',
        body: 'LaTeX formulas, footnotes edited in place, @ mentions, emoji and templates come as npm extras.',
        doc: 'math',
      },
    ],
  },
  install: {
    eyebrow: 'Install',
    heading: 'On your page',
    headingEm: 'in a minute.',
    lead: 'With one script and no build step, or with typed packages for React, Vue, Svelte and Angular.',
    tabsLabel: 'Install method',
    copy: 'Copy code',
    copied: 'Copied',
    tabs: [
      {
        id: 'cdn',
        label: 'CDN',
        lead: "The form posts clean HTML under the textarea's name. Always sanitize it again on the server.",
      },
      {
        id: 'npm',
        label: 'npm',
        lead: 'Take only the extensions you want; each is its own package.',
      },
      { id: 'react', label: 'React', lead: 'React 18 and 19. The package is marked "use client".' },
      { id: 'vue', label: 'Vue', lead: 'Vue 3.5, with v-model.' },
      { id: 'svelte', label: 'Svelte', lead: 'Svelte 5, with bind:value.' },
      {
        id: 'angular',
        label: 'Angular',
        lead: 'Angular 21 and 22, with ngModel or reactive forms.',
      },
      {
        id: 'element',
        label: '<vive-editor>',
        lead: 'A form field for any page: it posts its value with the form and blocks submit while required and empty.',
      },
      {
        id: 'laravel',
        label: 'Laravel',
        lead: 'Laravel 12+ and PHP 8.4+: a Blade component, the editor files and the PHP sanitizer.',
      },
    ],
    versionNote:
      'Always use an exact version in the CDN address; its add-ons are checked against fingerprints built into that version.',
  },
  security: {
    eyebrow: 'Security and privacy',
    heading: 'Safe',
    headingEm: 'by default.',
    lead: 'The browser is not a security boundary, so viveEditor applies the same rules in the editor and on the server.',
    points: [
      {
        title: 'The document schema is an allowlist',
        body: 'Unknown markup never reaches the output; pasted, opened and templated content all pass the same rules.',
      },
      {
        title: 'Node and PHP give the same output',
        body: '@viveeditor/sanitize and viveeditor/sanitizer share one allowlist and one test corpus.',
      },
      {
        title: 'Players are rebuilt',
        body: 'Saved HTML never keeps the address it was given; players are rebuilt from the provider and video id with a fixed sandbox.',
      },
      {
        title: 'Image addresses are checked',
        body: 'Images need https addresses; every address and uploaded file is checked before it reaches the document.',
      },
      {
        title: 'Connects to nothing on its own',
        body: 'The editor loads no web fonts and does no tracking. Even the AI extra talks only to your own server.',
      },
      {
        title: 'Accessible',
        body: 'WCAG 2.2 AA in light and dark themes, full keyboard control and screen reader announcements.',
      },
    ],
  },
  cta: {
    heading: 'Ready to start?',
    lead: 'The docs cover every step from installing to cleaning HTML on the server, using the real API.',
    docs: 'Read the docs',
    github: 'View on GitHub',
  },
}

export const HOME: Record<Locale, HomeCopy> = { tr, en }
