<?php

declare(strict_types=1);

namespace Viveeditor\Sanitizer;

final class Embed
{
    private const VIMEO_HASH = '/^[0-9a-f]{8,20}\z/';

    private function __construct(
        public readonly string $provider,
        public readonly array $rule,
        public readonly string $id,
        public readonly ?string $hash,
        public readonly ?int $start,
        public readonly ?string $title,
    ) {
    }

    private static function idPattern(string $provider): ?string
    {
        return match ($provider) {
            'youtube' => '/^[A-Za-z0-9_-]{11}\z/',
            'vimeo' => '/^[1-9][0-9]{0,11}\z/',
            'spotify' => '/^(?:' . implode('|', Profile::get()['spotifyTypes']) . '):[A-Za-z0-9]{22}\z/',
            default => null,
        };
    }

    public static function fromAttributes(array $attributes): ?self
    {
        $provider = $attributes['data-embed'] ?? '';
        $rule = Profile::get()['embedProviders'][$provider] ?? null;
        $pattern = self::idPattern($provider);
        $id = $attributes['data-id'] ?? '';
        if ($rule === null || $pattern === null || !Values::matches($pattern, $id)) {
            return null;
        }
        $hash = $attributes['data-hash'] ?? null;
        $title = $attributes['data-title'] ?? null;
        $cleanTitle = null;
        if ($title !== null) {
            $cleanTitle = Values::cleanText(
                Values::trimAscii(Values::cleanText($title, PHP_INT_MAX)),
                Profile::limit('maxEmbedTitle'),
            );
            $cleanTitle = $cleanTitle === '' ? null : $cleanTitle;
        }
        return new self(
            $provider,
            $rule,
            $id,
            $provider === 'vimeo' && $hash !== null && Values::matches(self::VIMEO_HASH, $hash) ? $hash : null,
            $provider === 'spotify'
                ? null
                : Values::cleanInteger($attributes['data-start'] ?? null, 1, Profile::limit('maxEmbedStart')),
            $cleanTitle,
        );
    }

    private function path(): string
    {
        return str_replace(':', '/', $this->id);
    }

    public function src(): string
    {
        $base = 'https://' . $this->rule['host'];
        if ($this->provider === 'youtube') {
            return $base . '/embed/' . $this->id . ($this->start ? '?start=' . $this->start : '');
        }
        if ($this->provider === 'vimeo') {
            $hash = $this->hash ? '&h=' . $this->hash : '';
            $start = $this->start ? '#t=' . $this->start . 's' : '';
            return $base . '/video/' . $this->id . '?dnt=1' . $hash . $start;
        }
        return $base . '/embed/' . $this->path();
    }

    public function watchUrl(): string
    {
        if ($this->provider === 'youtube') {
            return 'https://www.youtube.com/watch?v=' . $this->id . ($this->start ? '&t=' . $this->start . 's' : '');
        }
        if ($this->provider === 'vimeo') {
            $hash = $this->hash ? '/' . $this->hash : '';
            return 'https://vimeo.com/' . $this->id . $hash . ($this->start ? '#t=' . $this->start . 's' : '');
        }
        return 'https://open.spotify.com/' . $this->path();
    }

    public function label(): string
    {
        return $this->title ?? $this->rule['label'];
    }

    public function wrapperAttributes(): array
    {
        $result = [
            ['class', 'vive-embed'],
            ['data-embed', $this->provider],
            ['data-id', $this->id],
        ];
        if ($this->hash) {
            $result[] = ['data-hash', $this->hash];
        }
        if ($this->start) {
            $result[] = ['data-start', (string) $this->start];
        }
        if ($this->title) {
            $result[] = ['data-title', $this->title];
        }
        return $result;
    }

    public function iframeAttributes(): array
    {
        $rule = $this->rule;
        $compact = false;
        foreach ($rule['compactTypes'] ?? [] as $type) {
            if (str_starts_with($this->id, $type . ':')) {
                $compact = true;
            }
        }
        $height = $compact && !empty($rule['compactHeight']) ? $rule['compactHeight'] : $rule['height'];
        return [
            ['src', $this->src()],
            ['title', $this->label()],
            ['width', (string) $rule['width']],
            ['height', (string) $height],
            [
                'style',
                $rule['fluid']
                    ? "width: 100%; height: auto; aspect-ratio: {$rule['width']} / {$height}; border: 0"
                    : "width: 100%; height: {$height}px; border: 0",
            ],
            ['loading', 'lazy'],
            ['referrerpolicy', 'strict-origin-when-cross-origin'],
            ['sandbox', $rule['sandbox']],
            ['allow', $rule['allow']],
            ['allowfullscreen', ''],
        ];
    }
}
