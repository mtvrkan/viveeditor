# Şablonlar

> templateMenu ile / menüsünde hazır içerik blokları sunun; her şablon eklenmeden önce editör şemasından geçer.

URL: https://editor.vivepdf.com/dokumantasyon/sablonlar/
Son güncelleme: 2026-11-01

Şablonlar yazara hızlı bir başlangıç sunar: bir yazışma düzeni, toplantı notu ya da ürün sayfası iskeleti. `templateMenu`, her şablon için `/` menüsüne bir giriş ekler; seçilen şablonun içeriği imlecin olduğu yere eklenir.

Şablonlar yalnızca npm paketi olarak gelir; tek betikli sürümde yoktur.

## Kurulum

1. Arayüzü kurun: `npm install @viveeditor/ui @viveeditor/core`.
2. Şablonlarınızı bir giriş listesi olarak yazın.
3. Listeyi `templateMenu`'ye verin ve `createUI`'nin `plugins` listesine ekleyin.

```ts
import { createUI } from '@viveeditor/ui'
import { type Template, templateMenu } from '@viveeditor/ui/extras'

const templates: Template[] = [
  {
    id: 'memo',
    label: 'Yazışma',
    description: 'Konu, özet ve sonraki adımlar',
    content: '<h2>Konu</h2><p></p><h3>Sonraki adımlar</h3><ul><li><p></p></li></ul>',
  },
  {
    id: 'meeting',
    label: 'Toplantı notu',
    content: '<h2>Toplantı notu</h2><p><strong>Katılanlar:</strong> </p><p></p>',
  },
]

createUI(editor, { plugins: [templateMenu(templates)] })
```

## Şablon girişleri

| Alan | Anlamı |
| --- | --- |
| `id` | Giriş için benzersiz bir ad. |
| `label` | `/` menüsünde "Şablon:" sözcüğünden sonra görünen metin. |
| `description` | İsteğe bağlı. Menü aramasının eşleştirdiği ek sözcükler. |
| `content` | Eklenecek içerik; HTML metni ya da editör JSON'u. |

Menü araması etiketi ve "template", "sablon" sözcüklerini de eşleştirir. `templateMenu`'nün ikinci bağımsız değişkeni menü etiketlerini değiştirir, örneğin `templateMenu(templates, { template: 'Düzen' })`.

Editör salt okunur olduğunda şablon seçmek bir şey eklemez.

## Şema süzgeci

Şablon içeriği, yapıştırılan içerik gibi editör şemasından geçer. Şemanın tanımadığı her şey atılır: betikler, olay işleyicileri, bilinmeyen öğeler ve öznitelikler. Şablon yalnızca editörde eklentisi yüklü blokları ve biçimleri kullanabilir. Şablonda tablo varsa ama tablo eklentisi yüklü değilse, tablo olarak korunmaz.

## Boyut sınırı

HTML'i 2 MB'ı aşan şablon atlanır ve menüde görünmez.

## Güven

Şema güvensiz işaretlemeyi kaldırır, ama şablondaki sözcükleri ve bağlantıları değerlendiremez. Yalnızca kendi yazdığınız ya da güvendiğiniz şablonları sunun. Yazarlar birbirleri için şablon oluşturabiliyorsa, şablonları [sunucu temizleyicisinden](https://editor.vivepdf.com/dokumantasyon/sunucuda-temizleme/) geçirerek saklayın ve kimin kime şablon yayımlayabileceğini denetleyin.

## İlgili sayfalar

- [Araç çubuğu ve kısayollar](https://editor.vivepdf.com/dokumantasyon/arac-cubugu-ve-kisayollar/)
- [Sunucuda temizleme](https://editor.vivepdf.com/dokumantasyon/sunucuda-temizleme/)

## Bir şablon betik ya da özel işaretleme taşıyabilir mi?

Hayır. Şablon içeriği yapıştırılan içerik gibi editör şemasından geçer; betikler ve bilinmeyen işaretlemeler atılır.

## Boyut sınırı var mı?

Evet. 2 MB'tan büyük şablonlar atlanır ve menüde görünmez.
