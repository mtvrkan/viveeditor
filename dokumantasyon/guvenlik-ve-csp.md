# Güvenlik ve CSP

> viveEditor güvensiz işaretlemeyi nasıl dışarıda tutar, sunucuda neden yeniden temizlersiniz ve CDN betiği hangi CSP ayarlarını ister.

URL: https://editor.vivepdf.com/dokumantasyon/guvenlik-ve-csp/
Son güncelleme: 2026-11-01

viveEditor sizi iki katmanda korur: editör yalnızca bilinen bir HTML kümesi üretir, sunucunuz da gönderilen her belgeyi yeniden temizler. Bu sayfa iki katmanı, CDN betiğinin ve ek dosyalarının istediği İçerik Güvenliği Politikası (CSP) ayarlarını ve bir güvenlik açığını nasıl bildireceğinizi anlatıyor.

## Editörün denetledikleri

Belge şeması bir izin listesidir. Tanımadığı işaretleme çıktıya hiç ulaşmaz. Yazılan metin, yapıştırılan HTML, açılan dosyalar ve şablonlar aynı kurallardan geçer.

- Bağlantılar yalnızca izinli protokolleri kabul eder: `http`, `https`, `mailto` ve `tel`.
- Her adres içerik yüklenirken ve çıktıya yazılırken yeniden denetlenir; çünkü JSON içerik HTML ayrıştırıcısından geçmez.
- `style` özniteliği yalnızca editörün yazdığı değerleri taşır; denetlenmiş bir renk ya da hizalama gibi.
- Görseller `https` adresi ister. `data:` adresleri yalnızca `allowBase64` ile çalışır, SVG hiçbir zaman. `javascript:`, `vbscript:`, `file:`, `blob:` ve `filesystem:` her zaman reddedilir.
- Video oynatıcıları verilen adresi saklamaz. Editör sağlayıcıyı ve video kimliğini saklar, oynatıcı adresini sabit `sandbox`, `allow` ve `referrerpolicy` değerleriyle yeniden kurar.
- Yapay zekâ yanıtları ve bahsedilen kişilerin adları HTML olarak değil, düz metin olarak gösterilir ve eklenir. Bahsetme kimliği hiçbir zaman bağlantıya dönüşmez.

## Sunucuda yeniden temizleyin

Tarayıcı bir güvenlik sınırı değildir. Herkes sunucunuza istediği HTML'i gönderebilir; bu yüzden HTML'i saklamadan ya da göstermeden önce sunucuda temizleyin. Node için `@viveeditor/sanitize`, PHP için `viveeditor/sanitizer` editörün ürettiğini olduğu gibi bırakır, geri kalan her şeyi siler.

```ts
import { sanitizeHtml } from '@viveeditor/sanitize'

const clean = sanitizeHtml(request.body.html, { embeds: true })
```

Kaydederken temizleyin; kayıtlı HTML'i sayfaya basarken de bir temizleme yardımcısından geçirin. Böylece temizlemeyi eklemeden önce yazılmış kayıtlar da güvende kalır. Seçenekler, sınırlar ve hatalar [Sunucuda temizleme](https://editor.vivepdf.com/dokumantasyon/sunucuda-temizleme/) sayfasında.

## İçerik Güvenliği Politikası

### CDN betiği ve ek dosyaları

CDN betiği üç ek dosyayı ilk kullanımda kendi klasöründen yükler: `viveeditor.docx.iife.js`, `viveeditor.markdown.iife.js` ve `viveeditor.panels.iife.js`. Her biri ana betiğe gömülü bir `sha384` parmak iziyle denetlenir.

- `script-src`, betiklerin bulunduğu klasöre izin vermelidir; örneğin tam sürümünüzle `https://cdn.jsdelivr.net/npm/viveeditor@x.y.z/dist/`.
- `nonce` kullanıyorsanız onu ana betiğe koyun. Ek dosyalara da aynısı kopyalanır.
- Trusted Types zorunluysa `trusted-types` yönergesine `viveeditor` ilke adını ekleyin. Bu ilke yalnızca ek dosyaların adreslerine izin verir.
- Dosyaları kendiniz barındırıyorsanız adlarını değiştirmeyin ve parmak izi denetimi çalışabilsin diye `Access-Control-Allow-Origin` başlığıyla sunun.
- Klasör, ana betiğin kendi adresinden alınır; bu dosyanın adı `viveeditor.classic.iife.js` olmalı ve `http` ya da `https` üzerinden sunulmalıdır.

```html
<script
  nonce="r4nd0m"
  src="https://cdn.jsdelivr.net/npm/viveeditor@x.y.z/dist/viveeditor.classic.iife.js"
></script>
```

`x.y.z` yerine kullandığınız sürümü tam olarak, nonce yerine de sunucunuzun her yanıt için ürettiği değeri yazın. npm ve paketleyiciyle ek dosya yoktur; dönüştürücüler ve paneller kendi derlemenizden yüklenir. Laravel paketi editör dosyalarını kendi `public/vendor/viveeditor` klasörünüzden sunar; `Vite::useCspNonce()` kullandığınızda etiketler nonce değerini alır.

### Görseller: `img-src`

`img-src` yönergesini yüklemelerinizi sunan sunucularla ve kabul ettiğiniz görsel sunucularıyla sınırlayın. Varsayılan olarak başka sitelerden yapıştırılan görseller özgün adreslerinde kalır (`remoteImages: 'allow'`); bu görselleri göstermek, o siteye sayfayı kimin ne zaman okuduğunu söyler. Daha sıkı bir kurulum için `'drop'` ya da `'rehost'` kullanın; bkz. [Görseller ve yükleme](https://editor.vivepdf.com/dokumantasyon/gorseller-ve-yukleme/).

### Video gömme: `frame-src`

Yalnızca etkinleştirdiğiniz sağlayıcıları listeleyin:

- YouTube: `https://www.youtube-nocookie.com`
- Vimeo: `https://player.vimeo.com`
- Spotify: `https://open.spotify.com`

Sayfa genelindeki `Referrer-Policy: no-referrer` ayarı YouTube oynatıcılarını çalışmaz hâle getirir. Sunucuda hiçbir zaman her `iframe` öğesine izin vermeyin; oynatıcıları `div[data-embed]` üzerinden yeniden kurun ya da yalnızca `isAllowedEmbedSrc()` işlevinin onayladığı adresleri kabul edin. Ayrıntılar [Video](https://editor.vivepdf.com/dokumantasyon/video/) sayfasında.

### Biçimler: `style-src`

Yazı rengi, vurgu, hizalama ve tablo sütun genişlikleri hem editörde hem kaydedilen HTML'de `style` özniteliği olarak yazılır. `'unsafe-inline'` içermeyen bir `style-src` tarayıcının bu öznitelikleri yok saymasına yol açar; renkler ve genişlikler kaybolur. İçeriği gösteren ya da düzenleyen sayfalarda `style-src` için `'unsafe-inline'` izni verin, `script-src`'yi ise sıkı tutun.

### Yazdırma

Yazdırma, betik çalıştırmayan ve yalnızca görselleri ve stilleri yükleyen gizli bir çerçeve kullanır. Bu çerçeve `allow-scripts` olmadan korumalı alanda çalışır ve kendi CSP'sini taşır.

## Yüklemeler

Editör her görsel adresini ve dosyayı belgeye girmeden önce denetler; yine de yükleme adresiniz şunları yapmalıdır:

- her yüklemeyi yeniden doğrulamalı ve yeniden kodlamalı (bu, EXIF ve GPS verilerini ve çok biçimli dosyaları temizler), gerçek genişliği ve yüksekliği döndürmeli;
- yüklemeleri çerezsiz bir alan adından, sunucunun belirlediği `Content-Type` ve `X-Content-Type-Options: nosniff` ile sunmalı;
- kimlik doğrulama, CSRF belirteci ve istek sınırı istemeli;
- uzak görselleri kendisi indiriyorsa SSRF'ye karşı korunmalı.

## Güvenlik açığı bildirin

Açıkları deponun [Security sekmesindeki](https://github.com/mtvrkan/viveeditor/security) GitHub "Report a vulnerability" düğmesiyle gizli olarak bildirin. Herkese açık bir issue açmayın.

1. Etkilenen paketi ve sürümü yazın.
2. Sorunu gösteren en küçük örneği ekleyin.
3. Gözlemlediğiniz etkiyi anlatın.

Bildiriminizin alındığı size iletilir ve düzeltme, açık duyurulmadan önce sizinle birlikte planlanır. 1.0'a kadar yalnızca yayımlanmış en son ara sürüm güvenlik düzeltmesi alır. Tüm paketler aynı sürüm numarasını paylaştığı için düzeltme, her paketin yama sürümü olarak çıkar.

Özellikle editör çıktısına betik çalıştırma, olay işleyicileri, `javascript:` adresleri ya da temizlenmemiş işaretleme sokmanın her yolu önemlidir. Sunucu temizleyicileri de kapsamdadır. Politikanın tamamı [SECURITY.md](https://github.com/mtvrkan/viveeditor/blob/main/SECURITY.md) dosyasında.
