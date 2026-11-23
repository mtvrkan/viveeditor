<?php

declare(strict_types=1);

namespace Viveeditor\Sanitizer;

final class FormattingGuard
{
    private const FORMATTING = [
        'a' => true, 'b' => true, 'big' => true, 'code' => true, 'em' => true, 'font' => true, 'i' => true,
        'nobr' => true, 's' => true, 'small' => true, 'strike' => true, 'strong' => true, 'tt' => true, 'u' => true,
    ];
    private const INLINE_FORMATTING = [
        'a' => true, 'b' => true, 'big' => true, 'code' => true, 'em' => true, 'font' => true, 'i' => true,
        's' => true, 'small' => true, 'strike' => true, 'strong' => true, 'tt' => true, 'u' => true,
    ];
    private const PHRASING = [
        'span' => true, 'mark' => true, 'sub' => true, 'sup' => true, 'abbr' => true, 'cite' => true, 'dfn' => true,
        'kbd' => true, 'samp' => true, 'var' => true, 'q' => true, 'time' => true, 'data' => true, 'bdi' => true,
        'bdo' => true, 'ins' => true, 'del' => true, 'label' => true, 'iframe' => true,
    ];
    private const INLINE_VOID = ['br' => true, 'img' => true, 'input' => true, 'wbr' => true];
    private const BLOCKS = [
        'p' => true, 'h1' => true, 'h2' => true, 'h3' => true, 'h4' => true, 'h5' => true, 'h6' => true,
        'blockquote' => true, 'div' => true, 'pre' => true, 'ul' => true, 'ol' => true, 'figure' => true,
        'figcaption' => true, 'hr' => true, 'table' => true, 'address' => true, 'article' => true, 'aside' => true,
        'center' => true, 'footer' => true, 'header' => true, 'main' => true, 'nav' => true, 'section' => true,
    ];
    private const HEADINGS = ['h1' => true, 'h2' => true, 'h3' => true, 'h4' => true, 'h5' => true, 'h6' => true];
    private const TABLE_PARTS = [
        'table' => true, 'tbody' => true, 'thead' => true, 'tfoot' => true, 'tr' => true, 'colgroup' => true,
    ];
    private const SECTIONS = ['tbody' => true, 'thead' => true, 'tfoot' => true];
    private const ROW_PARTS = ['td' => true, 'th' => true, 'tr' => true, 'tbody' => true, 'thead' => true, 'tfoot' => true];
    private const SCOPE_BOUNDARIES = [
        'table' => true, 'td' => true, 'th' => true, 'tr' => true, 'tbody' => true, 'thead' => true, 'tfoot' => true,
        'colgroup' => true, 'iframe' => true,
    ];
    private const SPACE = " \t\n\f\r";
    private const VOID = [
        'area' => true, 'base' => true, 'basefont' => true, 'bgsound' => true, 'br' => true, 'col' => true,
        'embed' => true, 'frame' => true, 'hr' => true, 'image' => true, 'img' => true, 'input' => true,
        'keygen' => true, 'link' => true, 'meta' => true, 'param' => true, 'source' => true, 'track' => true,
        'wbr' => true,
    ];
    private const RAW_TEXT = [
        'iframe' => true, 'noembed' => true, 'noframes' => true, 'script' => true, 'style' => true,
        'textarea' => true, 'title' => true, 'xmp' => true,
    ];
    private const UNMODELLED = ['frameset' => true, 'math' => true, 'select' => true, 'svg' => true, 'template' => true];
    private const CLOSES_PARAGRAPH = [
        'address' => true, 'article' => true, 'aside' => true, 'blockquote' => true, 'center' => true,
        'details' => true, 'dialog' => true, 'dir' => true, 'div' => true, 'dl' => true, 'fieldset' => true,
        'figcaption' => true, 'figure' => true, 'footer' => true, 'header' => true, 'hgroup' => true,
        'main' => true, 'menu' => true, 'nav' => true, 'ol' => true, 'search' => true, 'section' => true,
        'summary' => true, 'ul' => true, 'h1' => true, 'h2' => true, 'h3' => true, 'h4' => true, 'h5' => true,
        'h6' => true, 'pre' => true, 'listing' => true, 'form' => true, 'hr' => true, 'xmp' => true,
    ];
    private const IMPLIED_PER_TAG = 3;
    private const NESTING_SLACK = 4;
    private const MAX_SCOPE_STEPS = 32_000_000;
    private const LIST_ITEM_WALK = 32;
    private const ADOPTION_CLONES = 32;
    private const RECONSTRUCTIONS_PER_TAG = 3;
    private const SAME_ENTRIES = 3;
    private const KEY_LIMIT = 256;

    private array $stack = [];
    private array $open = [];
    private int $openFormatting = 0;
    private array $formattingKeys = [];
    private int $activeFormatting = 0;
    private bool $loose = false;
    private int $cost = 0;
    private int $work = 0;
    private readonly int $maxDepth;

    private function __construct(private readonly int $limit, private readonly int $maxNesting)
    {
        $this->maxDepth = $maxNesting * self::NESTING_SLACK;
    }

    public static function hasTemplate(string $html): bool
    {
        return preg_match('~<template(?:[\t\n\f\r />]|$)~i', $html) === 1;
    }

    public static function startTagCount(string $html): int
    {
        return preg_match_all('~<[A-Za-z]~', $html);
    }

    public static function exceeds(string $html, int $limit, int $maxNesting): bool
    {
        $guard = new self($limit, $maxNesting);
        return $guard->scan($html);
    }

    private static function remember(array &$keys, string $name, ?string $attributes): bool
    {
        if ($name === 'a') {
            $first = !isset($keys['a']);
            $keys['a'] = true;
            return $first;
        }
        if ($attributes === null || strlen($attributes) > self::KEY_LIMIT) {
            return true;
        }
        $key = $name . "\0" . $attributes;
        $keys[$key] = ($keys[$key] ?? 0) + 1;
        return $keys[$key] <= self::SAME_ENTRIES;
    }

    private static function next(string $html, string $needle, int $from): int
    {
        $found = strpos($html, $needle, $from);
        return $found === false ? strlen($html) : $found;
    }

    private function scan(string $html): bool
    {
        $length = strlen($html);
        $index = 0;
        while ($index < $length) {
            $open = strpos($html, '<', $index);
            $textEnd = $open === false ? $length : $open;
            if ($textEnd > $index && !$this->onText(substr($html, $index, $textEnd - $index))) {
                return true;
            }
            if ($open === false) {
                return false;
            }
            $index = $open;
            $next = $html[$index + 1] ?? '';
            if (str_starts_with(substr($html, $index, 4), '<!--')) {
                $index = self::commentEnd($html, $index + 4);
                continue;
            }
            if ($next === '!' || $next === '?') {
                $index = self::afterBogus($html, $index + 2);
                continue;
            }
            if ($next === '/') {
                $first = $html[$index + 2] ?? '';
                if ($first === '>') {
                    $index += 3;
                    continue;
                }
                if ($first === '') {
                    return !$this->onText('</');
                }
                if (!ctype_alpha($first)) {
                    $index = self::afterBogus($html, $index + 2);
                    continue;
                }
                $tag = self::readTag($html, $index + 2);
                if ($tag === null) {
                    return false;
                }
                if (!$this->onEnd($tag[0])) {
                    return true;
                }
                $index = $tag[1];
                continue;
            }
            if ($next === '' || !ctype_alpha($next)) {
                if (!$this->onText('<')) {
                    return true;
                }
                $index++;
                continue;
            }
            $tag = self::readTag($html, $index + 1);
            if ($tag === null) {
                return false;
            }
            [$name, $after] = $tag;
            $attributesStart = $index + 1 + strlen($name);
            $attributes = substr($html, $attributesStart, $after - 1 - $attributesStart);
            if (!$this->loose && !$this->start($name, $attributes)) {
                $this->loose = true;
            }
            if ($this->loose && isset(self::UNMODELLED[$name])) {
                return $this->countEveryTag($html, $index);
            }
            if ($this->loose ? !$this->looseStart($name, $attributes) : count($this->stack) > $this->maxNesting) {
                return true;
            }
            if ($name === 'plaintext') {
                return false;
            }
            $index = $after;
            if (isset(self::RAW_TEXT[$name])) {
                $close = $name === 'script'
                    ? self::scriptEnd($html, $index)
                    : (preg_match('~</' . $name . '[\t\n\f\r />]~i', $html, $match, PREG_OFFSET_CAPTURE, $index) === 1
                        ? $match[0][1]
                        : null);
                if ($close === null) {
                    return false;
                }
                $index = $close;
            }
        }
        return false;
    }

    private static function scriptEnd(string $html, int $index): ?int
    {
        $state = 'data';
        while (preg_match('~<!--|-->|</script(?=[\t\n\f\r />])|<script(?=[\t\n\f\r />])~i', $html, $match, PREG_OFFSET_CAPTURE, $index) === 1) {
            [$token, $position] = $match[0];
            $token = strtolower($token);
            $index = $position + ($token === '<!--' ? 2 : strlen($token));
            if ($token === '<!--' && $state === 'data') {
                $state = 'escaped';
            } elseif ($token === '-->' && $state !== 'data') {
                $state = 'data';
            } elseif ($token === '</script') {
                if ($state !== 'double') {
                    return $position;
                }
                $state = 'escaped';
            } elseif ($token === '<script' && $state === 'escaped') {
                $state = 'double';
            }
        }
        return null;
    }

    private function exceeded(): bool
    {
        return $this->cost > $this->limit
            || $this->work > self::MAX_SCOPE_STEPS
            || count($this->stack) + $this->activeFormatting > $this->maxDepth;
    }

    private function onText(string $text): bool
    {
        if (!$this->loose && $this->text($text)) {
            return true;
        }
        $this->loose = true;
        $this->cost += $this->activeFormatting;
        return !$this->exceeded();
    }

    private function onEnd(string $name): bool
    {
        if (!$this->loose && $this->end($name)) {
            return !$this->exceeded();
        }
        $this->loose = true;
        $this->work += count($this->stack);
        $this->cost += self::RECONSTRUCTIONS_PER_TAG * $this->activeFormatting;
        if (isset(self::FORMATTING[$name])) {
            $this->cost += self::ADOPTION_CLONES;
        }
        if ($name === 'p' || $name === 'br') {
            $this->cost++;
        }
        if ($this->top() === $name && $name !== 'body' && $name !== 'html') {
            $this->pop();
        }
        return !$this->exceeded();
    }

    private function looseStart(string $name, string $attributes): bool
    {
        if (isset(self::FORMATTING[$name]) && self::remember($this->formattingKeys, $name, $attributes)) {
            $this->activeFormatting++;
        }
        $this->work += count($this->stack);
        $this->cost += self::RECONSTRUCTIONS_PER_TAG * $this->activeFormatting;
        if ($name === 'a' || $name === 'nobr') {
            $this->cost += self::ADOPTION_CLONES;
        }
        $top = $this->top();
        if (($name === 'p' || isset(self::CLOSES_PARAGRAPH[$name])) && $top === 'p') {
            $this->pop();
        } elseif ($name === 'li' || $name === 'dd' || $name === 'dt') {
            if ($top === 'p') {
                $this->pop();
            }
            $sibling = $this->top();
            if ($sibling === $name || ($name !== 'li' && ($sibling === 'dd' || $sibling === 'dt'))) {
                $this->pop();
            }
        } elseif ($name === 'td' || $name === 'th' || $name === 'tr') {
            if ($top === 'td' || $top === 'th') {
                $this->pop();
            }
            if ($name === 'tr' && $this->top() === 'tr') {
                $this->pop();
            }
            if ($name === 'tr' || $this->top() !== 'tr') {
                if (!isset(self::SECTIONS[$this->top()])) {
                    $this->implied('tbody');
                }
                if ($name !== 'tr') {
                    $this->implied('tr');
                }
            }
        } elseif ($name === 'col' && $top !== 'colgroup') {
            $this->implied('colgroup');
        }
        if (!isset(self::VOID[$name])) {
            $this->push($name);
        }
        return !$this->exceeded();
    }

    private function countEveryTag(string $html, int $from): bool
    {
        $length = strlen($html);
        $cost = $this->cost;
        $depth = count($this->stack);
        $work = $this->work;
        $keys = $this->formattingKeys;
        $formatting = $this->activeFormatting;
        $nextClose = -1;
        $nextDouble = -1;
        $nextSingle = -1;
        for ($index = strpos($html, '<', $from); $index !== false; $index = strpos($html, '<', $index + 1)) {
            $closing = ($html[$index + 1] ?? '') === '/';
            $start = $index + ($closing ? 2 : 1);
            $nameLength = strspn($html, 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', $start);
            $end = $start + $nameLength;
            $name = strtolower(substr($html, $start, $nameLength));
            $delimited = $end >= $length || str_contains(self::SPACE . '/>', $html[$end]);
            $isFormatting = $nameLength > 0 && $delimited && isset(self::FORMATTING[$name]);
            if ($isFormatting && !$closing) {
                $nextClose = $nextClose >= $end ? $nextClose : self::next($html, '>', $end);
                $nextDouble = $nextDouble >= $end ? $nextDouble : self::next($html, '"', $end);
                $nextSingle = $nextSingle >= $end ? $nextSingle : self::next($html, "'", $end);
                $quoted = min($nextDouble, $nextSingle) < $nextClose || $nextClose === $length;
                $attributes = $quoted || $nextClose - $end > self::KEY_LIMIT
                    ? null
                    : substr($html, $end, $nextClose - $end);
                if (self::remember($keys, $name, $attributes)) {
                    $formatting++;
                }
            }
            if ($closing && $delimited && ($name === 'p' || $name === 'br')) {
                $cost++;
            }
            $cost += self::RECONSTRUCTIONS_PER_TAG * $formatting;
            if (($isFormatting && $closing) || (!$closing && $delimited && ($name === 'a' || $name === 'nobr'))) {
                $cost += self::ADOPTION_CLONES;
            }
            $depth += self::IMPLIED_PER_TAG;
            $work += $depth;
            if ($cost > $this->limit || $work > self::MAX_SCOPE_STEPS || $depth + $formatting > $this->maxDepth) {
                return true;
            }
        }
        return false;
    }

    private static function commentEnd(string $html, int $index): int
    {
        if (($html[$index] ?? '') === '>') {
            return $index + 1;
        }
        if (substr($html, $index, 2) === '->') {
            return $index + 2;
        }
        $dash = strpos($html, '-->', $index);
        $bang = strpos($html, '--!>', $index);
        if ($dash === false && $bang === false) {
            return strlen($html);
        }
        if ($bang === false || ($dash !== false && $dash < $bang)) {
            return $dash + 3;
        }
        return $bang + 4;
    }

    private static function afterBogus(string $html, int $index): int
    {
        $close = strpos($html, '>', $index);
        return $close === false ? strlen($html) : $close + 1;
    }

    private static function readTag(string $html, int $index): ?array
    {
        $length = strlen($html);
        $nameLength = strcspn($html, self::SPACE . '/>', $index);
        $name = strtolower(substr($html, $index, $nameLength));
        $index += $nameLength;
        while ($index < $length) {
            $char = $html[$index];
            if (str_contains(self::SPACE, $char) || $char === '/') {
                $index++;
                continue;
            }
            if ($char === '>') {
                return [$name, $index + 1];
            }
            $index += 1 + strcspn($html, self::SPACE . '/>=', $index + 1);
            $index += strspn($html, self::SPACE, $index);
            if (($html[$index] ?? '') !== '=') {
                continue;
            }
            $index++;
            $index += strspn($html, self::SPACE, $index);
            $quote = $html[$index] ?? '';
            if ($quote === '"' || $quote === "'") {
                $close = strpos($html, $quote, $index + 1);
                if ($close === false) {
                    return null;
                }
                $index = $close + 1;
                continue;
            }
            if ($quote === '>') {
                return [$name, $index + 1];
            }
            $index += strcspn($html, self::SPACE . '>', $index);
        }
        return null;
    }

    private function top(): string
    {
        return $this->stack === [] ? '' : $this->stack[array_key_last($this->stack)];
    }

    private function push(string $name): void
    {
        $this->stack[] = $name;
        $this->open[$name] = ($this->open[$name] ?? 0) + 1;
        if (isset(self::FORMATTING[$name])) {
            $this->openFormatting++;
        }
    }

    private function implied(string $name): void
    {
        $this->cost++;
        $this->push($name);
    }

    private function pop(): void
    {
        $name = array_pop($this->stack);
        $this->open[$name]--;
        if (isset(self::FORMATTING[$name])) {
            $this->openFormatting--;
        }
    }

    private function text(string $text): bool
    {
        return !isset(self::TABLE_PARTS[$this->top()])
            || $this->openFormatting === 0
            || strspn($text, self::SPACE) === strlen($text);
    }

    private static function isOrdinary(string $name): bool
    {
        return (isset(self::PHRASING[$name]) && $name !== 'iframe') || strpbrk($name, ':-') !== false;
    }

    private function start(string $name, string $attributes): bool
    {
        $inTable = isset(self::TABLE_PARTS[$this->top()]);
        if (isset(self::INLINE_FORMATTING[$name])) {
            if ($inTable || ($name === 'a' && ($this->open['a'] ?? 0) > 0)) {
                return false;
            }
            if (self::remember($this->formattingKeys, $name, $attributes)) {
                $this->activeFormatting++;
            }
            $this->push($name);
            return true;
        }
        if (self::isOrdinary($name) || isset(self::PHRASING[$name]) || isset(self::INLINE_VOID[$name])) {
            if ($inTable) {
                return false;
            }
            if (!isset(self::INLINE_VOID[$name])) {
                $this->push($name);
            }
            return true;
        }
        if ($this->openFormatting > 0) {
            return false;
        }
        if (isset(self::BLOCKS[$name])) {
            if ($inTable || !$this->closeParagraph()) {
                return false;
            }
            if (isset(self::HEADINGS[$name]) && isset(self::HEADINGS[$this->top()])) {
                $this->pop();
            }
            if ($name !== 'hr') {
                $this->push($name);
            }
            return true;
        }
        return match ($name) {
            'li' => $this->startListItem(),
            'tbody', 'thead', 'tfoot' => $this->startSection($name),
            'tr' => $this->startRow(),
            'td', 'th' => $this->startCell($name),
            'colgroup' => $this->startIn('colgroup', 'table'),
            'col' => $this->top() === 'colgroup',
            default => false,
        };
    }

    private function closeParagraph(): bool
    {
        if (($this->open['p'] ?? 0) === 0) {
            return true;
        }
        for ($position = count($this->stack) - 1; $this->stack[$position] !== 'p'; $position--) {
            if (isset(self::SCOPE_BOUNDARIES[$this->stack[$position]])) {
                return false;
            }
        }
        while ($this->top() !== 'p') {
            $this->pop();
        }
        $this->pop();
        return true;
    }

    private function startListItem(): bool
    {
        $last = count($this->stack) - 1;
        for ($position = $last; $position >= 0; $position--) {
            if ($last - $position >= self::LIST_ITEM_WALK) {
                return false;
            }
            $node = $this->stack[$position];
            if ($node === 'li') {
                while ($this->top() !== 'li') {
                    $this->pop();
                }
                $this->pop();
                break;
            }
            if ($node !== 'div' && $node !== 'p' && $node !== 'address' && !self::isOrdinary($node)) {
                break;
            }
        }
        if (!$this->closeParagraph()) {
            return false;
        }
        $this->push('li');
        return true;
    }

    private function startSection(string $name): bool
    {
        if ($this->top() === 'colgroup') {
            $this->pop();
        }
        return $this->startIn($name, 'table');
    }

    private function startRow(): bool
    {
        if ($this->top() === 'colgroup') {
            $this->pop();
        }
        if ($this->top() === 'tr') {
            $this->pop();
        }
        if ($this->top() === 'table') {
            $this->implied('tbody');
        }
        return $this->startIn('tr', 'tbody', 'thead', 'tfoot');
    }

    private function startCell(string $name): bool
    {
        if ($this->top() === 'td' || $this->top() === 'th') {
            $this->pop();
        }
        if ($this->top() === 'table') {
            $this->implied('tbody');
        }
        if (isset(self::SECTIONS[$this->top()])) {
            $this->implied('tr');
        }
        return $this->startIn($name, 'tr');
    }

    private function startIn(string $name, string ...$parents): bool
    {
        if (!in_array($this->top(), $parents, true)) {
            return false;
        }
        $this->push($name);
        return true;
    }

    private function end(string $name): bool
    {
        if ($name === 'br') {
            $this->cost++;
            return $this->start('br', '');
        }
        if (($this->open[$name] ?? 0) === 0) {
            $this->cost++;
            return $name === 'p' && !isset(self::TABLE_PARTS[$this->top()]);
        }
        if ($this->top() === $name) {
            $this->pop();
            return true;
        }
        if (isset(self::FORMATTING[$name]) || self::isOrdinary($name)) {
            return false;
        }
        $closesTable = isset(self::ROW_PARTS[$name]) || $name === 'table';
        for ($position = count($this->stack) - 1; $this->stack[$position] !== $name; $position--) {
            $above = $this->stack[$position];
            if (isset(self::FORMATTING[$above]) || isset(self::HEADINGS[$above]) && isset(self::HEADINGS[$name])) {
                return false;
            }
            if ($closesTable ? ($above === 'table' && $name !== 'table') : isset(self::SCOPE_BOUNDARIES[$above])) {
                return false;
            }
            if ($name === 'li' && ($above === 'ul' || $above === 'ol')) {
                return false;
            }
        }
        while ($this->top() !== $name) {
            $this->pop();
        }
        $this->pop();
        return true;
    }
}
