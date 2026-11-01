# Sürüm politikası

> viveEditor paketlerini 1.0 öncesinde nasıl sürümler, neler uyumlu kalır ve CDN betiği neden tam sürüm numarası ister.

URL: https://editor.vivepdf.com/dokumantasyon/surum-politikasi/
Son güncelleme: 2026-11-01

viveEditor, alışılmış 0.x kuralıyla anlamsal sürümlemeyi izler ve tüm npm paketleri tek bir sürüm numarasını paylaşır. Bu sayfa sürümler arasında nelerin değişebileceğini, nelerin hiç bozulmayacağını ve bir sürümü nasıl güvenle sabitleyeceğinizi anlatıyor.

## 0.x kuralı

viveEditor şu anda ilk kararlı sürümünden önceki 0.x aşamasında.

- Uyumu bozan bir değişiklik, 0.1'den 0.2'ye geçiş gibi bir ara sürümde gelebilir ve o sürümün notlarında anlatılır.
- 0.1.0'dan 0.1.1'e geçiş gibi yama sürümleri hiçbir şeyi bozmaz.

Yeni bir ara sürüme geçmeden önce sürüm notlarını okuyun. Her sürüm etiketlenir ve bir [GitHub sürümü](https://github.com/mtvrkan/viveeditor/releases) olarak yayımlanır.

## Her paket için tek sürüm

`viveeditor` ve tüm `@viveeditor/*` paketleri, yani bütün npm paketleri aynı sürüm numarasıyla birlikte yayımlanır. Editör, eklentileri ve çerçeve bileşeniniz her zaman uyuşsun diye hepsini aynı sürümde kurun.

PHP paketleri `viveeditor/sanitizer` ve `viveeditor/laravel` ise Composer üzerinden ayrı sürümlenir.

## Kayıtlı içerik okunabilir kalır

Herhangi bir 0.x sürümüyle kaydedilen HTML ve JSON, sonraki her 0.x sürümünde okunabilir kalır. Güncelleme yaptığınızda kayıtlı içerik için hiçbir zaman taşıma gerekmez.

Asıl saklama biçimi ProseMirror JSON'udur (`editor.getJSON()`); HTML (`editor.getHTML()`) bir gösterim biçimidir. İkisinden birini saklayabilirsiniz.

## Genel API kayıt altında

Her paketin genel API'si deponun [`api/` klasöründe](https://github.com/mtvrkan/viveeditor/tree/main/api) `.d.ts` dosyaları olarak kayıtlıdır. API bu dosyalar güncellenmeden değişirse derleme başarısız olur; böylece genel API'deki her değişiklik incelemede görünür. İki sürüm arasında neyin değiştiğini görmek için `api/` klasörünü iki sürümün etiketinde karşılaştırın.

## CDN sürümünü sabitleyin

CDN betiğini her zaman tam sürümle yükleyin:

```html
<script src="https://cdn.jsdelivr.net/npm/viveeditor@x.y.z/dist/viveeditor.classic.iife.js"></script>
```

`x.y.z` yerine kullandığınız sürümü tam olarak yazın. Betik ek dosyalarını aynı klasörden yükler ve onları o sürüme gömülü parmak izleriyle denetler; bir ek dosya yalnızca sürümü birebir tutuyorsa kabul edilir. `cdn.jsdelivr.net/npm/viveeditor` gibi kısa bir adres bu dosyaları bulamaz. `viveeditor.css` dosyasını da aynı sürüm klasöründen yükleyin.

## Güvenlik düzeltmeleri

1.0'a kadar yalnızca yayımlanmış en son ara sürüm güvenlik düzeltmesi alır. Tüm paketler aynı sürüm numarasını paylaştığı için düzeltme, her paketin yama sürümü olarak çıkar. Bu düzeltmeleri almanın yolu en son ara sürümde kalmaktır. Bkz. [Güvenlik ve CSP](https://editor.vivepdf.com/dokumantasyon/guvenlik-ve-csp/).
