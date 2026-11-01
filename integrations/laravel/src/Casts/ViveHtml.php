<?php

declare(strict_types=1);

namespace Viveeditor\Laravel\Casts;

use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;
use Viveeditor\Laravel\ViveEditor;
use Viveeditor\Sanitizer\SanitizeException;

final class ViveHtml implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        if ($value === null) {
            return null;
        }
        try {
            return app(ViveEditor::class)->sanitize((string) $value);
        } catch (SanitizeException $error) {
            report($error);
            return '';
        }
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?string
    {
        return $value === null ? null : app(ViveEditor::class)->sanitize((string) $value);
    }
}
