# Erişilebilirlik

> viveEditor WCAG 2.2 AA'yı nasıl karşılar, hangi tuşlarla yönetilir, ekran okuyucular ne duyar ve sizin eklemeniz gerekenler.

URL: https://editor.vivepdf.com/dokumantasyon/erisilebilirlik/
Son güncelleme: 2026-11-01

viveEditor WCAG 2.2 AA düzeyini hedefler: her araç klavyeyle çalışır, durum değişiklikleri ekran okuyuculara bildirilir ve editör yazarların görsellerini açıklamasına yardım eder. Bu sayfa editörün neler yaptığını ve etiket gibi sizin sağlamanız gereken birkaç şeyi anlatıyor.

## Nasıl test ediliyor

Her test sayfası, her panel ve iki tema da axe ile WCAG 2.2 AA'ya göre denetlenir; bir hata derlemeyi durdurur. `/` menüsü ve öneri listeleri, seçenek seçerken odağı metinde tutar (combobox kalıbı); bir klavye testi her seçeneğe ulaşılabildiğini kanıtlar.

## Editöre bir ad verin

Ekran okuyucuların yazma alanı için bir ada ihtiyacı var. Editörü oluşturduğunuz her yerde `label` verin:

```ts
import { mountEditor } from 'viveeditor'

mountEditor(document.querySelector('#editor'), { label: 'Makale metni' })
```

Bileşenler aynı `label` özelliğini, `<vive-editor>` de `label` özniteliğini alır. Textarea kullanıyorsanız ona bağlı görünür bir `<label for>` bırakın; `label` vermezseniz editör bu metni kullanır.

`locale` değerini de verin ya da `<html lang="...">` değerini doğru ayarlayın; böylece araç adları ve mesajlar sayfanın dilinde okunur. Arayüzün Türkçe ve İngilizce metinleri var.

## Klavye

| Tuşlar | Ne yapar |
| --- | --- |
| `Alt+F10` | Odağı metinden araç çubuğuna taşır |
| `Ctrl+K` | Bağlantı panelini açar |
| `Ctrl+F` | Bul ve değiştiri açar |
| `/` | Blok menüsünü açar |
| `Esc` | Seçim balonunu ya da yüklenmekte olan paneli kapatır |
| `Tab` / `Shift+Tab` | Liste maddesinin düzeyini değiştirir |
| `Tab` | Tabloda sonraki hücreye geçer |
| `Ctrl+Enter` | Yapılacaklar maddesini işaretler |
| `Ctrl+Shift+L`, `E`, `R`, `J` | Sola, ortaya, sağa hizalar ya da iki yana yaslar |
| `Ctrl+J` | Eklediyseniz yapay zekâ asistanını açar |

Mac'te tabloda `Ctrl` yazan yerlerde `⌘` kullanın. Yazarken Markdown kısayolları da çalışır: başlık için `## `, liste için `- `, yapılacaklar listesi için `[ ]` gibi. Tam liste [Araç çubuğu ve kısayollar](https://editor.vivepdf.com/dokumantasyon/arac-cubugu-ve-kisayollar/) sayfasında.

## Ekran okuyucular ne duyar

- Dosya menüsündeki ilerleme `role="status"` bölgesiyle bildirilir; hatalar görünür bir `role="alert"` uyarısında çıkar.
- Bir panel yüklenirken yerinde `role="status"` taşıyan bir yer tutucu durur. Yükleme başarısız olursa yerine Tekrar dene düğmeli bir mesaj gelir.
- Form yüklemeleri beklerken `role="status"` taşıyan bir uyarı formun gönderileceğini söyler ve editör `aria-busy` olarak işaretlenir.
- Zorunlu bir editör gönderimde boşsa editör `aria-invalid="true"` olarak işaretlenir, odağı alır ve kendi mesajınızı göstermek için kullanabileceğiniz `vive:invalid` olayını tetikler.

## Görseller ve alternatif metin

Görsel paneli "Görmeyenler için görseli kısaca anlatın" ipucuyla alternatif metin ister. Yazar bir görseli süs amaçlı olarak da işaretleyebilir.

- Kayıtlı belgede `alt: null` açıklamanın eksik olduğunu, `alt: ''` görselin süs amaçlı olduğunu gösterir.
- `Image` eklentisinin `requireAlt` seçeneği (`'off'`, `'warn'` ya da `'block'`) alternatif metin hatırlatmasının nasıl davranacağını belirler.
- `imagesWithoutAlt` sorgusu, örneğin yayımlamadan önce, hâlâ açıklama bekleyen görselleri listeler.

## Renkler ve yerleşim

- Açık, koyu ve otomatik temalar var. Koyu temada yazarın seçtiği yazı renkleri okunur kalsın diye ekranda açılır; kayıtlı HTML saklanan rengi korur.
- 560 pikselden dar ekranlarda araçların çoğu "Diğer araçlar" menüsüne geçer.
- İçeriği gösteren sayfalar, görseller küçük ekranlara sığsın diye `img { max-width: 100%; height: auto; }` kuralını eklemelidir.

## Okunabilirlik göstergesi

Arayüzde kelime, cümle, ortalama cümle uzunluğu, okuma süresi ve okunabilirlik puanını gösteren bir gösterge var. Puan Ateşman ya da Flesch formülüyle hesaplanır; `createUI` içinde `readability: 'atesman'` ya da `readability: 'flesch'` ile seçin, göstergeyi gizlemek için `readability: false` verin.
