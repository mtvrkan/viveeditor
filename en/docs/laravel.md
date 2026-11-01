# Laravel

> Add viveEditor to Laravel with a Blade component, local editor files, the @viveHtml directive and the ViveHtml cast for clean HTML.

URL: https://editor.vivepdf.com/en/docs/laravel/
Last updated: 2026-11-01

`viveeditor/laravel` brings viveEditor to Laravel 12 and newer on PHP 8.4 and newer. It adds a Blade component for the editor, serves the editor files from your own site and cleans HTML with [the PHP sanitizer](https://editor.vivepdf.com/en/docs/server-sanitizing/) when you save it and when you show it.

## Install

1. Add the package: `composer require viveeditor/laravel`. Laravel finds the service provider and the `ViveEditor` facade on its own.
2. Publish the editor files to `public/vendor/viveeditor`: `php artisan vendor:publish --tag=viveeditor-assets`.
3. Optionally publish the config file: `php artisan vendor:publish --tag=viveeditor-config`.

```sh
composer require viveeditor/laravel
php artisan vendor:publish --tag=viveeditor-assets
```

The editor files are published as copies. After you update the package, publish them again with `--force` so they match the new version. They are also tagged `laravel-assets`.

## Show the editor

Put `@viveeditorScripts` in the page's `<head>`. It prints the stylesheet and the editor script from your own `public/vendor/viveeditor`. Then use the component inside your form:

```blade
<head>
  @viveeditorScripts
</head>

<form method="post">
  @csrf
  <label for="body">Article</label>
  <x-viveeditor::editor name="body" id="body" :value="old('body', $post->body)" required />
  <button type="submit">Save</button>
</form>
```

The component renders a `<textarea>` that the editor takes over. The form posts the HTML under the field's `name`.

| Attribute | Meaning |
| --- | --- |
| `name` | Required. The form field name. |
| `value` | The starting HTML. Escaped for you. |
| `label` | Optional. Becomes the field's `aria-label` when there is no visible `<label>`. |

Other attributes, such as `id`, `required` or `data-files="false"` to hide the File menu, are passed to the textarea.

The component uses the one-script build, so the npm-only extras (mentions, emoji, formulas, footnotes, templates and the AI assistant) are not part of it.

## Show stored HTML

Print stored HTML with `@viveHtml(...)`. It cleans while printing, so rows written before you added cleaning, and rows written outside your forms, are safe too.

```blade
<article>@viveHtml($post->body)</article>
```

> **Never use the unescaped echo**
>
> Never print editor HTML with `{!! !!}`. It skips cleaning.

## Clean on save

The `ViveHtml` cast cleans on save and again on read, so rows written before the cast or by raw queries come back clean.

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

A row the cast cannot clean on read (too large or too complex) reads as an empty string, and the error goes to your exception handler. On save the error is thrown.

To clean anywhere else, use the facade. The second argument overrides the config options for that call:

```php
use Viveeditor\Laravel\Facades\ViveEditor;

$clean = ViveEditor::sanitize($request->input('body'));
$withEmbeds = ViveEditor::sanitize($html, ['embeds' => true]);
```

`ViveEditor::sanitize()` and `@viveHtml` throw `Viveeditor\Sanitizer\SanitizeException` for HTML that is too large or too complex. See [Server sanitizing](https://editor.vivepdf.com/en/docs/server-sanitizing/) for the limits.

## Configuration

`config/viveeditor.php` holds the asset folder and the sanitizer options used by `@viveHtml`, the cast and the facade:

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

If you enable video embeds in the editor, set `embeds` to `true` here, or they are removed when the HTML is cleaned.

## Content Security Policy

When you use `Vite::useCspNonce()`, the tags printed by `@viveeditorScripts` get the nonce. The editor copies that nonce to the add-on scripts it loads on first use (the Word and Markdown converters and the panels), which sit in the same folder. Your `script-src` must allow that folder. See [Laravel's Vite documentation](https://laravel.com/docs/vite) for setting the nonce, and [Security and CSP](https://editor.vivepdf.com/en/docs/security-and-csp/) for the rest of the policy.

## Language

The editor follows `<html lang="...">` for its language. Set it from the app locale in your layout:

```blade
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
```

## Related pages

- [Server sanitizing](https://editor.vivepdf.com/en/docs/server-sanitizing/)
- [Security and CSP](https://editor.vivepdf.com/en/docs/security-and-csp/)
- [Installation](https://editor.vivepdf.com/en/docs/installation/)

## Does the Laravel package load anything from a CDN?

No. The editor files are published to your own public/vendor/viveeditor folder and served from there.

## Can I print stored HTML with the unescaped Blade echo?

No. Show stored HTML with @viveHtml, which cleans it while printing, so old rows and rows written outside your forms are safe too.
