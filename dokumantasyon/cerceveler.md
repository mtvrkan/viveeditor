# Çerçeveler

> viveEditor'ü React, Vue, Svelte ve Angular'da ya da <vive-editor> form alanı olarak kullanın; sunucu tarafı işleme notlarıyla.

URL: https://editor.vivepdf.com/dokumantasyon/cerceveler/
Son güncelleme: 2026-11-01

viveEditor'ün React, Vue, Svelte ve Angular için küçük birer bileşen paketi, herhangi bir sayfa için de `<vive-editor>` özel öğesi var. Hepsi tek betikli sürümdeki editörün aynısını, tüm eklentiler ve araç çubuğuyla birlikte verir; kendilerine ait editör mantığı taşımazlar.

## Bütün bileşenlerde ortak olanlar

- Değer HTML'dir; boş belge `''` olur.
- Kendi eklenti listeniz için `extensions`, araç çubuğunu kaldırmak için `ui: false` verin. `ui`, `{ theme: 'dark' }` gibi araç çubuğu seçeneklerini de alır.
- `locale` Türkçe ya da İngilizceyi seçer; `label` yazma alanına ekran okuyucuların okuyacağı adı verir.
- Dışarıdan gelen yeni değer, değişiklik olayı tetiklenmeden ve geri alma geçmişine girmeden uygulanır. Aynı değeri yeniden vermek hiçbir şey yapmaz.
- Dosya menüsü dönüştürücüleri varsayılan olarak yüklenmez. Onları `ui.files` içinde verin; bkz. [Dosya aç, kaydet, yazdır](https://editor.vivepdf.com/dokumantasyon/dosya-ac-kaydet-yazdir/).
- Stilleri bir kez `import 'viveeditor/style.css'` ile yükleyin.

Bileşeni `viveeditor` ile birlikte kurun:

```sh
npm install @viveeditor/react viveeditor
```

## React

React 18 ve 19.

```tsx
import { useState } from 'react'
import { ViveEditor } from '@viveeditor/react'
import 'viveeditor/style.css'

export function ArticleForm() {
  const [html, setHtml] = useState('')
  return <ViveEditor value={html} onChange={setHtml} locale="tr" label="Makale metni" />
}
```

- `value` ile `onChange` birlikte ya da tek başına `defaultValue` kullanın.
- `onReady`, `onFocus`, `onBlur` ve `onError` editörü ya da hatayı alır. `editable`, `id`, `className` ve `style` de kabul edilir.
- Bileşene verilen `ref` size `Editor` nesnesini verir.
- `useViveEditor(options)` kendi işaretlemeniz için `{ ref, editor }` döndürür; `ref` değerini bir `div` öğesine bağlayın.
- Bileşen, StrictMode'da olduğu gibi editör hazır olmadan kaldırılırsa editör oluşur oluşmaz kapatılır ve `onReady` hiç çağrılmaz.

## Vue

Vue 3.5.

```vue
<script setup>
import { ref } from 'vue'
import { ViveEditor } from '@viveeditor/vue'
import 'viveeditor/style.css'

const html = ref('')
</script>

<template>
  <ViveEditor v-model="html" locale="tr" label="Makale metni" />
</template>
```

- Özellikler: `v-model`, `extensions`, `ui`, `locale`, `label`, `editable`.
- Olaylar: `ready`, `focus`, `blur` ve `error`. Bileşen `editor` değerini dışarı açar.
- `useViveEditor(() => options)` kendi işaretlemeniz için `{ el, editor }` döndürür.

## Svelte

Svelte 5.

```svelte
<script>
  import { ViveEditor } from '@viveeditor/svelte'
  import 'viveeditor/style.css'
  let html = $state('')
</script>

<ViveEditor bind:value={html} locale="tr" label="Makale metni" />
```

- `bind:value` ve `bind:editor` HTML'i ve editörü durumunuzda tutar.
- Geri çağırmalar: `onchange`, `onready`, `onfocus`, `onblur` ve `onerror`.
- `use:viveEditor` eylemi editörü herhangi bir öğeye yerleştirir ve aynı seçenekleri alır.

## Angular

Angular 21 ve 22; `ngModel` ya da reaktif formlarla.

```ts
import { Component } from '@angular/core'
import { FormControl, ReactiveFormsModule } from '@angular/forms'
import { ViveEditorComponent } from '@viveeditor/angular'

@Component({
  selector: 'app-article-form',
  imports: [ViveEditorComponent, ReactiveFormsModule],
  template: `<vive-ng-editor [formControl]="body" locale="tr" label="Makale metni" />`,
})
export class ArticleForm {
  body = new FormControl('')
}
```

- Seçici `vive-ng-editor`'dür. `vive-editor` aşağıda anlatılan özel öğedir.
- Girdiler: `extensions`, `ui`, `locale`, `label`, `readonly`.
- Çıktılar: `ready`, `editorFocus` ve `editorBlur`. Bileşenin `editor` özelliği editörü verir.
- `node_modules/viveeditor/dist/viveeditor.css` dosyasını `angular.json` içindeki `styles` listesine ekleyin.

## `<vive-editor>` öğesi

`@viveeditor/element` her sayfada ve her çerçevede form alanı olarak çalışır.

```html
<script type="module">
  import '@viveeditor/element/define'
</script>

<form>
  <vive-editor name="body" required locale="tr" label="Makale metni"></vive-editor>
</form>
```

- HTML'ini formla birlikte gönderir, form sıfırlanınca ilk değerine döner ve `required` iken boşsa gönderimi engeller.
- Öznitelikler: `value` (ilk değer), `name`, `locale`, `label`, `readonly`, `disabled`, `required` ve `toolbar="false"`.
- Her değişiklikte `input`, değer değiştiyse odak çıkınca `change` olayını tetikler.
- Shadow DOM kullanmaz; sayfanızın stilleri ona ulaşır. Sayfada yeri değişse de değerini korur.
- `defineViveEditor('my-editor')` öğeyi başka bir etiket adıyla kaydeder.

Öğe bir npm paketidir; CDN betiğinde yer almaz.

## Sunucu tarafı işleme

Next.js, Nuxt, SvelteKit ya da Angular SSR ile sunucu boş bir öğe üretir ve editör tarayıcıda başlar. Her paket editörü yalnızca orada kurar: React `useEffect` içinde, Vue `onMounted` içinde, Svelte eylemiyle, Angular `afterNextRender` içinde, özel öğe de `connectedCallback` içinde. React paketi `'use client'` olarak işaretlidir.

Kayıtlı HTML'i bir sayfada gösterirken önce sunucu temizleyicisinden geçirin; bkz. [Sunucuda temizleme](https://editor.vivepdf.com/dokumantasyon/sunucuda-temizleme/).
