# Sık sorulan sorular

> viveEditor'ün lisansı, kurulumu, çerçeveleri, güvenliği, Word desteği, dilleri, ekstraları ve sürümleri hakkında kısa yanıtlar.

URL: https://editor.vivepdf.com/dokumantasyon/sss/
Son güncelleme: 2026-11-01

Bunlar, viveEditor'ü bir siteye eklemeden önce en sık sorulan sorular. Yanıtlar kısa; ayrıntılar bağlantı verilen sayfalarda.

## Daha fazlası için

- Kurulum: [Kurulum](https://editor.vivepdf.com/dokumantasyon/kurulum/) ve [İlk editör](https://editor.vivepdf.com/dokumantasyon/ilk-editor/).
- Çerçeveler ve sunucu tarafı işleme: [Çerçeveler](https://editor.vivepdf.com/dokumantasyon/cerceveler/).
- Güvenli saklama: [Sunucuda temizleme](https://editor.vivepdf.com/dokumantasyon/sunucuda-temizleme/) ve [Güvenlik ve CSP](https://editor.vivepdf.com/dokumantasyon/guvenlik-ve-csp/).
- Görseller: [Görseller ve yükleme](https://editor.vivepdf.com/dokumantasyon/gorseller-ve-yukleme/).
- Word: [Word'den yapıştırma](https://editor.vivepdf.com/dokumantasyon/word-den-yapistirma/) ve [Dosya aç, kaydet, yazdır](https://editor.vivepdf.com/dokumantasyon/dosya-ac-kaydet-yazdir/).
- Ekstralar: [Bahsetme](https://editor.vivepdf.com/dokumantasyon/bahsetme/), [Formül](https://editor.vivepdf.com/dokumantasyon/formul/) ve [Yapay zekâ](https://editor.vivepdf.com/dokumantasyon/yapay-zeka/).
- Klavye ve ekran okuyucular: [Erişilebilirlik](https://editor.vivepdf.com/dokumantasyon/erisilebilirlik/).
- Güncellemeler: [Sürüm politikası](https://editor.vivepdf.com/dokumantasyon/surum-politikasi/).
- Bir şey çalışmıyorsa: [Sorun giderme](https://editor.vivepdf.com/dokumantasyon/sorun-giderme/).

Sorunuz burada yoksa [GitHub'daki issue'lara](https://github.com/mtvrkan/viveeditor/issues) bakın ya da yeni bir tane açın. Güvenlik sorunlarını [Güvenlik ve CSP](https://editor.vivepdf.com/dokumantasyon/guvenlik-ve-csp/) sayfasında anlatıldığı gibi gizli olarak bildirin.

## viveEditor ücretsiz mi?

Evet. viveEditor MIT lisanslı açık kaynak bir projedir. Görsel yükleme, tablolar, video gömme ve Word içe ve dışa aktarma dahil her şey ücretsizdir; ücretli bir sürüm yoktur.

## Derleme adımı gerekiyor mu?

Hayır. Bir stil dosyası, bir betik ve data-editor özniteliği taşıyan bir textarea yeterli. Paketleyici kullanıyorsanız bunun yerine npm'den viveeditor paketini kurun.

## Hangi çerçeveler destekleniyor?

React 18 ve 19, Vue 3.5, Svelte 5 ve Angular 21 ve 22 için bileşenler var. Diğer sayfalarda vive-editor özel öğesi form alanı olarak çalışır.

## Editörün gönderdiği HTML'i olduğu gibi saklayabilir miyim?

Hayır. Editör yalnızca bilinen bir HTML kümesi üretir, ama herkes sunucunuza istediği HTML'i gönderebilir. Saklamadan ya da göstermeden önce HTML'i sunucuda Node için @viveeditor/sanitize, PHP için viveeditor/sanitizer ile temizleyin.

## Yazarlar görsel yükleyebilir mi?

Evet, Image eklentisine kendi yükleme fonksiyonunuzu verdiğinizde. Editör her dosyayı ve adresi denetler, ama sunucunuz da her yüklemeyi yeniden doğrulamalı ve yeniden kodlamalıdır.

## Word ile çalışıyor mu?

Evet. Word, Google Dokümanlar ve LibreOffice'ten yapıştırma gerçek iç içe listeleri korur; Dosya menüsü .docx dosyalarını açar ve kaydeder. Eski .doc, .odt ve .rtf biçimleri desteklenmez.

## Arayüz hangi dilleri konuşuyor?

Türkçe ve İngilizce. Birini locale seçeneğiyle seçin; seçenek verilmezse editör sayfanın lang özniteliğine, sonra tarayıcı diline bakar.

## Bahsetme, emoji, formül ve yapay zekâ asistanı CDN betiğinde var mı?

Hayır. Bahsetme, emoji, formül, dipnot, şablonlar ve yapay zekâ asistanı yalnızca npm paketi olarak gelir ve @viveeditor/ui/extras üzerinden araç çubuğuna eklenir.

## viveEditor metnimi bir yapay zekâ hizmetine gönderiyor mu?

Hayır. viveEditor kendiliğinden hiçbir yere bir şey göndermez. Yapay zekâ asistanı yalnızca sizin yazdığınız sağlayıcı fonksiyonunu çağırır; bu fonksiyon da kendi sunucunuzu çağırmalıdır.

## Erişilebilir mi?

viveEditor tam klavye kontrolü ve ekran okuyucu bildirimleriyle WCAG 2.2 AA düzeyini hedefler. Yine de her editöre sizin bir etiket vermeniz gerekir.

## Bir güncelleme kayıtlı içeriğimi bozar mı?

Hayır. Herhangi bir 0.x sürümüyle kaydedilen HTML ve JSON, sonraki her 0.x sürümünde okunabilir kalır. API'nin kendisi ise 1.0'dan önce bir ara sürümde değişebilir.

## Laravel paketi var mı?

Evet. viveeditor/laravel, Laravel 12 ve üstüyle, PHP 8.4 ve üstüyle çalışır. Bir Blade bileşeni ekler, editör dosyalarını kendi sitenizden sunar ve PHP temizleyicisini içerir.
