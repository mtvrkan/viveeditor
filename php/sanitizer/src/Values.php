<?php

declare(strict_types=1);

namespace Viveeditor\Sanitizer;

final class Values
{
    private const SPACE = '[\t\n\f\r ]';
    private const SCHEME = '/^([a-z][a-z0-9+.-]*):/i';
    private const HEX = '/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\z/i';
    private const PIXELS = '/^([0-9]{1,5})px\z/';
    private const DIGITS = '/^[0-9]{1,5}\z/';
    private const LANGUAGE = '/^[a-z0-9][a-z0-9+#.-]{0,31}\z/i';
    private const HTTPS_URL = '/^https:\/\/[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?(?::[0-9]{1,5})?(?:[\/?#][\x21-\x7e]*)?\z/i';
    private const BASE64_IMAGE = '/^data:image\/([a-z]+);base64,[A-Za-z0-9+\/]+={0,2}\z/';
    private const URL_FORBIDDEN = '/["\'<>\\\\`]/';
    private const CONTROL = '/[\x00-\x1f\x7f]|\xc2[\x80-\x9f]/';
    private const BANNED_STYLE = ['\\', '/*', 'url(', 'expression', '@', '!important'];

    public static function matches(string $pattern, string $value): bool
    {
        return preg_match($pattern, $value) === 1;
    }

    public static function lowerAscii(string $value): string
    {
        return strtr($value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz');
    }

    public static function trimAscii(string $value): string
    {
        return trim($value, "\t\n\f\r ");
    }

    public static function cleanText(string $value, ?int $max = null): string
    {
        $max ??= Profile::limit('maxTextAttributeLength');
        $result = [];
        foreach (mb_str_split($value, 1, 'UTF-8') as $character) {
            if (count($result) >= $max) {
                break;
            }
            $code = mb_ord($character, 'UTF-8');
            $result[] = $code < 0x20 || ($code >= 0x7f && $code <= 0x9f) ? ' ' : $character;
        }
        return implode('', $result);
    }

    private static function isHidden(int $code): bool
    {
        return $code <= 0x1f
            || ($code >= 0x7f && $code <= 0x9f)
            || ($code >= 0x200b && $code <= 0x200f)
            || ($code >= 0x202a && $code <= 0x202e)
            || ($code >= 0x2066 && $code <= 0x2069)
            || $code === 0xfeff;
    }

    public static function isMentionId(string $value): bool
    {
        $max = Profile::limit('maxMentionId') - 1;
        return self::matches('/\A(?!.*\.\.)[A-Za-z0-9_][A-Za-z0-9_.:@-]{0,' . $max . '}\z/D', $value);
    }

    public static function cleanMentionLabel(string $value): string
    {
        $result = '';
        foreach (mb_str_split($value, 1, 'UTF-8') as $character) {
            $code = mb_ord($character, 'UTF-8');
            if ($code === 0x09 || $code === 0x0a || $code === 0x0d) {
                $result .= ' ';
            } elseif (!self::isHidden($code)) {
                $result .= $character;
            }
        }
        $label = self::trimAscii(ltrim(self::trimAscii((string) preg_replace('/' . self::SPACE . '+/', ' ', $result)), '@'));
        return self::trimAscii(mb_substr($label, 0, Profile::limit('maxMentionLabel'), 'UTF-8'));
    }

    public static function cleanLatex(string $value): ?string
    {
        $result = '';
        foreach (mb_str_split($value, 1, 'UTF-8') as $character) {
            $code = mb_ord($character, 'UTF-8');
            if ($code === 0x09 || $code === 0x0a || !self::isHidden($code)) {
                $result .= $character;
            }
        }
        $latex = self::trimAscii($result);
        if ($latex === '' || mb_strlen($latex, 'UTF-8') > Profile::limit('maxMathLength')) {
            return null;
        }
        $depth = 0;
        $max = Profile::limit('maxMathDepth');
        foreach (str_split($latex) as $byte) {
            if ($byte === '{') {
                $depth++;
            } elseif ($byte === '}') {
                $depth = max(0, $depth - 1);
            }
            if ($depth > $max) {
                return null;
            }
        }
        return $latex;
    }

    public static function takeCodePoints(string $value, \stdClass $budget): string
    {
        if ($budget->left <= 0) {
            return '';
        }
        $kept = mb_substr($value, 0, $budget->left, 'UTF-8');
        $budget->left -= mb_strlen($kept, 'UTF-8');
        return $kept;
    }

    public static function cleanInteger(?string $value, int $min, int $max): ?int
    {
        if ($value === null || !self::matches(self::DIGITS, $value)) {
            return null;
        }
        $number = (int) $value;
        return $number >= $min && $number <= $max ? $number : null;
    }

    public static function cleanLanguage(?string $value): ?string
    {
        return $value !== null && self::matches(self::LANGUAGE, $value) ? self::lowerAscii($value) : null;
    }

    public static function cleanColWidth(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $parts = explode(',', $value);
        if (count($parts) > Profile::limit('maxSpan')) {
            return null;
        }
        foreach ($parts as $part) {
            if (self::cleanInteger($part, 1, 9999) === null) {
                return null;
            }
        }
        return $value;
    }

    private static function hexPair(int $value): string
    {
        return str_pad(dechex(min(255, $value)), 2, '0', STR_PAD_LEFT);
    }

    private static function expandHex(string $hex): string
    {
        $digits = self::lowerAscii(substr($hex, 1));
        if (strlen($digits) > 4) {
            return '#' . $digits;
        }
        $result = '#';
        foreach (str_split($digits) as $digit) {
            $result .= $digit . $digit;
        }
        return $result;
    }

    private static function alphaOf(?string $raw): float
    {
        if ($raw === null || $raw === '') {
            return 1.0;
        }
        $value = (float) $raw;
        return str_ends_with($raw, '%') ? $value / 100 : $value;
    }

    public static function cleanColor(string $input): ?string
    {
        $space = self::SPACE;
        $value = self::trimAscii($input);
        $lower = self::lowerAscii($value);
        if ($value === '' || in_array($lower, Profile::get()['colorKeywordsRejected'], true)) {
            return null;
        }
        if (self::matches(self::HEX, $value)) {
            $hex = self::expandHex($value);
            return strlen($hex) === 9 && str_ends_with($hex, '00') ? null : $hex;
        }
        $rgb = "/^rgba?\\({$space}*([0-9]{1,3}){$space}*,{$space}*([0-9]{1,3}){$space}*,{$space}*([0-9]{1,3}){$space}*(?:,{$space}*([0-9.]+%?){$space}*)?\\)\\z/i";
        if (preg_match($rgb, $value, $parts) === 1) {
            $alpha = self::alphaOf($parts[4] ?? null);
            if (!($alpha > 0)) {
                return null;
            }
            $hex = '#' . self::hexPair((int) $parts[1]) . self::hexPair((int) $parts[2]) . self::hexPair((int) $parts[3]);
            return $alpha >= 1 ? $hex : $hex . self::hexPair((int) round($alpha * 255));
        }
        $hsl = "/^hsla?\\({$space}*[0-9]{1,3}(?:\\.[0-9]+)?(?:deg)?{$space}*,?{$space}*[0-9]{1,3}(?:\\.[0-9]+)?%{$space}*,?{$space}*[0-9]{1,3}(?:\\.[0-9]+)?%{$space}*(?:[,\\/]{$space}*[0-9.]+%?{$space}*)?\\)\\z/i";
        if (self::matches($hsl, $value)) {
            return preg_replace("/{$space}+/", ' ', $lower);
        }
        return in_array($lower, Profile::get()['namedColors'], true) ? $lower : null;
    }

    private static function styleValue(string $property, string $value): ?string
    {
        if ($property === 'text-align') {
            $align = self::lowerAscii($value);
            return in_array($align, Profile::get()['textAlign'], true) ? $align : null;
        }
        if ($property === 'color' || $property === 'background-color') {
            return self::cleanColor($value);
        }
        $number = preg_match(self::PIXELS, $value, $parts) === 1 ? (int) $parts[1] : 0;
        return $number > 0 && $number <= Profile::limit('maxTableWidth') ? $number . 'px' : null;
    }

    public static function cleanStyle(string $value, array $allowed): ?string
    {
        if (strlen($value) > count($allowed) * (Profile::limit('maxStyleValueLength') + 32)) {
            return null;
        }
        $lower = self::lowerAscii($value);
        foreach (self::BANNED_STYLE as $banned) {
            if (str_contains($lower, $banned)) {
                return null;
            }
        }
        $result = [];
        foreach (explode(';', $value) as $declaration) {
            $colon = strpos($declaration, ':');
            if ($colon === false) {
                continue;
            }
            $property = self::lowerAscii(self::trimAscii(substr($declaration, 0, $colon)));
            $raw = self::trimAscii(substr($declaration, $colon + 1));
            if (!in_array($property, $allowed, true) || array_key_exists($property, $result)) {
                continue;
            }
            if (strlen($raw) > Profile::limit('maxStyleValueLength')) {
                continue;
            }
            $clean = self::styleValue($property, $raw);
            if ($clean !== null) {
                $result[$property] = $clean;
            }
        }
        if ($result === []) {
            return null;
        }
        $declarations = [];
        foreach ($result as $property => $clean) {
            $declarations[] = $property . ': ' . $clean;
        }
        return implode('; ', $declarations);
    }

    private static function trimEdges(string $value): string
    {
        return trim($value, "\x00..\x20");
    }

    private static function hasControl(string $value): bool
    {
        return preg_match(self::CONTROL, $value) !== 0;
    }

    public static function cleanHref(string $input): ?string
    {
        if (strlen($input) > Profile::limit('maxAttributeLength')) {
            return null;
        }
        $value = self::trimEdges(str_replace(["\t", "\n", "\r"], '', $input));
        if ($value === '' || self::hasControl($value) || str_contains($value, '\\') || str_starts_with($value, '//')) {
            return null;
        }
        if (preg_match(self::SCHEME, $value, $parts) !== 1) {
            return $value;
        }
        $scheme = self::lowerAscii($parts[1]);
        if (!in_array($scheme, Profile::get()['linkProtocols'], true)) {
            return null;
        }
        if (($scheme === 'http' || $scheme === 'https') && preg_match('/^https?:\/\/[^\/]/i', $value) !== 1) {
            return null;
        }
        return $value;
    }

    public static function cleanImageSrc(string $input, bool $allowBase64, bool $allowRelative): ?string
    {
        $value = self::trimEdges(str_replace(["\t", "\n", "\r"], '', $input));
        if ($value === '' || self::hasControl($value)) {
            return null;
        }
        if (preg_match(self::BASE64_IMAGE, $value, $parts) === 1) {
            return $allowBase64
                && strlen($value) <= Profile::limit('maxImageSrcLength')
                && in_array($parts[1], Profile::get()['image']['base64Types'], true)
                ? $value
                : null;
        }
        if (strlen($value) > Profile::limit('maxUrlLength') || preg_match(self::URL_FORBIDDEN, $value) !== 0) {
            return null;
        }
        if (str_starts_with($value, '//')) {
            $candidate = 'https:' . $value;
        } elseif (preg_match('/^http:\/\//i', $value) === 1) {
            $candidate = 'https://' . substr($value, 7);
        } else {
            $candidate = $value;
        }
        if (self::matches(self::HTTPS_URL, $candidate)) {
            return $candidate;
        }
        if (preg_match(self::SCHEME, $value) === 1 || str_starts_with($value, '//') || !$allowRelative) {
            return null;
        }
        return self::matches('/^[\x21-\x7e ]+\z/', $value) ? str_replace(' ', '%20', $value) : null;
    }
}
