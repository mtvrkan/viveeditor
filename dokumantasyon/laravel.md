# Laravel

> viveEditor'ü Laravel'e Blade bileşeni, yerel editör dosyaları, @viveHtml yönergesi ve temiz HTML için ViveHtml cast ile ekleyin.

URL: https://editor.vivepdf.com/dokumantasyon/laravel/
Son güncelleme: 2026-11-01

`viveeditor/laravel`, viveEditor'ü PHP 8.4 ve üzerindeki Laravel 12 ve üzeri sürümlere getirir. Editör için bir Blade bileşeni ekler, editör dosyalarını kendi sitenizden sunar ve HTML'i kaydederken de gösterirken de [PHP temizleyicisiyle](https://editor.vivepdf.com/dokumantasyon/sunucuda-temizleme/) temizler.

## Kurulum

1. Paketi ekleyin: `composer require viveeditor/laravel`. Laravel hizmet sağlayıcısını ve `ViveEditor` facade'ını kendisi bulur.
2. Editör dosyalarını `public/vendor/viveeditor` klasörüne yayımlayın: `php artisan vendor:publish --tag=viveeditor-assets`.
3. İsterseniz ayar dosyasını da yayımlayın: `php artisan vendor:publish --tag=viveeditor-config`.

```sh
composer require viveeditor/laravel
php artisan vendor:publish --tag=viveeditor-assets
```

Editör dosyaları kopya olarak yayımlanır. Paketi güncelledikten sonra yeni sürümle eşleşmeleri için onları `--force` ile yeniden yayımlayın. Dosyalar `laravel-assets` etiketiyle de yayımlanır.

## Editörü gösterme

Sayfanın `<head>` bölümüne `@viveeditorScripts` koyun. Bu yönerge stil dosyasını ve editör betiğini kendi `public/vendor/viveeditor` klasörünüzden basar. Ardından bileşeni formunuzun içinde kullanın:

```blade
<head>
  @viveeditorScripts
</head>

<form method="post">
  @csrf
  <label for="body">Makale</label>
  <x-viveeditor::editor name="body" id="body" :value="old('body', $post->body)" required />
  <button type="submit">Kaydet</button>
</form>
```

Bileşen, editörün devraldığı bir `<textarea>` üretir. Form, HTML'i alanın `name` değeriyle gönderir.

| Öznitelik | Anlamı |
| --- | --- |
| `name` | Zorunlu. Form alanının adı. |
| `value` | Başlangıç HTML'i. Sizin için kaçışlanır. |
| `label` | İsteğe bağlı. Görünür bir `<label>` yoksa alanın `aria-label` değeri olur. |

`id`, `required` ya da Dosya menüsünü gizleyen `data-files="false"` gibi diğer öznitelikler textarea'ya aktarılır.

Bileşen tek betikli sürümü kullanır; bu yüzden yalnızca npm ile gelen ekler (bahsetme, emoji, formül, dipnot, şablonlar ve yapay zekâ yardımı) onda yoktur.

## Saklanan HTML'i gösterme

Saklanan HTML'i `@viveHtml(...)` ile basın. Basarken temizler; böylece temizlemeyi eklemeden önce yazılmış ya da formlarınızın dışında yazılmış kayıtlar da güvende kalır.

```blade
<article>@viveHtml($post->body)</article>
```

> **Kaçışsız çıktı kullanmayın**
>
> Editör HTML'ini hiçbir zaman `{!! !!}` ile basmayın; bu yol temizlemeyi atlar.

## Kaydederken temizleme

`ViveHtml` cast'ı kaydederken temizler, okurken yeniden temizler. Böylece cast'tan önce ya da ham sorgularla yazılmış kayıtlar da temiz gelir.

```php
use Illuminate\Database\Eloquent\Model;
use Viveeditor\Laravel\Casts\ViveHtml;

class Post extends Model
{
    protected function casts(): array
    {
        return ['body' => ViveHtml::class];
    }
}
```

Cast'ın okurken temizleyemediği bir kayıt (çok büyük ya da çok karmaşık) boş metin olarak okunur ve hata, istisna işleyicinize gider. Kaydederken ise hata fırlatılır.

Başka bir yerde temizlemek için facade'ı kullanın. İkinci bağımsız değişken, o çağrı için ayar dosyasındaki seçenekleri ezer:

```php
use Viveeditor\Laravel\Facades\ViveEditor;

$clean = ViveEditor::sanitize($request->input('body'));
$withEmbeds = ViveEditor::sanitize($html, ['embeds' => true]);
```

`ViveEditor::sanitize()` ve `@viveHtml`, çok büyük ya da çok karmaşık HTML için `Viveeditor\Sanitizer\SanitizeException` fırlatır. Sınırlar için [Sunucuda temizleme](https://editor.vivepdf.com/dokumantasyon/sunucuda-temizleme/) sayfasına bakın.

## Ayarlar

`config/viveeditor.php`, dosya klasörünü ve `@viveHtml`, cast ve facade'ın kullandığı temizleyici seçeneklerini tutar:

```php
return [

    'asset_path' => env('VIVEEDITOR_ASSET_PATH', 'vendor/viveeditor'),

    'sanitize' => [
        'embeds' => false,
        'allowBase64' => false,
        'allowRelativeImages' => false,
    ],

];
```

Editörde video yerleştirmeyi açtıysanız burada `embeds` değerini `true` yapın; yoksa HTML temizlenirken yerleştirmeler kaldırılır.

## İçerik Güvenliği Politikası (CSP)

`Vite::useCspNonce()` kullandığınızda `@viveeditorScripts`'in bastığı etiketler nonce alır. Editör bu nonce'ı ilk kullanımda yüklediği ek betiklere (Word ve Markdown çeviricileri ile paneller) de aktarır; bu betikler aynı klasördedir. `script-src` yönergeniz bu klasöre izin vermelidir. Nonce'ı ayarlamak için [Laravel'in Vite belgelerine](https://laravel.com/docs/vite), politikanın geri kalanı için [Güvenlik ve CSP](https://editor.vivepdf.com/dokumantasyon/guvenlik-ve-csp/) sayfasına bakın.

## Dil

Editör dilini `<html lang="...">` değerinden alır. Bunu düzen dosyanızda uygulamanın diline göre ayarlayın:

```blade
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
```

## İlgili sayfalar

- [Sunucuda temizleme](https://editor.vivepdf.com/dokumantasyon/sunucuda-temizleme/)
- [Güvenlik ve CSP](https://editor.vivepdf.com/dokumantasyon/guvenlik-ve-csp/)
- [Kurulum](https://editor.vivepdf.com/dokumantasyon/kurulum/)

## Laravel paketi bir CDN'den bir şey yüklüyor mu?

Hayır. Editör dosyaları kendi public/vendor/viveeditor klasörünüze yayımlanır ve oradan sunulur.

## Saklanan HTML'i kaçışsız Blade çıktısıyla basabilir miyim?

Hayır. Saklanan HTML'i, basarken temizleyen @viveHtml ile gösterin; böylece eski kayıtlar ve formlarınızın dışında yazılmış kayıtlar da güvende kalır.
