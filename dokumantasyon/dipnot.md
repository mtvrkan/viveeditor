# Dipnotlar

> Yazarın yerinde düzenlediği dipnotlar ekleyin; yayındaki sayfada renderFootnotes ile numaralayıp sayfa sonunda listeleyin.

URL: https://editor.vivepdf.com/dokumantasyon/dipnot/
Son güncelleme: 2026-11-01

Dipnot eklentisi, yazarın metnin herhangi bir yerine not eklemesini ve sayfa sonuna gitmeden notu orada yazmasını sağlar. Not, cümledeki yerinde saklanır. Yayındaki sayfada `renderFootnotes` notları numaralar ve sayfa sonunda listeler.

Dipnotlar yalnızca npm paketi olarak gelir; tek betikli sürümde yoktur.

## Kurulum

1. Eklentiyi ve arayüzü kurun: `npm install @viveeditor/ext-footnote @viveeditor/ui @viveeditor/core`.
2. `Footnote` eklentisini editörün eklenti listesine ekleyin ve stil dosyasını içe aktarın.
3. `/` menüsündeki giriş için `footnoteTools()`'u `createUI`'nin `plugins` listesine ekleyin.

```ts
import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { Footnote } from '@viveeditor/ext-footnote'
import { createUI } from '@viveeditor/ui'
import { footnoteTools } from '@viveeditor/ui/extras'
import '@viveeditor/ext-footnote/style.css'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [...basicExtensions, Footnote],
})

createUI(editor, { plugins: [footnoteTools()] })
```

## Dipnot yazma

- `/` menüsünden "Dipnot"u seçin. İmlecin olduğu yerde numaralı bir işaret belirir ve altında küçük bir kutu açılır.
- Notu kutuya yazın. `Enter` ya da `Esc` ana metne döner.
- Notu düzenlemek için işareti yeniden seçin.

Koddan `editor.commands.insertFootnote()` imlecin olduğu yere boş bir not ekler.

Notlarda yalnızca kalın, italik ve bağlantı kalır. Diğer biçimler kaldırılır ve bir not bağlantının içinde duramaz. Bir not en çok 5.000 karakter (`MAX_FOOTNOTE_LENGTH`) tutar. Editörde işaretler siz yazdıkça sırayla numaralanır.

## Ne saklanır

```html
<p>Çalışma iki yıl sürdü.<sup data-footnote="">Sonuçlar <em>2025</em> yılında yayımlandı.</sup></p>
```

[Sunucu temizleyicisi](https://editor.vivepdf.com/dokumantasyon/sunucuda-temizleme/) dipnotları tam olarak bu biçimde tutar. Dipnotun içinde yalnızca metin, kalın, italik ve bağlantı kalır. Duramayacağı bir yere konmuş dipnot, bahsetme ya da formül düz metne indirilir.

## Yayındaki sayfalar

İçeriği taşıyan öğe üzerinde `renderFootnotes`'u çağırın:

```ts
import { renderFootnotes } from '@viveeditor/ext-footnote/render'

const article = document.querySelector('article')
if (article) renderFootnotes(article, { backLabel: 'Metne dön' })
```

- Metindeki her not, listedeki karşılığına bağlanan bir numaraya dönüşür.
- Notlar, o öğenin sonuna eklenen bir `<ol class="vive-footnotes">` içinde listelenir.
- Her girişe, metindeki yerine dönen bir ↩ bağlantısı eklenir. `backLabel` bu bağlantının erişilebilir adıdır; varsayılanı İngilizce "Back to text"tir, Türkçe sayfalarda kendiniz verin.
- Bir bağlantının içindeki not, kendi bağlantısı olmadan düz bir numaraya dönüşür.
- Önceden işlenmiş notlar atlanır; yeniden çağırmak güvenlidir. İşlev, işlediği not sayısını döndürür.

## Yazdırma ve kaydetme

Yazar Dosya menüsünden yazdırdığında notlar aynı şekilde numaralanır ve yazdırılan sayfanın sonunda listelenir.

Markdown olarak kaydederken dipnotlar `[^n]` biçiminde, tanımları sonda olacak şekilde yazılır. Word olarak kaydederken üst simge numaralar ve sonda notlar yazılır. Bir Word dosyası açıldığında içindeki dipnotlar alınmaz.

## İlgili sayfalar

- [Dosya açma, kaydetme ve yazdırma](https://editor.vivepdf.com/dokumantasyon/dosya-ac-kaydet-yazdir/)
- [Formüller](https://editor.vivepdf.com/dokumantasyon/formul/)
- [Sunucuda temizleme](https://editor.vivepdf.com/dokumantasyon/sunucuda-temizleme/)

## Dipnot numaraları HTML'de saklanıyor mu?

Hayır. Not metni cümledeki yerinde saklanır. Numaraları yayındaki sayfada renderFootnotes, yazdırırken de yazdırma işlemi ekler.

## Bir dipnot hangi biçimleri taşıyabilir?

Yalnızca kalın, italik ve bağlantı. Diğer biçimler kaldırılır.
