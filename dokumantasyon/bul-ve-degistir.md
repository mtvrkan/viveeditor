# Bul ve değiştir

> Türkçe büyük harfleri doğru eşleştiren bul ve değiştir; büyük/küçük harf duyarlılığı, tam kelime ve tümünü değiştir seçenekleri.

URL: https://editor.vivepdf.com/dokumantasyon/bul-ve-degistir/
Son güncelleme: 2026-11-01

`@viveeditor/ext-search` editöre bul ve değiştir ekler. Türkçe büyük harfleri doğru eşleştirir: `istanbul` araması `İstanbul` ve `ISTANBUL` sonuçlarını da bulur. Paneli `@viveeditor/ui` sağlar ve `Ctrl+F` (Mac'te `⌘+F`) ile açılır. Bu sayfa paneli, eşleştirme kurallarını ve komutları anlatır.

## Kurulum

```ts
import { Editor } from '@viveeditor/core'
import { Search } from '@viveeditor/ext-search'
import '@viveeditor/ext-search/style.css'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [Search],
})
```

Tek betikli kurulumda arama eklentisi zaten yüklüdür. Tek seçeneği `maxQueryLength` (varsayılan 200): daha uzun arama metinleri bu uzunlukta kesilir.

## Bul ve değiştir paneli

Paneli `Ctrl+F` ya da araç çubuğundaki "Bul ve değiştir" düğmesi açar. Metin seçiliyse ve tek satırsa arama alanına o metin yazılır. Eşleşmeler belgede işaretlenir.

| Öğe | Ne yapar |
| --- | --- |
| Bul | Aranacak metin. Yazdıkça sonuçlar güncellenir. |
| Önceki sonuç, Sonraki sonuç | Eşleşmeler arasında gezer. |
| Büyük/küçük harfe duyarlı | Açıkken harfler birebir eşleşir. |
| Yalnız tam kelime | Açıkken kelimenin bir parçası olan eşleşmeler sayılmaz. |
| Sayaç | Kaçıncı sonuçta olduğunuzu gösterir, örneğin `3 / 12`. Sonuç yoksa "Sonuç yok" yazar. |
| Yerine yaz | Yeni metin. Boş bırakılırsa eşleşmeler silinir. |
| Değiştir | Seçili eşleşmeyi değiştirir ve sonrakine geçer. |
| Tümünü değiştir | Tüm eşleşmeleri tek adımda değiştirir. |

Klavye:

- Arama alanında `Enter` sonraki, `Shift+Enter` önceki sonuca gider.
- "Yerine yaz" alanında `Enter` sıradaki eşleşmeyi değiştirir.
- `Esc` paneli kapatır, işaretleri kaldırır ve sizi metne döndürür.

## Türkçe büyük harfler

Büyük/küçük harf duyarlılığı kapalıyken her harf hem genel hem Türkçe büyük-küçük harf kurallarıyla eşleştirilir:

| Aranan harf | Eşleşen harfler |
| --- | --- |
| `i` | i, I, İ |
| `ı` | ı, I |
| `İ` | İ, i |
| `I` | I, i, ı |

Örneğin `istanbul` araması `İstanbul`, `Istanbul` ve `ISTANBUL` sonuçlarını, `ılık` araması `ILIK` sonucunu bulur. Yalnızca büyük-küçük harf farkı yok sayılır: `s` ile `ş`, `c` ile `ç`, `o` ile `ö` ayrı harflerdir.

"Büyük/küçük harfe duyarlı" açıkken bu kurallar devre dışı kalır ve metin yazıldığı gibi aranır.

## Değiştirmek

"Değiştir" önce bir eşleşmeyi seçer; seçili bir eşleşme varken yeniden basınca onu değiştirir ve sonrakini seçer. "Tümünü değiştir" belgedeki tüm eşleşmeleri tek bir işlemde değiştirir, bu yüzden tek bir geri al hepsini geri getirir.

## Komutlar

Paneli kullanmadan aynı işlemleri kodla yapabilirsiniz:

```ts
editor.commands.setSearch({ query: 'istanbul', replace: 'İstanbul', wholeWord: true })
const { total } = editor.query.searchStatus()
if (total > 0) editor.commands.replaceAll()
editor.commands.clearSearch()
```

| Komut | Ne yapar |
| --- | --- |
| `setSearch(terms)` | Aramayı başlatır ya da günceller: `query`, `replace`, `caseSensitive`, `wholeWord`. |
| `findNext()`, `findPrevious()` | Sonraki ya da önceki eşleşmeyi seçer. |
| `replaceNext()` | Seçili eşleşmeyi değiştirir. |
| `replaceAll()` | Tüm eşleşmeleri değiştirir. |
| `clearSearch()` | Aramayı ve işaretleri kaldırır. |

`editor.query.searchStatus()` `{ total, current }` döndürür: toplam eşleşme sayısı ve seçili eşleşmenin sırası (seçili eşleşme yoksa `0`). Aynı Türkçe eşleştirmeyi başka yerde kullanmak için paketten `caseInsensitivePattern(text)` alınabilir; bir düzenli ifade deseni döndürür.

## Neden "istanbul" araması "İstanbul" sonucunu buluyor?

Büyük/küçük harf duyarlılığı kapalıyken arama hem genel hem Türkçe büyük-küçük harf kurallarını kullanır. Bu yüzden i harfi İ ve I ile, ı harfi I ile eşleşir.

## Tümünü değiştir geri alınabilir mi?

Evet. Tüm değişiklikler tek adımda yapılır, tek bir geri al hepsini geri getirir.

## Arama ş ile s harfini aynı sayar mı?

Hayır. Yalnızca büyük ve küçük harf farkı yok sayılır; ş ile s, ç ile c gibi farklı harfler ayrı kalır.
