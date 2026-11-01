# viveeditor/sanitizer

Server-side sanitizer that keeps exactly the HTML viveEditor produces and removes everything else.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
composer require viveeditor/sanitizer
```

## Usage

```php
use Viveeditor\Sanitizer\Sanitizer;

$clean = Sanitizer::sanitize($html, ['embeds' => true]);
```

PHP 8.4+ with `ext-dom` and `ext-mbstring`, no other dependencies. Shares one allowlist and one test corpus with the Node package `@viveeditor/sanitize` and gives the same output. Keep `memory_limit` and the request body size at their usual values on endpoints that sanitize. See [Sanitize on the server](https://github.com/mtvrkan/viveeditor#sanitize-on-the-server).

## License

MIT
