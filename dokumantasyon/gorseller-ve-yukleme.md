# Görseller ve yükleme

> Görsel eklentisini kurun, yükleme fonksiyonunu yazın, ilerleme ve iptali yönetin, sunucuyu güvene alın ve alternatif metni takip edin.

URL: https://editor.vivepdf.com/dokumantasyon/gorseller-ve-yukleme/
Son güncelleme: 2026-11-01

`@viveeditor/ext-image` görsel eklemeyi, dosya yüklemeyi ve görsel boyutlarını yönetir. Her görsel adresi ve her dosya belgeye girmeden önce denetlenir; dosyaları sunucunuza sizin yazdığınız bir yükleme fonksiyonu gönderir. Bu sayfa eklentiyi kurmayı, yükleme fonksiyonunun sözleşmesini, sunucu tarafında yapmanız gerekenleri ve alternatif metin uyarılarını anlatır.

## Kurulum

```ts
import { Editor } from '@viveeditor/core'
import { Image } from '@viveeditor/ext-image'
import '@viveeditor/ext-image/style.css'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [
    Image.configure({
      upload,
      labels: { uploading: 'Yükleniyor', failed: 'Görsel eklenemedi', missingAlt: 'Alt metin yok' },
      onError: ({ code, fileName }) => console.warn(code, fileName),
    }),
  ],
})
```

Tek betikli kurulumda görsel eklentisi yükleyicisiz gelir: görseller yalnızca adresle eklenir. Dosya yüklemek için eklentiyi npm üzerinden kendi `upload` fonksiyonunuzla kurun.

## Seçenekler

| Seçenek | Varsayılan | Açıklama |
| --- | --- | --- |
| `upload` | `null` | Dosyaları sunucunuza gönderen fonksiyon. |
| `rehost` | `null` | Başka sitedeki bir görseli kendi sunucunuza taşıyan fonksiyon. |
| `remoteImages` | `'allow'` | Başka sitelerden yapıştırılan görseller: `'allow'`, `'drop'` ya da `'rehost'`. |
| `allowBase64` | `false` | Görselin data adresiyle belgeye gömülmesine izin verir. |
| `maxBase64Length` | `1500000` | Bir data adresinin en fazla karakter sayısı. |
| `insecure` | `'upgrade'` | `http:` adresleri `https:` yapar; `'block'` reddeder. |
| `allowRelative` | `false` | Göreli görsel adreslerine izin verir. |
| `mimeTypes` | png, jpeg, gif, webp, avif | Kabul edilen dosya türleri. |
| `maxSize` | 10 MB | Bir dosyanın en büyük boyutu. |
| `maxFiles` | `10` | Tek seferde eklenebilecek dosya sayısı. |
| `concurrency` | `3` | Aynı anda kaç dosyanın yükleneceği. |
| `timeout` | 60 sn | Bir yüklemenin en uzun süresi. |
| `maxPreviewPixels` | 25 milyon | Bu piksel sayısının üstündeki dosyalar için önizleme gösterilmez. |
| `requireAlt` | `'warn'` | Alternatif metni eksik görsellerde uyarı rozeti; `'off'` kapatır. |
| `labels` | İngilizce | Yükleme, hata ve eksik alternatif metin etiketleri. |
| `onError` | `null` | Başarısız bir dosya için `{ code, fileName }` alır. |

## Yükleme fonksiyonu

Yükleme fonksiyonu bir dosya ve bir bağlam alır, görselin adresini döndürür:

```ts
import type { ImageUploader } from '@viveeditor/ext-image'

const upload: ImageUploader = async (file, { signal, onProgress }) => {
  const body = new FormData()
  body.append('file', file)
  const response = await fetch('/uploads', { method: 'POST', body, signal })
  if (!response.ok) throw new Error('Upload failed')
  const { url, width, height } = await response.json()
  return { src: url, width, height }
}
```

- Dönüş değeri bir adres dizesi ya da `{ src, width, height }` nesnesidir. `width` ve `height` isteğe bağlıdır, ama gerçek boyutları sunucunun ölçüp döndürmesi en iyisidir.
- Döndürülen adres de aynı denetimden geçer: `blob:` hiçbir zaman, `data:` yalnızca `allowBase64` açıkken kabul edilir. Geçmezse görsel eklenmez.
- Fonksiyon bir hata fırlatırsa görselin yerinde "Görsel eklenemedi" yazan bir kutu kalır ve `onError` çağrılır.
- Dosya fonksiyona gelmeden önce türü, boyutu ve ilk baytları denetlenir. Bu denetim kullanıcıya erken haber vermek içindir; güvenlik sınırı sunucunuzdur.

Yükleme sürerken görselin yerinde bir yer tutucu ve ilerleme çubuğu görünür. Yer tutucu belgeye yazılmaz; `getHTML()` onu hiçbir zaman içermez.

### İlerleme

`onProgress` 0 ile 1 arasında bir değer bekler; aralık dışı değerler sınıra çekilir. `fetch` yükleme ilerlemesini bildirmez. İlerleme çubuğu istiyorsanız `XMLHttpRequest` kullanabilirsiniz:

```ts
import type { ImageUploader } from '@viveeditor/ext-image'

const upload: ImageUploader = (file, { signal, onProgress }) =>
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', '/uploads')
    request.responseType = 'json'
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    request.onload = () => {
      if (request.status !== 200) return reject(new Error('Upload failed'))
      const { url, width, height } = request.response
      resolve({ src: url, width, height })
    }
    request.onerror = () => reject(new Error('Upload failed'))
    request.onabort = () => reject(signal.reason)
    signal.addEventListener('abort', () => request.abort())
    const body = new FormData()
    body.append('file', file)
    request.send(body)
  })
```

### İptal

Her yüklemenin kendi `AbortSignal` değeri vardır. Sinyal şu durumlarda iptal edilir:

- yazar yer tutucuyu siler ya da geri alır,
- içerik `setContent` ile değiştirilir,
- editör kapatılır,
- `timeout` süresi dolar.

Sinyali `fetch` ya da `XMLHttpRequest` isteğine bağlayın ki sunucuya giden istek de dursun. İptal edilen bir yüklemenin sonucu belgeye eklenmez.

### Hata kodları

`onError` yalnızca bir kod ve dosya adı alır; sunucu yanıtı ya da dosya içeriği hiçbir zaman iletilmez.

| Kod | Anlamı |
| --- | --- |
| `TYPE` | Dosya türü izin verilenler arasında değil ya da içeriği türüyle uyuşmuyor. |
| `SIZE` | Dosya `maxSize` değerinden büyük. |
| `COUNT` | Tek seferde `maxFiles` değerinden fazla dosya eklendi. |
| `TIMEOUT` | Yükleme `timeout` süresinde bitmedi. |
| `UPLOAD` | Yükleme fonksiyonu hata verdi. |
| `SOURCE` | Fonksiyonun döndürdüğü adres denetimden geçmedi. |

### Bekleyen yüklemeler

`editor.query.isUploading()` yükleme sürüyorsa `true` döner. `editor.query.pendingUploads()` süren ve başarısız olan yüklemeleri `{ uploading, failed }` olarak sayar. Formu kendiniz gönderiyorsanız bu sorgularla bekleyin; tek betikli kurulum bunu sizin yerinize yapar.

## Sunucu kontrol listesi

Editör her adresi ve dosyayı denetler, ama tarayıcı bir güvenlik sınırı değildir. Sunucunuz da şunları yapmalı:

- Gönderilen HTML'i yeniden temizleyin ve yalnızca beklediğiniz `https` görsel adreslerine izin verin. Bkz. [Sunucuda temizleme](https://editor.vivepdf.com/dokumantasyon/sunucuda-temizleme/).
- Her yüklemeyi yeniden doğrulayın ve yeniden kodlayın. Bu, EXIF ve GPS verisini ve çok biçimli (polyglot) dosyaları temizler. Gerçek genişlik ve yüksekliği döndürün.
- Yüklenen dosyaları çerez taşımayan ayrı bir alan adından, sunucunun belirlediği `Content-Type` ve `X-Content-Type-Options: nosniff` ile sunun.
- Yükleme adresinde oturum, CSRF belirteci ve istek sınırı zorunlu olsun.
- İçerik Güvenliği Politikanızda `img-src` yönergesini daraltın. Bkz. [Güvenlik ve CSP](https://editor.vivepdf.com/dokumantasyon/guvenlik-ve-csp/).
- Sunucunuz uzak görselleri indiriyorsa (`remoteImages: 'rehost'`) SSRF saldırılarına karşı önlem alın.

## Başka sitelerden yapıştırılan görseller

Başka bir sayfadan kopyalanan içerik, o sitedeki görsellerin adreslerini de getirir. Okuyucunun tarayıcısı bu görselleri gösterirken o siteye kimin, ne zaman okuduğunu bildirir. `remoteImages` bu görsellere ne olacağını belirler:

| Değer | Sonuç |
| --- | --- |
| `'allow'` | Varsayılan. Görsel özgün adresinde kalır. |
| `'drop'` | Yapıştırılan `https` görselleri atılır. |
| `'rehost'` | Görsel, `rehost` fonksiyonunuzla kendi sunucunuza taşınır. Fonksiyon verilmemişse görsel atılır. |

`rehost` fonksiyonu dosya yerine adres alır, aynı bağlamı (`signal`, `onProgress`) kullanır ve yükleme fonksiyonu gibi bir adres döndürür. Sıkılaştırılmış bir kurulum için `'drop'` ya da `'rehost'` seçin.

## Alternatif metin

Görsel panelinde alternatif metin alanı ve "Süs amaçlı, açıklama gerekmez" kutusu vardır. Alternatif metni hiç girilmemiş görsellerde editör içinde "Alt metin yok" rozeti görünür; bu rozet kaydedilen HTML'e girmez. `requireAlt: 'off'` rozeti kapatır.

Kaydedilen değerde iki durum birbirinden ayrılır: boş bırakılmış alternatif metin eksik sayılır, süs amaçlı işaretlenen görsel ise boş `alt=""` ile kaydedilir. Yayınlamadan önce `editor.query.imagesWithoutAlt()` ile eksik olanları sayıp yazarı uyarabilirsiniz.

## Genişlik ve yükseklik

Kaydedilen her görsel `width` ve `height` taşır, böylece sayfa yüklenirken yerleşim kaymaz. Değerler şu sırayla belirlenir:

- yükleme fonksiyonunun döndürdüğü boyut her zaman önceliklidir,
- döndürülmezse PNG, GIF ve WebP dosyalarının boyutu dosyadan okunur.

Editörde görselin köşesindeki tutamakla genişliği sürükleyerek değiştirebilirsiniz; yükseklik orana göre ayarlanır. Görsel panelindeki %25, %50, %75 ve %100 düğmeleri görseli içerik genişliğine göre ölçekler.

Kaydedilen görsel `loading="lazy"`, `decoding="async"` ve `referrerpolicy="no-referrer"` ile yazılır. İçeriği gösteren sayfalara şu kuralı ekleyin:

```css
img {
  max-width: 100%;
  height: auto;
}
```

## Görsel paneli

Araç çubuğundaki görsel düğmesi ya da `/` menüsündeki "Görsel" girişi paneli açar. Yükleme fonksiyonu varsa "Bilgisayardan seç" düğmesi görünür; görseli editöre sürükleyip bırakabilir ya da yapıştırabilirsiniz. Adres alanına `https` ile başlayan bir görsel adresi girin; kullanılamayan bir adreste panel uyarı gösterir. Seçili bir görselde panel alternatif metni ve boyutu değiştirmenizi sağlar.

## Yükleme fonksiyonu vermezsem ne olur?

Görseller yalnızca https adresiyle eklenebilir. Görsel panelindeki "Bilgisayardan seç" düğmesi görünmez; sürüklenen ya da yapıştırılan dosyalar yüklenmez.

## Görseller belgeye base64 olarak gömülebilir mi?

Varsayılan olarak hayır. allowBase64 true verirseniz png, jpeg, gif, webp ve avif türündeki data adresleri kabul edilir; uzunluk maxBase64Length ile sınırlanır. SVG hiçbir zaman kabul edilmez.

## Yükleme sürerken form gönderilirse ne olur?

Tek betikli kurulumda form, yüklemeler bitene kadar bekletilir ve sonra kendiliğinden gönderilir. Bekleme sırasında bir yükleme başarısız olursa gönderim iptal edilir ve bir hata mesajı görünür.
