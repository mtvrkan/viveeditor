# Araç çubuğu ve kısayollar

> Yüzen araç çubuğu, seçim balonu, / menüsü, blok menüsü, kelime sayacı, okunabilirlik ölçümü ve tüm klavye kısayolları.

URL: https://editor.vivepdf.com/dokumantasyon/arac-cubugu-ve-kisayollar/
Son güncelleme: 2026-11-01

viveEditor'ün arayüzü `@viveeditor/ui` paketinden gelir: metnin altında duran yüzen bir araç çubuğu, metin seçince açılan küçük bir balon, `/` ile açılan blok menüsü ve kelime sayacı. Bu sayfa her parçanın ne yaptığını, nasıl kapatılacağını ve klavye kısayollarını anlatır. Tek betikli kurulumda ve çerçeve bileşenlerinde araç çubuğu zaten açıktır; npm paketleriyle kendiniz kuruyorsanız `createUI` çağırırsınız.

## Arayüzü kurmak

```ts
import { createUI } from '@viveeditor/ui'
import '@viveeditor/ui/style.css'

const ui = createUI(editor, { locale: 'tr', theme: 'auto' })
```

`createUI` editörün bulunduğu kapsayıcıya yerleşir ve editör kapatılınca kendini kaldırır. Yalnızca komutu kayıtlı araçları gösterir: tablo eklentisi yoksa tablo düğmesi de yoktur. Arayüz editörle yalnızca komutlar ve sorgular üzerinden konuşur.

| Seçenek | Ne yapar |
| --- | --- |
| `locale` | `'tr'` ya da `'en'`. Verilmezse sayfanın `lang` değerine bakar; `tr` ile başlıyorsa Türkçe, değilse İngilizce olur. |
| `messages` | Etiketlerin bir kısmını kendi metinlerinizle değiştirir. |
| `theme` | `'light'` (varsayılan), `'dark'` ya da `'auto'`. Marka renginiz için `--ve-accent` CSS değişkenini kullanın. |
| `readability` | `'atesman'`, `'flesch'` ya da `false`. Varsayılan dile göre seçilir. |
| `bubble` | `false` seçim balonunu kapatır. |
| `slash` | `false` `/` menüsünü kapatır. |
| `source` | `false` HTML kaynağı düğmesini kaldırır. |
| `files` | Dosya menüsü; `false` gizler. Ayrıntılar [Dosya aç, kaydet, yazdır](https://editor.vivepdf.com/dokumantasyon/dosya-ac-kaydet-yazdir/) sayfasında. |
| `plugins` | Bahsetme, emoji, şablon gibi ek menüler `@viveeditor/ui/extras` paketinden buraya takılır. |
| `onError` | Arayüzde oluşan hataları alır. |

## Yüzen araç çubuğu

Araç çubuğu yazı alanının altında durur ve uzun bir yazıda aşağı kaydırırken ekranın altında kalır. Telefonda ekran klavyesi açılınca onun üstüne çıkar.

Soldan sağa şunlar vardır: blok türü düğmesi; kalın, italik, altı çizili, üstü çizili ve satır içi kod; yazı rengi ve vurgu; madde işaretli liste, numaralı liste, görev listesi, alıntı, tablo, görsel ve video; hizalama; bağlantı ile bul ve değiştir; geri al, yinele, Dosya ve HTML kaynağı. En sonda kelime sayacı durur.

Alan 560 pikselden darsa yalnızca kalın, italik ve bağlantı yerinde kalır, diğer araçlar "Diğer araçlar" menüsüne geçer. Daha geniş alanlarda sığmayan araçlar belirli bir sırayla bu menüye taşınır; menü yalnızca taşınan araçları gösterir.

HTML kaynağı düğmesi belgenin HTML'ini düzenlenebilir bir metin alanında açar. Kaynak açıkken diğer araçlar devre dışıdır; kapattığınızda değişiklikler editöre uygulanır.

## Seçim balonu

Metin seçince seçimin hemen üstünde küçük bir araç çubuğu açılır. Dokunmatik ekranlarda, parmağınızın altında kalmaması için seçimin altında açılır. İçinde kalın, italik, bağlantı ve satır içi kod düğmeleri bulunur; [yapay zeka asistanı](https://editor.vivepdf.com/dokumantasyon/yapay-zeka/) gibi eklentiler kendi düğmelerini buraya ekler. Bir görsel seçiliyken balon açılmaz. `Esc` balonu kapatır, `bubble: false` tamamen kaldırır.

## / menüsü

Bir paragrafın başında `/` yazınca blok ekleme menüsü açılır. Ardından yazdığınız harfler listeyi süzer. Arama Türkçe harfleri sadeleştirir, bu yüzden `/baslik` da "Başlık" girişini bulur; İngilizce anahtar kelimeler de çalışır (`/table`, `/video`).

Menüdeki girişler: Başlık 1, 2 ve 3, madde işaretli liste, numaralı liste, görev listesi, alıntı, kod bloğu, tablo (başlık satırlı 3×3), görsel, video ve yatay çizgi. Görsel ve video doğrudan eklenmez, ilgili paneli açar.

`↑` ve `↓` ile gezinin, `Enter` ya da `Tab` ile seçin, `Esc` ile kapatın. Odak hep metinde kalır, ekran okuyucu etkin girişi duyurur. Bahsetme, emoji, formül, dipnot ve şablon eklentileri bu menüye kendi girişlerini ekler.

## Blok menüsü

Araç çubuğunun başındaki düğme imlecin bulunduğu bloğun türünü gösterir: Paragraf, Başlık 2, Alıntı gibi. Açınca paragraf, Başlık 1–3, listeler, alıntı ve kod bloğu arasında geçiş yaparsınız. Paragraf seçmek bloğu sarmalayan listeyi ya da alıntıyı da kaldırır.

## Kelime sayacı ve okunabilirlik

Araç çubuğunun sonundaki sayaç belgedeki kelime sayısını gösterir. [Karakter sınırı](https://editor.vivepdf.com/dokumantasyon/karakter-siniri/) tanımladıysanız onun yerine kullanılan ve kalan karakteri gösterir. Sayaç yazmaya kısa bir ara verdiğinizde güncellenir.

Sayaca tıklayınca "Metin ölçümü" paneli açılır:

- okunabilirlik puanı (0–100) ve zorluk derecesi,
- kelime ve cümle sayısı,
- ortalama cümle uzunluğu,
- okuma süresi (dakikada 200 kelime üzerinden).

Türkçe arayüz Ateşman formülünü, İngilizce arayüz Flesch formülünü kullanır. Başka bir formül için `readability` verin; `false` puanı gizler, istatistikler kalır. Puan en az 10 kelimeden sonra hesaplanır.

| Derece | Ateşman | Flesch |
| --- | --- | --- |
| Çok kolay | 90 ve üstü | 80 ve üstü |
| Kolay | 70–89 | 60–79 |
| Orta | 50–69 | 50–59 |
| Zor | 30–49 | 30–49 |
| Çok zor | 30'un altı | 30'un altı |

Aynı ölçümü kendi kodunuzda kullanmak için `@viveeditor/ui` paketinden `measureText(text, 'atesman')` çağırabilirsiniz.

## Klavye kısayolları

Mac'te `Ctrl` yerine `⌘`, `Alt` yerine `⌥` kullanılır. Araç çubuğundaki ipuçları da kısayolu işletim sisteminize göre gösterir. Bir kısayol, ilgili eklenti yüklüyse çalışır.

| İşlem | Windows ve Linux | Mac |
| --- | --- | --- |
| Kalın | `Ctrl+B` | `⌘+B` |
| İtalik | `Ctrl+I` | `⌘+I` |
| Altı çizili | `Ctrl+U` | `⌘+U` |
| Üstü çizili | `Ctrl+Shift+S` | `⌘+⇧+S` |
| Satır içi kod | `Ctrl+E` | `⌘+E` |
| Vurgu | `Ctrl+Shift+H` | `⌘+⇧+H` |
| Başlık 1–6 | `Ctrl+Alt+1` … `6` | `⌘+⌥+1` … `6` |
| Madde işaretli liste | `Ctrl+Shift+8` | `⌘+⇧+8` |
| Numaralı liste | `Ctrl+Shift+7` | `⌘+⇧+7` |
| Görev listesi | `Ctrl+Shift+9` | `⌘+⇧+9` |
| Alıntı | `Ctrl+Shift+B` | `⌘+⇧+B` |
| Kod bloğu | `Ctrl+Alt+C` | `⌘+⌥+C` |
| Sola hizala | `Ctrl+Shift+L` | `⌘+⇧+L` |
| Ortala | `Ctrl+Shift+E` | `⌘+⇧+E` |
| Sağa hizala | `Ctrl+Shift+R` | `⌘+⇧+R` |
| İki yana yasla | `Ctrl+Shift+J` | `⌘+⇧+J` |
| Bağlantı | `Ctrl+K` | `⌘+K` |
| Bul ve değiştir | `Ctrl+F` | `⌘+F` |
| Geri al | `Ctrl+Z` | `⌘+Z` |
| Yinele | `Ctrl+Shift+Z` ya da `Ctrl+Y` | `⌘+⇧+Z` ya da `⌘+Y` |
| Aynı paragrafta yeni satır | `Shift+Enter` | `⇧+Enter` |
| Araç çubuğuna geç | `Alt+F10` | `⌥+F10` |
| Yapay zeka asistanı | `Ctrl+J` | `⌘+J` |

Yapay zeka kısayolu yalnızca [yapay zeka asistanı](https://editor.vivepdf.com/dokumantasyon/yapay-zeka/) eklentisi takılıysa çalışır.

### Gezinme

- Araç çubuğunda `←` ve `→` düğmeler arasında, `Home` ve `End` başa ve sona gider. `Esc` sizi metne geri götürür.
- Listede `Tab` maddeyi içeri alır, `Shift+Tab` dışarı çıkarır.
- Tabloda `Tab` sonraki hücreye geçer, son hücrede yeni satır açar; `Shift+Tab` önceki hücreye döner.
- Kod bloğunda `Tab` girinti ekler, `Shift+Tab` geri alır.
- Tablodan ya da kod bloğundan klavyeyle çıkmak için önce `Esc`, sonra `Tab` tuşuna basın; odak editörden sonraki öğeye geçer.
- Paneller ve menüler `Esc` ile kapanır, odak açıldıkları düğmeye ya da metne döner.

### Yazarken dönüşenler

Satır başında yazdığınız bazı işaretler bloğa dönüşür:

| Yazın | Sonuç |
| --- | --- |
| `#` ile `######` arası ve boşluk | Başlık 1–6 |
| `-`, `*` ya da `+` ve boşluk | Madde işaretli liste |
| `1.` ve boşluk | Numaralı liste (başka bir sayı o sayıdan başlatır) |
| `[ ]` ve boşluk | Görev listesi (`[x]` işaretli başlar) |
| `>` ve boşluk | Alıntı |
| `` ``` `` ve boşluk | Kod bloğu (dil adıyla da yazılabilir) |
| `---` | Yatay çizgi |

Metin içinde `**kalın**` ya da `__kalın__`, `*italik*` ya da `_italik_`, `~~üstü çizili~~` ve ters tırnak içinde satır içi kod da yazarken biçimlenir.

## Araç çubuğunu tamamen kapatabilir miyim?

Evet. Çerçeve bileşenlerinde ve mountEditor ile ui false verin; npm ile kendiniz kuruyorsanız createUI çağırmayın. Klavye kısayolları eklentilerden geldiği için araç çubuğu olmadan da çalışır.

## Okunabilirlik puanı neden çizgi olarak görünüyor?

Puan en az 10 kelimeden sonra hesaplanır. Daha kısa metinlerde panel "Puan için en az 10 kelime yazın." der; kelime, cümle ve okuma süresi yine gösterilir.

## Bir aracı neden göremiyorum?

Araç çubuğu yalnızca komutu kayıtlı araçları gösterir. Örneğin tablo eklentisi yüklü değilse tablo düğmesi de çıkmaz. Dar alanlarda bazı araçlar Diğer araçlar menüsüne taşınır.
