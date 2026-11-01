<?php

declare(strict_types=1);

namespace Viveeditor\Laravel;

use Illuminate\Support\Facades\Vite;
use Viveeditor\Sanitizer\Sanitizer;

final class ViveEditor
{
    public function __construct(private readonly array $config)
    {
    }

    public function sanitize(?string $html, array $options = []): string
    {
        return Sanitizer::sanitize($html ?? '', [...($this->config['sanitize'] ?? []), ...$options]);
    }

    public function scripts(): string
    {
        $path = trim((string) ($this->config['asset_path'] ?? 'vendor/viveeditor'), '/');
        $nonce = Vite::cspNonce();
        $nonceAttribute = $nonce === null ? '' : ' nonce="' . e($nonce) . '"';
        return '<link rel="stylesheet" href="' . e(asset($path . '/viveeditor.css')) . '"' . $nonceAttribute . '>'
            . '<script src="' . e(asset($path . '/viveeditor.classic.iife.js')) . '" defer' . $nonceAttribute . '></script>';
    }
}
