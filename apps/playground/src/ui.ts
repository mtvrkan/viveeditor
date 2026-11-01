import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { CharacterCount } from '@viveeditor/ext-character-count'
import { CodeBlock } from '@viveeditor/ext-code-block'
import { CodeHighlight, shikiHighlighter } from '@viveeditor/ext-code-block/highlight'
import { Embed } from '@viveeditor/ext-embed'
import { formatExtensions } from '@viveeditor/ext-format'
import { Image, type ImageUploader } from '@viveeditor/ext-image'
import { listExtensions } from '@viveeditor/ext-list'
import { OfficePaste } from '@viveeditor/ext-office-paste'
import { Search } from '@viveeditor/ext-search'
import { Table } from '@viveeditor/ext-table'
import { TaskItem, TaskList } from '@viveeditor/ext-task-list'
import { createUI } from '@viveeditor/ui'
import '@viveeditor/core/style.css'
import '@viveeditor/ext-code-block/style.css'
import '@viveeditor/ext-embed/style.css'
import '@viveeditor/ext-image/style.css'
import '@viveeditor/ext-search/style.css'
import '@viveeditor/ext-table/style.css'
import '@viveeditor/ext-task-list/style.css'
import '@viveeditor/ui/style.css'
import './ui-page.css'

const host = document.querySelector<HTMLElement>('#article')
const output = document.querySelector<HTMLElement>('[data-testid="output"]')

if (!host || !output) {
  throw new Error('Playground markup is incomplete.')
}

const content = `
<h2 style="text-align: center">Yeni sürüm notları</h2>
<p>viveEditor 0.2 ile yazarken <strong>biçim kaybolmuyor</strong>, <mark>vurgular</mark> ve <span style="color: #1565c0">renkler</span> korunuyor, Word'den yapıştırılan metin <a href="https://viveeditor.dev">temiz geliyor</a> ve editör tek bir satır kodla her siteye ekleniyor.</p>
<ul><li><p>Türkçe karakterlerle sorunsuz kısayollar</p></li><li><p>Ekran okuyucu ve klavye desteği</p></li></ul>
<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><div><p>Sürüm notlarını yaz</p></div></li><li data-type="taskItem" data-checked="false"><div><p>Duyuruyu yayınla</p></div></li></ul>
<pre data-language="javascript"><code class="language-javascript">import { upgradeAll } from 'viveeditor'

upgradeAll({ locale: 'tr' })</code></pre>
<table><tbody><tr><th><p>Özellik</p></th><th><p>viveEditor</p></th><th><p>Klasik editör</p></th></tr><tr><td><p>Lisans</p></td><td><p>MIT, ücretsiz</p></td><td><p>Ücretli</p></td></tr><tr><td><p>Kurulum</p></td><td><p>Tek satır</p></td><td><p>Yapılandırma dosyası</p></td></tr></tbody></table>
<blockquote><p>Kurulum beş dakika sürdü, eski editörü hemen kaldırdık.</p></blockquote>
<p>Metni seçin, araç kutusu seçimin üstünde açılır. Boş bir satırda / yazın, blok menüsü gelir. Alttaki kelime sayısına dokunun, okunabilirlik puanını görün.</p>
`

const demoUpload: ImageUploader = (file, { signal, onProgress }) =>
  new Promise((resolve, reject) => {
    let step = 0
    const timer = setInterval(() => {
      step++
      onProgress(step / 8)
      if (step < 8) return
      clearInterval(timer)
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    }, 100)
    signal.addEventListener(
      'abort',
      () => {
        clearInterval(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })

const params = new URLSearchParams(window.location.search)
const editor = await Editor.create(host, {
  extensions: [
    ...basicExtensions,
    ...listExtensions,
    ...formatExtensions,
    OfficePaste,
    TaskItem.configure({ checkboxLabel: 'Tamamlandı' }),
    TaskList,
    Table,
    Search,
    CharacterCount.configure({ limit: Number(params.get('limit')) || null }),
    Image.configure({
      upload: demoUpload,
      allowBase64: true,
      labels: { uploading: 'Yükleniyor', failed: 'Görsel eklenemedi', missingAlt: 'Alt metin yok' },
    }),
    Embed.configure({
      facade: params.has('facade'),
      labels: { play: 'Oynat', invalid: 'Bu içerik desteklenmiyor' },
    }),
    CodeBlock.configure({ languageLabel: 'Dil', plainTextLabel: 'Düz metin' }),
    CodeHighlight.configure({ highlighter: shikiHighlighter(() => import('shiki')) }),
  ],
  label: 'Makale metni',
  content: params.has('empty') ? '' : content,
})
const theme = params.get('theme')
createUI(editor, {
  locale: params.get('locale') ?? 'tr',
  theme: theme === 'dark' || theme === 'auto' ? theme : 'light',
  files: {
    docx: () => import('@viveeditor/docx'),
    markdown: () => import('@viveeditor/markdown'),
    upload: demoUpload,
    fileName: 'Sürüm notları',
  },
})

const render = (): void => {
  output.textContent = editor.getHTML()
}
editor.on('change', render)
render()

Object.assign(window, { viveEditor: editor })
