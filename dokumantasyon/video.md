# Video ve ses ekleme

> YouTube, Vimeo ve Spotify bağlantılarını güvenli oynatıcılara çevirin; ön yüz kartı, activateEmbeds, sunucu kontrolü ve CSP ayarları.

URL: https://editor.vivepdf.com/dokumantasyon/video/
Son güncelleme: 2026-11-01

`@viveeditor/ext-embed` YouTube, Vimeo ve Spotify bağlantılarını oynatıcıya çevirir. Kaydedilen HTML size verilen adresi saklamaz; yalnızca sağlayıcıyı ve video kimliğini tutar, oynatıcı adresi her seferinde bu ikisinden yeniden kurulur. Bu sayfa eklentiyi kurmayı, yayın sayfasında oynatıcıları açmayı ve sunucu ile İçerik Güvenliği Politikası ayarlarını anlatır.

## Kurulum

```ts
import { Editor } from '@viveeditor/core'
import { Embed } from '@viveeditor/ext-embed'
import '@viveeditor/ext-embed/style.css'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [
    Embed.configure({
      providers: ['youtube', 'vimeo'],
      facade: true,
      labels: { play: 'Oynat', invalid: 'Bu içerik desteklenmiyor' },
    }),
  ],
})
```

Tek betikli kurulumda eklenti üç sağlayıcıyla birlikte zaten yüklüdür.

| Seçenek | Varsayılan | Açıklama |
| --- | --- | --- |
| `providers` | `['youtube', 'vimeo', 'spotify']` | Açık olan sağlayıcılar. |
| `facade` | `false` | `true` olursa kaydedilen HTML oynatıcı yerine bağlantı tutar. |
| `pasteToEmbed` | `true` | Boş satıra yapıştırılan bağlantıyı oynatıcıya çevirir. |
| `maxEmbeds` | `50` | Bir belgedeki en fazla oynatıcı sayısı. |
| `labels` | İngilizce | Oynat düğmesinin ve desteklenmeyen içeriğin etiketleri. |

## Video eklemek

- Boş bir satıra yalnızca bağlantıyı yapıştırın. Bağlantı oynatıcıya dönüşür; bir kez geri almak onu yeniden bağlantı yapar.
- Araç çubuğundaki video düğmesine ya da `/` menüsündeki "Video" girişine basın. Panelde bağlantıyı ve bir başlık girin; ekran okuyucular bu başlığı okur.
- Kodla eklemek için `editor.commands.insertEmbed(url)`, başlığı değiştirmek için `editor.commands.setEmbedTitle(title)` kullanın.

Editör içinde oynatıcının yerinde sağlayıcı adını, başlığı ve bir oynat düğmesini gösteren bir kart durur. Oynat'a basılana kadar sağlayıcıdan hiçbir şey yüklenmez.

## Desteklenen bağlantılar

| Sağlayıcı | Kabul edilen bağlantılar | Oynatıcı adresi |
| --- | --- | --- |
| YouTube | `youtube.com/watch?v=…`, `youtu.be/…`, `/shorts/`, `/live/` ve `/embed/` adresleri; `t` ya da `start` başlangıç zamanı | `www.youtube-nocookie.com` |
| Vimeo | `vimeo.com/…`, liste dışı videolar için gizli anahtarlı adresler, `player.vimeo.com/video/…`; `#t=` başlangıç zamanı | `player.vimeo.com`, `dnt=1` ile |
| Spotify | `open.spotify.com` üzerindeki şarkı, albüm, çalma listesi, bölüm, program ve sanatçı adresleri | `open.spotify.com/embed` |

Bağlantılar adres olarak ayrıştırılır ve alan adı birebir karşılaştırılır. Kısaltılmış adresler ve yönlendirmeler izlenmez, sağlayıcıya hiçbir sorgu gönderilmez.

## Kaydedilen HTML

Oynatıcı her zaman sağlayıcı ve kimlikten yeniden kurulur; `sandbox`, `allow` ve `referrerpolicy` değerleri sabittir ve içerikten okunmaz. Kaydedilen HTML `div[data-embed]` sarmalayıcısını ve iki biçimden birini taşır:

- `facade: false` (varsayılan): sarmalayıcının içinde oynatıcı `iframe` bulunur. Sayfa açılınca oynatıcı sağlayıcıdan yüklenir.
- `facade: true`: sarmalayıcının içinde videonun sağlayıcıdaki sayfasına giden bir bağlantı bulunur. Oynatıcı, okuyucu tıklayınca yüklenir.

Word ve Markdown dosyalarına kaydederken oynatıcılar bağlantı olarak yazılır.

### Ön yüzlü çıktıyı yayınlamak

`facade: true` ile kaydedilen içeriği gösteren sayfada `activateEmbeds()` çağırın. Bağlantıya tıklanınca yerine oynatıcı gelir ve oynatma başlar:

```ts
import { activateEmbeds } from '@viveeditor/ext-embed/activate'

activateEmbeds(document.querySelector('article'), { providers: ['youtube', 'vimeo'] })
```

İlk değer aranacak kök öğedir (verilmezse tüm belge), `providers` ise izin verilen sağlayıcılardır. Oynatıcı adresi bağlantının `href` değerinden değil, sarmalayıcıdaki sağlayıcı ve kimlikten kurulur. `activateEmbeds` çağrılmazsa bağlantı videoyu sağlayıcının sitesinde açar.

## Sunucuda

- HTML'i sunucuda da temizleyin, ama hiçbir zaman tüm `iframe` öğelerine izin vermeyin. `@viveeditor/sanitize` ile `embeds: true` verin; oynatıcılar sağlayıcı ve kimlikten yeniden kurulur. Bkz. [Sunucuda temizleme](https://editor.vivepdf.com/dokumantasyon/sunucuda-temizleme/).
- Kendi temizleyicinizi kullanıyorsanız oynatıcıları `div[data-embed]` öğesinden yeniden kurun ya da yalnızca `isAllowedEmbedSrc()` için `true` dönen adresleri kabul edin.

```ts
import { isAllowedEmbedSrc } from '@viveeditor/ext-embed'

const allowed = isAllowedEmbedSrc(src, ['youtube', 'vimeo'])
```

`isAllowedEmbedSrc` adresin editörün kurduğu oynatıcı adresiyle birebir aynı olup olmadığına bakar. Aynı paketteki `matchEmbedUrl(url)` bir bağlantıdan sağlayıcıyı ve kimliği çıkarır, `buildEmbedSrc(attrs)` oynatıcı adresini kurar. Üçü de tarayıcı DOM'una ihtiyaç duymaz.

## İçerik Güvenliği Politikası ve gizlilik

- CSP `frame-src` yönergesinde yalnızca açtığınız sağlayıcıları listeleyin. Üçü açıksa: `frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://open.spotify.com`.
- Oynatıcı, sağlayıcıdan içerik ve çerez yükler. Onay kurallarınız gerektiriyorsa okuyuculara bunu söyleyin; ön yüzlü çıktı oynatıcıyı yalnızca tıklamadan sonra yükler.

> **Referrer-Policy**
>
> Sayfa genelinde `Referrer-Policy: no-referrer` kullanırsanız YouTube oynatıcıları çalışmaz. Oynatıcılar bu yüzden `strict-origin-when-cross-origin` ile kurulur.

Diğer CSP ayarları için [Güvenlik ve CSP](https://editor.vivepdf.com/dokumantasyon/guvenlik-ve-csp/) sayfasına bakın.

## Editörde video neden hemen yüklenmiyor?

Editör içinde oynatıcının yerinde bir kart durur. Oynat düğmesine basılana kadar sağlayıcıdan hiçbir şey yüklenmez; bu, yazarın gizliliğini korur ve sayfayı hafif tutar.

## Başka sitelerin video bağlantılarını ekleyebilir miyim?

Hayır. Yalnızca YouTube, Vimeo ve Spotify desteklenir. Diğer bağlantılar oynatıcıya çevrilmez, panel desteklenen sağlayıcıları listeler.

## Sayfamda Referrer-Policy no-referrer var, YouTube neden çalışmıyor?

YouTube, Referer bilgisi olmayan gömülü oynatıcıları reddeder. Sayfa genelinde no-referrer kullanılırsa YouTube oynatıcıları çalışmaz.
