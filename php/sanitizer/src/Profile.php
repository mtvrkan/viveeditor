<?php

declare(strict_types=1);

namespace Viveeditor\Sanitizer;

final class Profile
{
    private static ?array $profile = null;

    public static function get(): array
    {
        if (self::$profile === null) {
            $json = file_get_contents(__DIR__ . '/../resources/profile.json');
            if ($json === false) {
                throw new \RuntimeException('viveEditor sanitizer profile is missing.');
            }
            self::$profile = json_decode($json, true, 16, JSON_THROW_ON_ERROR);
        }
        return self::$profile;
    }

    public static function limit(string $name): int
    {
        return (int) self::get()['limits'][$name];
    }
}
