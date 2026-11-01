import type { DocGroupKey } from '../docs/structure'
import type { Locale } from '.'

export type Anchors = {
  demo: string
  features: string
  install: string
  security: string
  docs: string
}

export const ANCHORS: Record<Locale, Anchors> = {
  tr: {
    demo: 'dene',
    features: 'ozellikler',
    install: 'kurulum',
    security: 'guvenlik',
    docs: 'belgeler',
  },
  en: {
    demo: 'try',
    features: 'features',
    install: 'install',
    security: 'security',
    docs: 'docs',
  },
}

const tr = {
  skip: 'İçeriğe geç',
  mainMenu: 'Ana menü',
  homeLabel: 'viveEditor ana sayfa',
  nav: { demo: 'Dene', features: 'Özellikler', install: 'Kurulum', docs: 'Belgeler' },
  siteLanguage: 'Site dili',
  themeDark: 'Koyu tema',
  themeLight: 'Açık tema',
  repoLabel: 'viveEditor GitHub deposu',
  openMenu: 'Menüyü aç',
  closeMenu: 'Menüyü kapat',
  otherLanguage: 'English',
  foot: {
    blurb:
      'Her siteye takılan ücretsiz, açık kaynak metin editörü. Bir betik ve bir metin alanı yeter.',
    product: 'Ürün',
    source: 'Kaynak',
    help: 'Yardım',
    demo: 'Canlı deneme',
    features: 'Özellikler',
    install: 'Kurulum',
    security: 'Güvenlik',
    npm: 'npm paketi',
    changelog: 'Değişiklikler',
    license: 'Lisans: MIT',
    docs: 'Belgeler',
    report: 'Hata bildir',
    securityPolicy: 'Güvenlik açığı bildir',
    family: 'vivePDF ailesinden',
    copyright: '© 2026 viveEditor · Açık kaynak, herkes için',
    tagsLabel: 'İlkeler',
    free: 'Ücretli katman yok',
    noWebfonts: 'Editör yazı tipi indirmez',
    noTracking: 'İzleme yok',
  },
  docs: {
    title: 'Belgeler',
    description:
      'viveEditor belgeleri: kurulum, çerçeveler, araç çubuğu, görseller, video, tablolar, Word ve Markdown, sunucuda temizleme, Laravel ve ekler.',
    lead: 'viveEditor’ü sayfanıza eklemekten sunucuda temizlemeye kadar her adım. Örnekler paketlerin gerçek dışa açık API’sinden alındı.',
    search: 'Belgelerde ara',
    searchShort: 'Ara',
    searchPlaceholder: 'Ara: yükleme, tablo, Laravel',
    searchHint: 'Aramak için Ctrl K',
    searchEmpty: 'Bu aramaya uyan sayfa yok',
    searchEmptyHint: 'Daha kısa bir kelime deneyin ya da sorunuzu GitHub’da sorun.',
    searchUnavailable: 'Arama yalnızca yayımlanan sitede çalışır.',
    close: 'Kapat',
    onThisPage: 'Bu sayfada',
    previous: 'Önceki',
    next: 'Sonraki',
    breadcrumb: 'Konum',
    sidebar: 'Belge menüsü',
    openSidebar: 'Belge menüsü',
    updated: 'Son güncelleme',
    menu: 'Menü',
    copy: 'Kodu kopyala',
    copied: 'Kopyalandı',
    searchCount: { one: '# sonuç', other: '# sonuç' },
    groups: {
      start: 'Başlarken',
      features: 'Özellikler',
      extras: 'Ekler',
      server: 'Sunucu',
      reference: 'Başvuru',
    } satisfies Record<DocGroupKey, string>,
  },
  notFound: {
    title: 'Sayfa bulunamadı',
    eyebrow: 'Hata 404',
    heading: 'Bu sayfa yerinde yok.',
    lead: 'Aradığınız adres taşınmış, adı değişmiş ya da hiç olmamış olabilir. Aşağıdaki sayfalardan biriyle devam edebilirsiniz.',
    asked: 'İstenen adres',
    home: 'Ana sayfaya dön',
    docs: 'Belgelere git',
    popular: 'Çok okunanlar',
  },
}

export type Ui = typeof tr

const en: Ui = {
  skip: 'Skip to content',
  mainMenu: 'Main menu',
  homeLabel: 'viveEditor home',
  nav: { demo: 'Try it', features: 'Features', install: 'Install', docs: 'Docs' },
  siteLanguage: 'Site language',
  themeDark: 'Dark theme',
  themeLight: 'Light theme',
  repoLabel: 'viveEditor on GitHub',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  otherLanguage: 'Türkçe',
  foot: {
    blurb:
      'A free, open-source rich text editor that drops into any website. One script and a textarea are enough.',
    product: 'Product',
    source: 'Source',
    help: 'Help',
    demo: 'Live demo',
    features: 'Features',
    install: 'Install',
    security: 'Security',
    npm: 'npm package',
    changelog: 'Changelog',
    license: 'License: MIT',
    docs: 'Docs',
    report: 'Report a bug',
    securityPolicy: 'Report a vulnerability',
    family: 'From the vivePDF family',
    copyright: '© 2026 viveEditor · Open source, for everyone',
    tagsLabel: 'Principles',
    free: 'No paid tier',
    noWebfonts: 'Editor loads no web fonts',
    noTracking: 'No tracking',
  },
  docs: {
    title: 'Documentation',
    description:
      'viveEditor documentation: installing, frameworks, the toolbar, images, video, tables, Word and Markdown, server-side cleaning, Laravel and extras.',
    lead: 'Every step from adding viveEditor to your page to cleaning its HTML on the server. Examples use the packages’ real public API.',
    search: 'Search the docs',
    searchShort: 'Search',
    searchPlaceholder: 'Search: upload, table, Laravel',
    searchHint: 'Ctrl K to search',
    searchEmpty: 'No page matches this search',
    searchEmptyHint: 'Try a shorter word, or ask on GitHub.',
    searchUnavailable: 'Search works on the published site only.',
    close: 'Close',
    onThisPage: 'On this page',
    previous: 'Previous',
    next: 'Next',
    breadcrumb: 'Breadcrumb',
    sidebar: 'Docs menu',
    openSidebar: 'Docs menu',
    updated: 'Last updated',
    menu: 'Menu',
    copy: 'Copy code',
    copied: 'Copied',
    searchCount: { one: '# result', other: '# results' },
    groups: {
      start: 'Getting started',
      features: 'Features',
      extras: 'Extras',
      server: 'Server',
      reference: 'Reference',
    },
  },
  notFound: {
    title: 'Page not found',
    eyebrow: 'Error 404',
    heading: 'This page isn’t here.',
    lead: 'The address may have moved, been renamed or never existed. Pick up from one of the pages below.',
    asked: 'Requested address',
    home: 'Back to the home page',
    docs: 'Go to the docs',
    popular: 'Popular pages',
  },
}

export const UI: Record<Locale, Ui> = { tr, en }
