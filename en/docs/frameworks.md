# Frameworks

> Use viveEditor in React, Vue, Svelte and Angular, or as a <vive-editor> form field, with notes for server rendering.

URL: https://editor.vivepdf.com/en/docs/frameworks/
Last updated: 2026-11-01

viveEditor has a small component package for React, Vue, Svelte and Angular, and a `<vive-editor>` custom element for any page. Each one gives you the same editor as the one-script build, with every extension and the toolbar, and keeps no editor logic of its own.

## What every component shares

- The value is HTML, and an empty document is `''`.
- Pass `extensions` to choose your own list, or `ui: false` to leave out the toolbar. `ui` also takes the toolbar options, such as `{ theme: 'dark' }`.
- `locale` picks Turkish or English, and `label` names the editing area for screen readers.
- A new value from outside is applied without firing a change event and without entering the undo history. Setting the current value again does nothing.
- File menu converters are not loaded by default. Pass them in `ui.files`; see [Open, save and print](https://editor.vivepdf.com/en/docs/open-save-print/).
- Load the styles once with `import 'viveeditor/style.css'`.

Install the component next to `viveeditor`:

```sh
npm install @viveeditor/react viveeditor
```

## React

React 18 and 19.

```tsx
import { useState } from 'react'
import { ViveEditor } from '@viveeditor/react'
import 'viveeditor/style.css'

export function ArticleForm() {
  const [html, setHtml] = useState('')
  return <ViveEditor value={html} onChange={setHtml} locale="en" label="Article body" />
}
```

- Use `value` with `onChange`, or `defaultValue` alone.
- `onReady`, `onFocus`, `onBlur` and `onError` receive the editor or the error. `editable`, `id`, `className` and `style` are also accepted.
- A `ref` on the component gives you the `Editor`.
- `useViveEditor(options)` returns `{ ref, editor }` for your own markup: put `ref` on a `div`.
- If the component unmounts before the editor is ready, as in StrictMode, the editor is destroyed as soon as it exists and `onReady` is never called.

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
  <ViveEditor v-model="html" locale="en" label="Article body" />
</template>
```

- Props: `v-model`, `extensions`, `ui`, `locale`, `label`, `editable`.
- Events: `ready`, `focus`, `blur` and `error`. The component exposes `editor`.
- `useViveEditor(() => options)` returns `{ el, editor }` for your own markup.

## Svelte

Svelte 5.

```svelte
<script>
  import { ViveEditor } from '@viveeditor/svelte'
  import 'viveeditor/style.css'
  let html = $state('')
</script>

<ViveEditor bind:value={html} locale="en" label="Article body" />
```

- `bind:value` and `bind:editor` keep the HTML and the editor in your state.
- Callbacks: `onchange`, `onready`, `onfocus`, `onblur` and `onerror`.
- The `use:viveEditor` action puts the editor on any element and takes the same options.

## Angular

Angular 21 and 22, with `ngModel` or reactive forms.

```ts
import { Component } from '@angular/core'
import { FormControl, ReactiveFormsModule } from '@angular/forms'
import { ViveEditorComponent } from '@viveeditor/angular'

@Component({
  selector: 'app-article-form',
  imports: [ViveEditorComponent, ReactiveFormsModule],
  template: `<vive-ng-editor [formControl]="body" locale="en" label="Article body" />`,
})
export class ArticleForm {
  body = new FormControl('')
}
```

- The selector is `vive-ng-editor`. `vive-editor` is the custom element below.
- Inputs: `extensions`, `ui`, `locale`, `label`, `readonly`.
- Outputs: `ready`, `editorFocus` and `editorBlur`. The component's `editor` property gives the editor.
- Add `node_modules/viveeditor/dist/viveeditor.css` to `styles` in `angular.json`.

## The `<vive-editor>` element

`@viveeditor/element` works as a form field on any page and in any framework.

```html
<script type="module">
  import '@viveeditor/element/define'
</script>

<form>
  <vive-editor name="body" required locale="en" label="Article body"></vive-editor>
</form>
```

- It sends its HTML with the form, returns to its first value when the form resets, and blocks submit while `required` and empty.
- Attributes: `value` (the first value), `name`, `locale`, `label`, `readonly`, `disabled`, `required` and `toolbar="false"`.
- It fires `input` on every change and `change` on blur when the value changed.
- It uses no shadow DOM, so your page styles reach it. Moving it in the page keeps its value.
- `defineViveEditor('my-editor')` registers it under another tag name.

The element is an npm package; the CDN script does not include it.

## Server rendering

With Next.js, Nuxt, SvelteKit or Angular SSR, the server renders an empty element and the editor starts in the browser. Each package mounts only there: React in `useEffect`, Vue in `onMounted`, Svelte through its action, Angular in `afterNextRender`, and the element in `connectedCallback`. The React package is marked `'use client'`.

When you print stored HTML on a page, pass it through the server sanitizer first; see [Server sanitizing](https://editor.vivepdf.com/en/docs/server-sanitizing/).
