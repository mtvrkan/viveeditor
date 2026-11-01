# Word'den yapıştırma

> Word, Google Docs ve LibreOffice'ten temiz yapıştırma; sahte madde işaretleri gerçek listelere dönüşür, Markdown metni biçimlenir.

URL: https://editor.vivepdf.com/dokumantasyon/word-den-yapistirma/
Son güncelleme: 2026-11-01

`@viveeditor/ext-office-paste` Word, Google Docs ve LibreOffice'ten yapıştırılan içeriği temizler. Word'ün sahte madde işaretlerini ve numaralarını gerçek, iç içe listelere çevirir, Word'ün konu başlığı ve alıntı stillerini korur ve Google Docs'un yanlış iç içe koyduğu listeleri düzeltir. Bu sayfa ayrıca düz metin olarak yapıştırılan Markdown'ı biçimli içeriğe çeviren `MarkdownPaste` eklentisini anlatır.

## Kurulum

```ts
import { Editor } from '@viveeditor/core'
import { OfficePaste } from '@viveeditor/ext-office-paste'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [
    OfficePaste.configure({
      onDropped: ({ images }) => console.warn(`${images} görsel yapıştırılamadı`),
    }),
  ],
})
```

Tek betikli kurulumda eklenti zaten yüklüdür. Tek seçeneği `onDropped`'dur.

## Neler düzeltilir

Word'den gelen içerikte:

- Word'ün listeleri gerçek liste değil, işaretli paragraflardır. Bu paragraflar gerçek, iç içe madde işaretli ve numaralı listelere çevrilir. Liste türü ve başlangıç numarası Word'ün liste tanımından, yoksa işaretin kendisinden alınır.
- İşaret karakterleri her yerden kaldırılır.
- Word'ün "Konu Başlığı" stili 1. düzey başlık, "Alıntı" stili alıntı olur.

Tüm kaynaklarda:

- Bir listenin içinde doğrudan duran alt liste, üstündeki maddenin içine taşınır. Google Docs listeleri bu biçimde kopyalar.
- Hem altı çizili hem üstü çizili metin iki biçimi birden korur.
- Kopyalayan bilgisayardaki dosyalara (`file:` ve `blob:` adresleri) giden görseller atlanır ve sayılır.

Word, Google Docs ya da LibreOffice'ten gelmeyen HTML bu eklentide hiç değiştirilmez. Her yapıştırma, kaynağı ne olursa olsun, ardından belgenin kurallarından geçer; bilinmeyen biçimlendirme çıktıya ulaşmaz.

## Atlanan görseller

Kopyalayan bilgisayardaki dosyalara giden görseller yapıştırılamaz. Atlanan görsel olduğunda `onDropped` şu bilgiyle çağrılır:

| Alan | Değer |
| --- | --- |
| `source` | `'word'`, `'docs'` ya da `'libreoffice'` |
| `images` | Atlanan görsel sayısı |

Yazara görseli ayrıca yüklemesini söyleyen bir mesaj göstermek için bu çağrıyı kullanın. Görsel yükleme için [Görseller ve yükleme](https://editor.vivepdf.com/dokumantasyon/gorseller-ve-yukleme/) sayfasına bakın.

## Yardımcı fonksiyonlar

Aynı temizliği yapıştırma dışında kullanmak için paket üç fonksiyon dışa aktarır:

| Fonksiyon | Döndürdüğü |
| --- | --- |
| `detectOffice(html)` | `'word'`, `'docs'`, `'libreoffice'` ya da `null` |
| `cleanOffice(html)` | `{ html, source, droppedImages }` |
| `cleanOfficeHtml(html)` | Yalnızca temizlenmiş HTML |

## Markdown yapıştırma

`@viveeditor/markdown/paste` paketindeki `MarkdownPaste`, düz metin olarak yapıştırılan Markdown'ı biçimli içeriğe çevirir. Dönüştürücü yalnızca gerektiğinde yüklenir:

```ts
import { MarkdownPaste } from '@viveeditor/markdown/paste'

const markdownPaste = MarkdownPaste.configure({ load: () => import('@viveeditor/markdown') })
```

Dönüştürme yalnızca şu koşullarda yapılır:

- panoda HTML yoktur, yalnızca düz metin vardır,
- metin Markdown'a benzer: başlık, çitli kod, alıntı, tablo, kalın yazı, bağlantı, görev maddesi ya da en az iki liste satırı içerir,
- imleç bir kod bloğunda değildir.

Dönüştürücü yüklenemezse metin düz metin olarak yapıştırılır. 1 milyon karakterden uzun metinler dönüştürülmez. Markdown içindeki ham HTML hiçbir zaman geçirilmez. Bir metnin dönüştürülüp dönüştürülmeyeceğini önceden görmek için aynı paketteki `looksLikeMarkdown(text)` fonksiyonunu kullanabilirsiniz.

Tek betikli CDN sürümünde Markdown yapıştırma açıktır; dönüştürücü ilk kullanımda ek dosyadan yüklenir. Markdown dosyalarını açıp kaydetmek için [Dosya aç, kaydet, yazdır](https://editor.vivepdf.com/dokumantasyon/dosya-ac-kaydet-yazdir/) sayfasına bakın.

## Word'den yapıştırdığım görseller neden gelmiyor?

Word bazı görselleri kopyalayan bilgisayardaki dosyalara giden adreslerle panoya koyar. Bu görseller tarayıcıdan okunamaz ve atlanır; onDropped kaç tanesinin atlandığını bildirir.

## Tek betikli kurulumda Word'den yapıştırma açık mı?

Evet. Office yapıştırma eklentisi tek betikli kurulumda varsayılan olarak yüklüdür; Markdown yapıştırma da CDN sürümünde açıktır.

## Markdown yapıştırma hangi durumda devreye girer?

Yalnızca panoda HTML yoksa ve düz metin Markdown'a benziyorsa. Kod bloğunun içine yapıştırılan metin hiçbir zaman dönüştürülmez.
