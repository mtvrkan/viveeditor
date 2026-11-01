import { readFileSync } from 'node:fs'
import type { BuiltinLanguage } from 'shiki'

const manifest = JSON.parse(
  readFileSync(new URL('../../../../../packages/viveeditor/package.json', import.meta.url), 'utf8'),
) as { version: string }

export const CDN_VERSION = manifest.version === '0.0.0' ? 'x.y.z' : manifest.version

export type Snippet = { lang: BuiltinLanguage; code: string }

const cdn = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/viveeditor@${CDN_VERSION}/dist/viveeditor.css" />
<script src="https://cdn.jsdelivr.net/npm/viveeditor@${CDN_VERSION}/dist/viveeditor.classic.iife.js"></script>

<form method="post">
  <label for="body">Article</label>
  <textarea id="body" name="body" data-editor required></textarea>
</form>`

const npm = `import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { listExtensions } from '@viveeditor/ext-list'

const editor = await Editor.create(document.querySelector('#editor'), {
  extensions: [...basicExtensions, ...listExtensions],
  content: '<p>Hello <strong>world</strong></p>',
  label: 'Article body',
})

editor.on('change', () => console.log(editor.getHTML()))`

const react = `import { ViveEditor } from '@viveeditor/react'
import 'viveeditor/style.css'

<ViveEditor value={html} onChange={setHtml} locale="en" label="Article body" />`

const vue = `<script setup>
import { ViveEditor } from '@viveeditor/vue'
import 'viveeditor/style.css'
</script>

<template>
  <ViveEditor v-model="html" locale="en" label="Article body" />
</template>`

const svelte = `<script>
  import { ViveEditor } from '@viveeditor/svelte'
  import 'viveeditor/style.css'
  let html = $state('')
</script>

<ViveEditor bind:value={html} locale="en" label="Article body" />`

const angular = `import { ViveEditorComponent } from '@viveeditor/angular'

@Component({
  imports: [ViveEditorComponent, ReactiveFormsModule],
  template: \`<vive-ng-editor [formControl]="body" locale="en" label="Article body" />\`,
})
class ArticleForm {
  body = new FormControl('')
}`

const element = `<script type="module">
  import '@viveeditor/element/define'
</script>
<form>
  <vive-editor name="body" required locale="en" label="Article body"></vive-editor>
</form>`

const laravel = `composer require viveeditor/laravel
php artisan vendor:publish --tag=viveeditor-assets

<head>
  @viveeditorScripts
</head>

<x-viveeditor::editor name="body" id="body" :value="old('body', $post->body)" required />

<article>@viveHtml($post->body)</article>`

export const SNIPPETS: Record<string, Snippet> = {
  cdn: { lang: 'html', code: cdn },
  npm: { lang: 'ts', code: npm },
  react: { lang: 'tsx', code: react },
  vue: { lang: 'vue', code: vue },
  svelte: { lang: 'svelte', code: svelte },
  angular: { lang: 'ts', code: angular },
  element: { lang: 'html', code: element },
  laravel: { lang: 'blade', code: laravel },
}

export function localizedSnippet(id: string, locale: string): Snippet {
  const snippet = SNIPPETS[id]
  if (!snippet) throw new Error(`Unknown install snippet: ${id}`)
  if (locale !== 'tr') return snippet
  return {
    ...snippet,
    code: snippet.code
      .replaceAll('locale="en"', 'locale="tr"')
      .replaceAll('Article body', 'Makale metni')
      .replaceAll('>Article<', '>Makale<'),
  }
}
