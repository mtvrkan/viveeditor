# Kurulum

> viveEditor'ü tek bir CDN betiğiyle ya da npm'den kurun, ihtiyacınız olan paketleri seçin ve doğru stil dosyalarını yükleyin.

URL: https://editor.vivepdf.com/dokumantasyon/kurulum/
Son güncelleme: 2026-11-01

viveEditor'ü bir sayfaya CDN'den tek bir betikle ekleyebilir ya da npm'den kurup kendi paketleyicinizle derleyebilirsiniz. Bu sayfa iki yolu, hangi paketleri seçmeniz gerektiğini ve hangi stil dosyalarını yüklemeniz gerektiğini anlatıyor.

## CDN betiğiyle

Derleme adımı gerekmez. Stil dosyasını ve betiği yükleyin, sonra bir textarea'ya `data-editor` ekleyin:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/viveeditor@x.y.z/dist/viveeditor.css" />
<script src="https://cdn.jsdelivr.net/npm/viveeditor@x.y.z/dist/viveeditor.classic.iife.js"></script>

<form method="post">
  <label for="body">Makale</label>
  <textarea id="body" name="body" data-editor required></textarea>
</form>
```

`x.y.z` yerine kullandığınız sürümü tam olarak yazın. Sayfa hazır olduğunda betik her `textarea[data-editor]` öğesini araç çubuklu bir editöre çevirir ve `window.ViveEditor` nesnesini sunar. Form, textarea'nın adıyla temiz HTML gönderir. Bu HTML'i sunucuda her zaman yeniden temizleyin.

Betikte temel biçimlendirme, listeler, hizalama ve renkler, yapılacaklar listeleri, kod blokları (sözdizimi renklendirmesi olmadan), tablolar, bul ve değiştir, görseller (adresle, yükleyici olmadan), video gömme ve Office'ten temiz yapıştırma vardır. Bahsetme, emoji, formül, dipnot, şablonlar ve yapay zekâ asistanı yalnızca npm'de bulunur; `<vive-editor>` öğesi de öyle.

> **Sürümü tam yazın, dosya adlarını değiştirmeyin**
>
> Word ve Markdown dönüştürücüleri ile paneller ana betiğin yanındaki ek dosyalardadır: `viveeditor.docx.iife.js`, `viveeditor.markdown.iife.js` ve `viveeditor.panels.iife.js`. İlk kullanımda aynı klasörden yüklenir ve o sürümün içine gömülü `sha384` parmak izleriyle denetlenirler. `cdn.jsdelivr.net/npm/viveeditor` gibi kısa adresler ya da adı değiştirilmiş veya birleştirilmiş betikler bu dosyaları bulamaz.

Sitenizde İçerik Güvenliği Politikası (CSP) varsa yayına almadan önce [Güvenlik ve CSP](https://editor.vivepdf.com/dokumantasyon/guvenlik-ve-csp/) sayfasını okuyun.

## npm ile

### Her şey tek pakette

`viveeditor` paketi CDN betiğindeki editörün aynısını içerir:

```sh
npm install viveeditor
```

```ts
import { upgradeAll } from 'viveeditor'
import 'viveeditor/style.css'

upgradeAll()
```

Paketleyiciyle çalışırken CDN ek dosyaları yoktur. Dosya menüsünde Word ve Markdown'ı görmek için dönüştürücüleri yükleyici fonksiyon olarak verin; ayrıntılar [Dosya aç, kaydet, yazdır](https://editor.vivepdf.com/dokumantasyon/dosya-ac-kaydet-yazdir/) sayfasında.

### Çerçeve bileşeni

React, Vue, Svelte ve Angular için ayrı bileşen paketleri var; bunları `viveeditor` ile birlikte kurarsınız:

```sh
npm install @viveeditor/react viveeditor
```

`@viveeditor/vue`, `@viveeditor/svelte` ve `@viveeditor/angular` da aynı şekilde kurulur. Herhangi bir sayfa için `<vive-editor>` form alanını sunan `@viveeditor/element` paketi de var. Ayrıntılar [Çerçeveler](https://editor.vivepdf.com/dokumantasyon/cerceveler/) sayfasında.

### Yalnızca gereken parçalar

Her özellik ayrı bir pakettir. `@viveeditor/core` motorun kendisidir ve araç çubuğu içermez; araç çubuğu için `@viveeditor/ui` ekleyin:

```sh
npm install @viveeditor/core @viveeditor/ext-basic @viveeditor/ext-list @viveeditor/ui
```

Tam liste [Paketler](https://editor.vivepdf.com/dokumantasyon/paketler/) sayfasında.

## Stil dosyaları

- CDN: betikle aynı sürüm klasöründeki `viveeditor.css`.
- `viveeditor` ve çerçeve bileşenleri: bir kez `import 'viveeditor/style.css'`.
- Angular: `node_modules/viveeditor/dist/viveeditor.css` dosyasını `angular.json` içindeki `styles` listesine ekleyin.
- Paketleri kendiniz seçtiyseniz: `@viveeditor/core/style.css`, araç çubuğunu kullanıyorsanız `@viveeditor/ui/style.css` ve stil dosyası olan her eklentinin `style.css` dosyası: `ext-code-block`, `ext-embed`, `ext-footnote`, `ext-image`, `ext-math`, `ext-mention`, `ext-search`, `ext-table` ve `ext-task-list`.

```ts
import '@viveeditor/core/style.css'
import '@viveeditor/ui/style.css'
import '@viveeditor/ext-table/style.css'
```

Formüller için KaTeX'in kendi stil dosyası `katex/dist/katex.min.css` de gerekir.

## Gereksinimler

- Derleme araçlarınız için Node.js 20.19 veya üstü. npm paketleri bunu `engines` alanında belirtir.
- Bileşen paketleri için React 18 ya da 19, Vue 3.5, Svelte 5 veya Angular 21 ya da 22.
- Formül kullanıyorsanız KaTeX 0.18.2 veya üstü. Daha eski sürümler reddedilir.
- `viveeditor/sanitizer` için PHP 8.4 veya üstü, `viveeditor/laravel` için Laravel 12 veya üstü.

## Sürümü sabitleyin

Tüm npm paketleri aynı sürüm numarasıyla birlikte yayımlanır; bu yüzden viveEditor paketlerinin hepsini aynı sürümde kurun. CDN betiğinde sürümü her zaman tam yazın (`viveeditor@x.y.z`); ek dosyalar o sürüme gömülü parmak izleriyle denetlenir. 1.0'dan önce bir ara sürüm uyumu bozan değişiklik içerebilir; bkz. [Sürüm politikası](https://editor.vivepdf.com/dokumantasyon/surum-politikasi/).

## Sonraki adımlar

- [İlk editör](https://editor.vivepdf.com/dokumantasyon/ilk-editor/): textarea, `mountEditor` ya da `Editor.create`.
- [Sunucuda temizleme](https://editor.vivepdf.com/dokumantasyon/sunucuda-temizleme/): gönderilen HTML'i kaydetmeden önce temizleyin.
