import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { Footnote } from '@viveeditor/ext-footnote'
import { formatExtensions } from '@viveeditor/ext-format'
import { listExtensions } from '@viveeditor/ext-list'
import { type KatexModule, MathExtension } from '@viveeditor/ext-math'
import { Mention } from '@viveeditor/ext-mention'
import { createUI } from '@viveeditor/ui'
import {
  type AiProvider,
  type AiRequest,
  aiAssistant,
  emojiMenu,
  footnoteTools,
  type MentionItem,
  mathTools,
  mentionMenu,
  templateMenu,
} from '@viveeditor/ui/extras'
import '@viveeditor/core/style.css'
import '@viveeditor/ext-footnote/style.css'
import '@viveeditor/ext-math/style.css'
import '@viveeditor/ext-mention/style.css'
import '@viveeditor/ui/style.css'
import 'katex/dist/katex.min.css'
import './ui-page.css'

const host = document.querySelector<HTMLElement>('#article')
const output = document.querySelector<HTMLElement>('[data-testid="output"]')
const errors = document.querySelector<HTMLElement>('[data-testid="errors"]')

if (!host || !output || !errors) {
  throw new Error('Playground markup is incomplete.')
}

const params = new URLSearchParams(window.location.search)

const content = `
<h2>Ek özellikler</h2>
<p><span data-mention="u_ayse">@Ayşe Yılmaz</span> bu ayki sayıyı hazırladı<sup data-footnote="">Yayın kurulu kararı, <em>Ekim 2026</em>.</sup>.</p>
<p>Dairenin alanı <span data-math="inline">\\pi r^2</span> ile hesaplanır.</p>
<div data-math="block">\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}</div>
<p>@ ile kişi, : ile emoji ekleyin. Boş satırda / yazın; formül, dipnot ve şablonlar menüdedir. Metni seçip Ctrl/⌘+J ile yapay zekâ panelini açın.</p>
`

const people: readonly MentionItem[] = [
  { id: 'u_ayse', label: 'Ayşe Yılmaz', description: 'Editör' },
  { id: 'u_burak', label: 'Burak Demir', description: 'Muhabir' },
  { id: 'u_cem', label: 'Cem Kaya', description: 'Fotoğraf' },
  { id: 'u_deniz', label: 'Deniz Aydın', description: 'Yazı işleri' },
  { id: 'u_elif', label: 'Elif Şahin', description: 'Düzelti' },
]

const fold = (value: string): string => value.toLocaleLowerCase('tr')

const findPeople = (query: string): readonly MentionItem[] =>
  people.filter((person) => fold(person.label).includes(fold(query)))

const outdatedKatex: KatexModule = { version: '0.16.0', render: () => undefined }

const loadKatex = (): Promise<KatexModule> =>
  params.get('katex') === 'old' ? Promise.resolve(outdatedKatex) : import('katex')

const wait = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms)
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })

const HOSTILE =
  '<img src="https://tracker.invalid/pixel.png" onerror="alert(1)"> ![iz](https://tracker.invalid/image.png) [tıkla](javascript:alert(1)) \u202egizli'

function answer(request: AiRequest): string {
  const text = request.text.trim()
  switch (request.action) {
    case 'improve':
      return `${text.charAt(0).toLocaleUpperCase('tr')}${text.slice(1).replace(/\s+/g, ' ')}`
    case 'fix':
      return text.replace(/\s+/g, ' ')
    case 'shorten':
      return text
        .split(/\s+/)
        .slice(0, Math.max(3, Math.ceil(text.split(/\s+/).length / 2)))
        .join(' ')
    case 'expand':
      return `${text} Bu konu bir sonraki sayıda ayrıntılı olarak ele alınacak.`
    case 'tone':
      return `Değerli okurlarımız, ${text}`
    case 'translate':
      return `[EN] ${text}`
    case 'summarize':
      return text.split(/(?<=[.!?])\s/)[0] ?? text
    case 'continue':
      return 'Yeni bölüm, okurların sorularıyla başlıyor.'
    case 'custom':
      return `${request.instruction ?? ''}: ${text}`
  }
}

const offlineProvider: AiProvider = {
  async *generate(request) {
    const mode = params.get('ai')
    const reply = mode === 'hostile' ? HOSTILE : answer(request)
    const words =
      mode === 'slow'
        ? Array.from({ length: 200 }, (_, index) => `kelime${index}`)
        : reply.split(/(?<=\s)/)
    for (const word of words) {
      await wait(mode === 'slow' ? 150 : 25, request.signal)
      yield mode === 'slow' ? `${word} ` : word
    }
  },
}

const editor = await Editor.create(host, {
  extensions: [
    ...basicExtensions,
    ...listExtensions,
    ...formatExtensions,
    Mention,
    MathExtension.configure({
      load: loadKatex,
      labels: { empty: 'Formül', edit: 'LaTeX formülü' },
      onError: (error) => {
        errors.textContent = `Formül hatası: ${error.code}`
      },
    }),
    Footnote.configure({ labels: { footnote: 'Dipnot', edit: 'Dipnot metni' } }),
  ],
  label: 'Makale metni',
  editable: !params.has('readonly'),
  content: params.has('empty') ? '' : content,
})

createUI(editor, {
  locale: 'tr',
  plugins: [
    mentionMenu({ items: findPeople }),
    emojiMenu({ load: () => import('@viveeditor/emoji-data/en') }),
    templateMenu([
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
        content:
          '<h2>Başlık</h2><p>Giriş paragrafı.</p><script>alert(1)</script><p><em>Kaynak:</em> </p>',
      },
    ]),
    mathTools(),
    footnoteTools(),
    aiAssistant({ provider: offlineProvider }),
  ],
  onError: (error) => {
    errors.textContent = error instanceof Error ? error.message : 'Bir eklenti hata verdi.'
  },
})

const render = (): void => {
  output.textContent = editor.getHTML()
}
editor.on('change', render)
render()

Object.assign(window, { viveEditor: editor })
