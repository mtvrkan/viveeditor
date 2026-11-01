# Yapay zekâ yardımı

> Yapay zekâ yardımını bir sağlayıcı işleviyle kendi sunucunuza bağlayın; yanıtlar düz metin olarak gösterilir ve eklenir.

URL: https://editor.vivepdf.com/dokumantasyon/yapay-zeka/
Son güncelleme: 2026-11-01

Yapay zekâ yardımı, seçili metin üzerinde "Daha iyi yaz" ya da "Özetle" gibi işlemler sunar. viveEditor paneli ve yanıtların nasıl gösterilip ekleneceğine dair kuralları sağlar. Kendisi hiçbir yere bir şey göndermez: siz kendi sunucunuzu çağıran bir sağlayıcı işlevi verirsiniz, yapay zekâ hizmetiyle sunucunuz konuşur.

Yapay zekâ yardımı yalnızca npm paketi olarak gelir; tek betikli sürümde yoktur.

## Kurulum

1. Arayüzü kurun: `npm install @viveeditor/ui @viveeditor/core`.
2. İsteği kendi adresinize gönderen bir `generate` işlevi yazın.
3. `aiAssistant`'ı `createUI`'nin `plugins` listesine ekleyin.

```ts
import { createUI } from '@viveeditor/ui'
import { type AiRequest, aiAssistant } from '@viveeditor/ui/extras'

async function generate(request: AiRequest): Promise<string> {
  const response = await fetch('/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({
      action: request.action,
      instruction: request.instruction,
      text: request.text,
      context: request.context,
      locale: request.locale,
    }),
    signal: request.signal,
  })
  if (!response.ok) throw new Error('AI request failed')
  const { text } = await response.json()
  return text
}

createUI(editor, { plugins: [aiAssistant({ provider: { generate } })] })
```

`/ai` kendi adresinizin yerini tutar; `csrfToken` sitenizin zaten kullandığı belirteçtir. Yanıtın biçimini siz belirlersiniz.

## Yardımı açma

- Metni seçip seçim balonundaki AI düğmesine basın.
- `Ctrl+J`'ye basın (Mac'te `⌘+J`).
- `/ai` yazıp `/` menüsünden "Yapay zekâ"yı seçin.

Panelde işlemler, kendi isteğinizi yazacağınız bir alan ve yanıt geldiğinde "Seçimin yerine koy", "Altına ekle", "Yeniden dene" ve "Vazgeç" düğmeleri bulunur. "Durdur" süren isteği bitirir, `Esc` paneli kapatır.

## Sağlayıcı sözleşmesi

`provider.generate(request)` ya bir metin döndüren bir promise ya da metin parçaları veren bir async iterable döndürür. Yanıtı geldikçe akıtmak için async iterable döndürün.

| Alan | Anlamı |
| --- | --- |
| `action` | `improve`, `fix`, `shorten`, `expand`, `tone`, `translate`, `summarize`, `continue` ya da yazılan istek için `custom`. |
| `instruction` | Yazarın kendi isteği; yalnızca `custom` için. |
| `text` | Seçili metin. |
| `context` | `before` ve `after`: seçimin her iki yanındaki en çok 2.000 karakterlik metin. |
| `locale` | Editörün dili, `tr` ya da `en`. |
| `signal` | Bir `AbortSignal`. Onu `fetch`'e verin; yazar durdurduğunda, paneli kapattığında ya da süre dolduğunda tetiklenir. |

`actions` seçeneği panelde hangi işlemlerin hangi sırayla görüneceğini belirler, örneğin `actions: ['fix', 'shorten', 'summarize']`. "Devam ettir" ve yazılan istek seçim olmadan da çalışır; diğer işlemler seçili metin ister.

Akış yapan bir sağlayıcı yanıt gövdesini parça parça okuyabilir:

```ts
import type { AiRequest } from '@viveeditor/ui/extras'

async function* stream(request: AiRequest): AsyncIterable<string> {
  const response = await fetch('/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ action: request.action, text: request.text }),
    signal: request.signal,
  })
  if (!response.ok || !response.body) throw new Error('AI request failed')
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    yield value
  }
}
```

## Sınırlar

| Sınır | Değer |
| --- | --- |
| Seçili metin | 20.000 karakter; daha uzun seçim gönderilmez, panel daha kısa bir bölüm seçmenizi ister |
| Bağlam | Her iki yanda 2.000 karakter |
| Yazılan istek | 1.000 karakter |
| Yanıt | 20.000 karakter; fazlası kesilir |
| Süre | İstek başına 2 dakika; sonra durdurulur |

Aynı anda tek istek çalışır. Yenisini başlatmak öncekini iptal eder; geç gelen parçalar atılır.

## Yanıtlar nasıl eklenir

Yapay zekâ yanıtı güvenilmeyen metindir. Panelde düz metin olarak gösterilir ve HTML olarak değil, düz paragraflar olarak eklenir. Yazar "Seçimin yerine koy" ya da "Altına ekle"yi seçmeden belgede hiçbir şey değişmez; tek geri alma yanıtı kaldırır. Yanıt yazılırken seçili metin değiştiyse "Seçimin yerine koy" kapanır, yanıt yalnızca altına eklenebilir.

Yanıttaki başlık ve listeleri korumak isterseniz `markdown` seçeneğine bir Markdown çeviricisi yükleyen işlev verebilirsiniz. Çeviricinin ürettiği HTML'den görseller, medya ve betikler, `links: true` vermediğiniz sürece bağlantılar da atılır; kalan içerik editör şemasından geçer:

```ts
import { aiAssistant } from '@viveeditor/ui/extras'

aiAssistant({
  provider: { generate },
  markdown: async () => (await import('@viveeditor/markdown')).markdownToHtml,
})
```

## Yapay zekâ sunucusu için denetim listesi

Sağlayıcı her zaman kendi adresinizi çağırmalı; tarayıcıdan doğrudan bir yapay zekâ sağlayıcısına gidilmemelidir.

- API anahtarını sunucuda tutun. Oturum açmış kullanıcı ve CSRF belirteci isteyin.
- Sistem istemini, modeli ve `max_tokens` değerini sunucuda sabitleyin. Yalnızca izin verdiğiniz işlemleri kabul edin ve girdi boyutunu sunucuda yeniden sınırlayın.
- Kullanıcı başına kota ve istek sınırı koyun; yapay zekâ sağlayıcısında harcama tavanı belirleyin.
- Belge metnini günlüklere yazmayın ya da maskeleyin. Yazarlara metinlerinin üçüncü bir tarafa gönderildiğini, KVKK ve GDPR gibi gizlilik kurallarınızın gerektirdiği biçimde bildirin.
- İleride modele araç ya da bilgi getirme (retrieval) yeteneği verirseniz, belgeden gelen istem enjeksiyonu ciddi bir risk olur; o tasarımı ayrıca gözden geçirin.

## İlgili sayfalar

- [Güvenlik ve CSP](https://editor.vivepdf.com/dokumantasyon/guvenlik-ve-csp/)
- [Araç çubuğu ve kısayollar](https://editor.vivepdf.com/dokumantasyon/arac-cubugu-ve-kisayollar/)

## viveEditor hangi yapay zekâ hizmetini kullanıyor?

Hiçbirini. viveEditor kendisi hiçbir yere bir şey göndermez. İsteğin nereye gideceğine sağlayıcı işleviniz karar verir; istek kendi sunucunuza gitmelidir.

## Yapay zekâ yanıtı yazar istemeden belgeyi değiştirebilir mi?

Hayır. Yanıt önce gösterilir; yazar "Seçimin yerine koy" ya da "Altına ekle"yi seçmeden hiçbir şey uygulanmaz. Tek geri alma yanıtı kaldırır.
