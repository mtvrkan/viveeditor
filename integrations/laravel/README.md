# viveeditor/laravel

viveEditor for Laravel: a Blade editor component, local assets and server-side HTML cleaning.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
composer require viveeditor/laravel
php artisan vendor:publish --tag=viveeditor-assets
```

## Usage

```blade
<head>
  @viveeditorScripts
</head>

<x-viveeditor::editor name="body" id="body" :value="old('body', $post->body)" required />

<article>@viveHtml($post->body)</article>
```

Laravel 12+ and PHP 8.4+. Editor files are served from your own `public/vendor/viveeditor`; `@viveHtml` and the `ViveHtml` cast clean HTML with `viveeditor/sanitizer`. See [Laravel](https://github.com/mtvrkan/viveeditor#laravel).

## License

MIT
