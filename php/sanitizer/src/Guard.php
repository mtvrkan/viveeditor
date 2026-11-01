<?php

declare(strict_types=1);

namespace Viveeditor\Sanitizer;

use Dom\Element;
use Dom\Node;

final class Guard
{
    private const TAG_NAME = 0;
    private const BEFORE_NAME = 1;
    private const NAME = 2;
    private const AFTER_NAME = 3;
    private const BEFORE_VALUE = 4;
    private const DOUBLE_QUOTED = 5;
    private const SINGLE_QUOTED = 6;
    private const UNQUOTED = 7;
    private const AFTER_QUOTED = 8;
    private const SELF_CLOSING = 9;
    private const STATES = 10;
    private const END = -1;

    public static function hasCrowdedTag(string $html, int $maxAttributes): bool
    {
        $length = strlen($html);
        $counts = array_fill(0, self::STATES, self::END);
        $active = false;
        for ($index = 0; $index < $length; $index++) {
            if (!$active) {
                $open = strpos($html, '<', $index);
                if ($open === false) {
                    return false;
                }
                $index = $open;
            }
            $char = $html[$index];
            if (self::opensTag($html, $index)) {
                $counts[self::TAG_NAME] = max($counts[self::TAG_NAME], 0);
            }
            $next = array_fill(0, self::STATES, self::END);
            $active = false;
            foreach ($counts as $state => $count) {
                if ($count === self::END) {
                    continue;
                }
                $target = self::transition($state, $char);
                if ($target === self::END) {
                    continue;
                }
                $total = $count + ($target & 1);
                if ($total > $maxAttributes) {
                    return true;
                }
                $reached = $target >> 1;
                if ($total > $next[$reached]) {
                    $next[$reached] = $total;
                    $active = true;
                }
            }
            $counts = $next;
            $active = $active || $char === '<' || ($char === '/' && $index > 0 && $html[$index - 1] === '<');
        }
        return false;
    }

    public static function exceedsTree(Node $root, int $maxElements, int $maxNesting): bool
    {
        $elements = 0;
        $stack = [[$root, 0]];
        while ($stack !== []) {
            [$node, $depth] = array_pop($stack);
            for ($child = $node->firstChild; $child !== null; $child = $child->nextSibling) {
                if (!$child instanceof Element) {
                    continue;
                }
                $elements++;
                if ($elements > $maxElements || $depth + 1 > $maxNesting) {
                    return true;
                }
                $stack[] = [$child, $depth + 1];
            }
        }
        return false;
    }

    public static function tagCount(string $html): int
    {
        return substr_count($html, '<');
    }

    private static function opensTag(string $html, int $index): bool
    {
        if (!ctype_alpha($html[$index])) {
            return false;
        }
        $previous = $index > 0 ? $html[$index - 1] : '';
        return $previous === '<' || ($previous === '/' && $index > 1 && $html[$index - 2] === '<');
    }

    private static function isSpace(string $char): bool
    {
        return $char === ' ' || $char === "\t" || $char === "\n" || $char === "\f" || $char === "\r";
    }

    private static function move(int $state, int $added = 0): int
    {
        return $state * 2 + $added;
    }

    private static function transition(int $state, string $char): int
    {
        $space = self::isSpace($char);
        return match ($state) {
            self::TAG_NAME => $space ? self::move(self::BEFORE_NAME)
                : ($char === '/' ? self::move(self::SELF_CLOSING)
                : ($char === '>' ? self::END : self::move(self::TAG_NAME))),
            self::BEFORE_NAME => $space ? self::move(self::BEFORE_NAME)
                : ($char === '/' || $char === '>' ? self::transition(self::AFTER_NAME, $char)
                : self::move(self::NAME, 1)),
            self::NAME => $space || $char === '/' || $char === '>' ? self::transition(self::AFTER_NAME, $char)
                : ($char === '=' ? self::move(self::BEFORE_VALUE) : self::move(self::NAME)),
            self::AFTER_NAME => $space ? self::move(self::AFTER_NAME)
                : ($char === '/' ? self::move(self::SELF_CLOSING)
                : ($char === '=' ? self::move(self::BEFORE_VALUE)
                : ($char === '>' ? self::END : self::move(self::NAME, 1)))),
            self::BEFORE_VALUE => $space ? self::move(self::BEFORE_VALUE)
                : ($char === '"' ? self::move(self::DOUBLE_QUOTED)
                : ($char === "'" ? self::move(self::SINGLE_QUOTED)
                : ($char === '>' ? self::END : self::move(self::UNQUOTED)))),
            self::DOUBLE_QUOTED => self::move($char === '"' ? self::AFTER_QUOTED : self::DOUBLE_QUOTED),
            self::SINGLE_QUOTED => self::move($char === "'" ? self::AFTER_QUOTED : self::SINGLE_QUOTED),
            self::UNQUOTED => $space ? self::move(self::BEFORE_NAME)
                : ($char === '>' ? self::END : self::move(self::UNQUOTED)),
            self::AFTER_QUOTED => $space ? self::move(self::BEFORE_NAME)
                : ($char === '/' ? self::move(self::SELF_CLOSING)
                : ($char === '>' ? self::END : self::transition(self::BEFORE_NAME, $char))),
            self::SELF_CLOSING => $char === '>' ? self::END : self::transition(self::BEFORE_NAME, $char),
        };
    }
}
