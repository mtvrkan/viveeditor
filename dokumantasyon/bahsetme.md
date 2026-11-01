# Bahsetme (@)

> Mention eklentisi ve mentionMenu ile @ bahsetme ekleyin, denetlenen kimlikleri saklayın ve her bahsetmeyi sunucuda yeniden doğrulayın.

URL: https://editor.vivepdf.com/dokumantasyon/bahsetme/
Son güncelleme: 2026-11-01

Bahsetme, yazarın `@` yazıp sizin verdiğiniz listeden bir kişi, ekip ya da başka bir kayıt seçmesini sağlar. Editör yalnızca anlamsız bir kimlik ve düz metin bir etiket saklar. Kimliğin gerçekte kime ait olduğuna, kimden bahsedilebileceğine ve kime bildirim gideceğine sunucunuz karar verir.

Bahsetme yalnızca npm paketi olarak gelir; tek betikli sürümde yoktur.

## Kurulum

1. Eklentiyi ve arayüzü kurun: `npm install @viveeditor/ext-mention @viveeditor/ui @viveeditor/core`.
2. `Mention` eklentisini editörün eklenti listesine ekleyin.
3. `@viveeditor/ui/extras` içindeki `mentionMenu`'yü `createUI`'nin `plugins` listesine ekleyin ve eşleşen kayıtları döndüren bir `items` işlevi verin.

```ts
import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { Mention } from '@viveeditor/ext-mention'
import { createUI } from '@viveeditor/ui'
import { mentionMenu } from '@viveeditor/ui/extras'
import '@viveeditor/ext-mention/style.css'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [...basicExtensions, Mention],
})

createUI(editor, {
  plugins: [
    mentionMenu({
      items: async (query, signal) => {
        const response = await fetch(`/mentions?q=${encodeURIComponent(query)}`, { signal })
        if (!response.ok) return []
        return response.json()
      },
    }),
  ],
})
```

`/mentions` sizin kendi arama adresinizin yerini tutar. Döndürdüğünüz her kayıtta `id`, `label` ve isteğe bağlı `description` bulunur.

## Menü nasıl çalışır

- Menü, satır başında ya da bir boşluktan sonra `@` yazılınca açılır. Arama metni en çok 32 harf, rakam, `_`, `.` ya da `-` olabilir.
- `items` işleviniz son tuşa basıştan 150 ms sonra çalışır. Yazar yazmayı sürdürür ya da menüyü kapatırsa `signal` iptal edilir; bu yüzden onu `fetch`'e verin.
- Menü en çok 8 kayıt gösterir ve bunları düz metin olarak yazar. Etiketleriniz hiçbir zaman HTML olarak okunmaz.
- `Enter` ya da `Tab` kaydı seçer, `Esc` menüyü kapatır.

Koddan bahsetme eklemek için `editor.commands.insertMention({ id: 'u_42', label: 'Editör' })` kullanabilirsiniz.

## Ne saklanır

Bir bahsetme tek bir span olarak kaydedilir:

```html
<span class="vive-mention" data-mention="u_42">@Editör</span>
```

Kimlik `^[A-Za-z0-9_][A-Za-z0-9_.:@-]{0,127}$` kalıbına uymalı ve içinde `..` bulunmamalıdır. Kalıp `MENTION_ID_PATTERN` adıyla dışa açılır; `isMentionId()` bir değeri bu kalıba göre sınar. Editör kimliği HTML okurken, JSON okurken ve HTML yazarken denetler. Kimliği denetimden geçmeyen bir span bahsetme olarak okunmaz.

Etiketten denetim, yön (bidi) ve sıfır genişlikli karakterler atılır, uzunluğu 100 karakterle sınırlanır. Bu sınırı `Mention` eklentisinin `maxLabelLength` seçeneği değiştirir. Kimlik hiçbir zaman bağlantı adresine dönüşmez.

## Sunucuda denetim

Tarayıcı bir güvenlik sınırı değildir; herkes istediği kimlik ve etiketle bir span gönderebilir. İçeriği kaydederken:

- HTML'i [sunucu temizleyicisinden](https://editor.vivepdf.com/dokumantasyon/sunucuda-temizleme/) geçirin. Temizleyici bahsetmeleri tam olarak yukarıdaki biçimde tutar; kimliği hatalı olanı, bir bağlantının ya da dipnotun içine konanı düz metne indirir;
- her kimliği kendi rehberinizde arayın, bulunmayanları atın;
- yazarın o kişiden ya da gruptan bahsetmeye yetkisi olup olmadığını denetleyin;
- gösterilecek adı saklanan etiketten değil, kendi verinizden üretin;
- kimlikleri anlamsız tutun; e-posta adresi ya da başka kişisel veri kullanmayın.

`items` arkasındaki arama adresi kimlik doğrulama, istek sınırı ve kiracı (tenant) ayrımı ister; yazar yalnızca görmeye yetkili olduğu kişileri bulabilmelidir.

## Bildirimler

viveEditor kendisi bildirim göndermez. Bahsedilen kişilere bildirim gönderiyorsanız:

- düzenleme öncesi ve sonrası kimlikleri karşılaştırın, yalnızca yeni bahsetmeler için bildirim gönderin;
- tekrarları birleştirin; beş kez bahsedilen kişiye tek bildirim gitsin;
- yazar başına gönderilen bildirim sayısını sınırlayın.

## İlgili sayfalar

- [Sunucuda temizleme](https://editor.vivepdf.com/dokumantasyon/sunucuda-temizleme/)
- [Güvenlik ve CSP](https://editor.vivepdf.com/dokumantasyon/guvenlik-ve-csp/)
- [Paketler](https://editor.vivepdf.com/dokumantasyon/paketler/)

## Kişi listesi nereden geliyor?

Sizin yazdığınız items işlevinden. viveEditor'ün kendi kullanıcı rehberi yoktur; işlevinizi yazılan metin ve bir AbortSignal ile çağırır, döndürdüğünüz listeyi gösterir.

## Bahsetmede saklanan ada güvenebilir miyim?

Hayır. Etiket, yazarın tarayıcısının gönderdiği metindir. Kimliği kendi rehberinizde arayın ve gösterilecek adı kendi verinizden üretin.
