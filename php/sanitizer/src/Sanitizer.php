<?php

declare(strict_types=1);

namespace Viveeditor\Sanitizer;

use Dom\Element;
use Dom\HTMLDocument;
use Dom\Node;
use Dom\Text;

final class Sanitizer
{
    private const HTML_NS = 'http://www.w3.org/1999/xhtml';
    private const MAX_ROUNDS = 3;
    private const ROOT = ['parent' => '', 'taskList' => false, 'taskItem' => false, 'inLink' => false, 'footnote' => null];

    private HTMLDocument $document;
    private bool $embeds;
    private bool $allowBase64;
    private bool $allowRelative;

    private function __construct(array $options)
    {
        $this->document = HTMLDocument::createEmpty();
        $this->embeds = ($options['embeds'] ?? false) === true;
        $this->allowBase64 = ($options['allowBase64'] ?? false) === true;
        $this->allowRelative = ($options['allowRelativeImages'] ?? false) === true;
    }

    public static function sanitize(string $html, array $options = []): string
    {
        $maxBytes = $options['maxBytes'] ?? Profile::limit('maxBytes');
        if (strlen($html) > $maxBytes) {
            throw new SanitizeException(SanitizeException::TOO_LARGE, "HTML is larger than {$maxBytes} bytes.");
        }
        $sanitizer = new self($options);
        $clean = $sanitizer->run(self::scrub($html));
        for ($round = 1; $round < self::MAX_ROUNDS; $round++) {
            $again = $sanitizer->run($clean);
            if ($again === $clean) {
                break;
            }
            $clean = $again;
        }
        return $clean;
    }

    private static function tooComplex(): never
    {
        throw new SanitizeException(SanitizeException::TOO_COMPLEX, 'HTML has too many attributes, elements or nesting levels.');
    }

    private static function scrub(string $html): string
    {
        $previous = mb_substitute_character();
        mb_substitute_character(0xFFFD);
        try {
            $clean = mb_scrub($html, 'UTF-8');
        } finally {
            mb_substitute_character($previous);
        }
        return str_replace("\0", '', $clean);
    }

    private function run(string $html): string
    {
        if (Guard::hasCrowdedTag($html, Profile::limit('maxAttributes'))) {
            self::tooComplex();
        }
        $source = $this->document->createElement('body');
        $source->innerHTML = $html;
        $maxElements = Guard::tagCount($html) + Profile::limit('maxExtraElements');
        if (Guard::exceedsTree($source, $maxElements, Profile::limit('maxNesting'))) {
            self::tooComplex();
        }
        $output = $this->document->createElement('body');
        $this->walk($source, $output, 0, self::ROOT);
        return $output->innerHTML;
    }

    private function attributesOf(Element $element, string $tag): array
    {
        $result = [];
        foreach ($element->attributes as $attribute) {
            $max = $tag === 'img' && $attribute->localName === 'src'
                ? Profile::limit('maxImageSrcLength')
                : Profile::limit('maxAttributeLength');
            if ($attribute->namespaceURI !== null || strlen($attribute->value) > $max) {
                continue;
            }
            $result[$attribute->localName] ??= $attribute->value;
        }
        return $result;
    }

    private function append(Node $target, string $tag, array $attributes): Element
    {
        $element = $this->document->createElement($tag);
        foreach ($attributes as [$name, $value]) {
            $element->setAttribute($name, $value);
        }
        $target->appendChild($element);
        return $element;
    }

    private function styleOf(string $tag, array $source): array
    {
        $allowed = Profile::get()['elements'][$tag]['styles'] ?? null;
        $style = $source['style'] ?? null;
        if ($allowed === null || $style === null) {
            return [];
        }
        $clean = Values::cleanStyle($style, $allowed);
        return $clean === null ? [] : [['style', $clean]];
    }

    private function textAttribute(array $source, string $name): array
    {
        return isset($source[$name]) ? [[$name, Values::cleanText($source[$name])]] : [];
    }

    private function linkAttributes(array $source): array
    {
        $result = [['rel', Profile::get()['linkRel']]];
        $href = isset($source['href']) ? Values::cleanHref($source['href']) : null;
        if ($href !== null) {
            $result[] = ['href', $href];
        }
        array_push($result, ...$this->textAttribute($source, 'title'));
        if (($source['target'] ?? null) === '_blank') {
            $result[] = ['target', '_blank'];
        }
        return $result;
    }

    private function imageAttributes(array $source): ?array
    {
        $src = isset($source['src']) ? Values::cleanImageSrc($source['src'], $this->allowBase64, $this->allowRelative) : null;
        if ($src === null) {
            return null;
        }
        $result = [['src', $src]];
        array_push($result, ...$this->textAttribute($source, 'alt'), ...$this->textAttribute($source, 'title'));
        foreach (['width', 'height'] as $name) {
            $size = Values::cleanInteger($source[$name] ?? null, 1, Profile::limit('maxImageSize'));
            if ($size !== null) {
                $result[] = [$name, (string) $size];
            }
        }
        $image = Profile::get()['image'];
        array_push(
            $result,
            ['loading', $image['loading']],
            ['decoding', $image['decoding']],
            ['referrerpolicy', $image['referrerpolicy']],
        );
        return $result;
    }

    private function cellAttributes(array $source): array
    {
        $result = [];
        foreach (['colspan', 'rowspan'] as $name) {
            $span = Values::cleanInteger($source[$name] ?? null, 2, Profile::limit('maxSpan'));
            if ($span !== null) {
                $result[] = [$name, (string) $span];
            }
        }
        $widths = Values::cleanColWidth($source['data-colwidth'] ?? null);
        if ($widths !== null) {
            $result[] = ['data-colwidth', $widths];
        }
        return $result;
    }

    private function embed(array $source, Element $node, Node $target): void
    {
        $data = Embed::fromAttributes($source);
        if ($data === null) {
            return;
        }
        $wrapper = $this->append($target, 'div', $data->wrapperAttributes());
        $facade = false;
        for ($child = $node->firstChild; $child !== null; $child = $child->nextSibling) {
            if ($child instanceof Element && $child->localName === 'a') {
                $facade = true;
            }
        }
        if ($facade) {
            $link = $this->append($wrapper, 'a', [['href', $data->watchUrl()], ['rel', 'noopener noreferrer']]);
            $link->appendChild($this->document->createTextNode($data->label()));
        } else {
            $this->append($wrapper, 'iframe', $data->iframeAttributes());
        }
    }

    private function insertText(Node $target, string $value, array $context): void
    {
        $text = $context['footnote'] !== null ? Values::takeCodePoints($value, $context['footnote']) : $value;
        if ($text !== '') {
            $target->appendChild($this->document->createTextNode($text));
        }
    }

    private function textOf(Node $node, int $depth): string
    {
        $text = '';
        for ($child = $node->firstChild; $child !== null; $child = $child->nextSibling) {
            if ($child instanceof Text) {
                $text .= $child->data;
            } elseif (
                $child instanceof Element
                && $depth < Profile::limit('maxDepth')
                && $child->namespaceURI === self::HTML_NS
                && !in_array($child->localName, Profile::get()['dropWithContent'], true)
            ) {
                $text .= $this->textOf($child, $depth + 1);
            }
        }
        return $text;
    }

    private function mention(string $id, Element $node, Node $target, int $depth, array $context): void
    {
        $text = $this->textOf($node, $depth);
        if ($context['inLink'] || $context['footnote'] !== null || !Values::isMentionId($id)) {
            $this->insertText($target, $text, $context);
            return;
        }
        $label = Values::cleanMentionLabel($text);
        $created = $this->append($target, 'span', [['class', Profile::get()['mentionClass']], ['data-mention', $id]]);
        $created->appendChild($this->document->createTextNode('@' . ($label !== '' ? $label : $id)));
    }

    private function math(string $tag, Element $node, Node $target, int $depth, array $context): void
    {
        $text = $this->textOf($node, $depth);
        $latex = $context['inLink'] || $context['footnote'] !== null ? null : Values::cleanLatex($text);
        if ($latex === null) {
            $this->insertText($target, $text, $context);
            return;
        }
        $created = $this->append($target, $tag, [['data-math', $tag === 'span' ? 'inline' : 'block']]);
        $created->appendChild($this->document->createTextNode($latex));
    }

    private function footnote(Element $node, Node $target, int $depth, array $context): void
    {
        if ($context['inLink'] || $context['footnote'] !== null) {
            $this->walk($node, $target, $depth, $context);
            return;
        }
        $created = $this->append($target, 'sup', [['data-footnote', '']]);
        $inner = self::ROOT;
        $inner['parent'] = 'sup';
        $inner['footnote'] = (object) ['left' => Profile::limit('maxFootnoteLength')];
        $this->walk($node, $created, $depth, $inner);
    }

    private function walk(Node $source, Node $target, int $depth, array $context): void
    {
        for ($child = $source->firstChild; $child !== null; $child = $child->nextSibling) {
            if ($child instanceof Text) {
                $this->insertText($target, $child->data, $context);
            } elseif ($child instanceof Element) {
                $this->element($child, $target, $depth + 1, $context);
            }
        }
    }

    private function element(Element $node, Node $target, int $depth, array $context): void
    {
        if ($depth > Profile::limit('maxDepth') || $node->namespaceURI !== self::HTML_NS) {
            return;
        }
        $tag = $node->localName;
        if (in_array($tag, Profile::get()['dropWithContent'], true)) {
            return;
        }
        $source = $this->attributesOf($node, $tag);
        if ($context['footnote'] !== null && !in_array($tag, Profile::get()['footnoteElements'], true)) {
            $this->walk($node, $target, $depth, $context);
            return;
        }
        if ($tag === 'span' && isset($source['data-mention']) && ($source['class'] ?? null) === Profile::get()['mentionClass']) {
            $this->mention($source['data-mention'], $node, $target, $depth, $context);
            return;
        }
        $mathType = $source['data-math'] ?? null;
        if (($tag === 'span' && $mathType === 'inline') || ($tag === 'div' && $mathType === 'block')) {
            $this->math($tag, $node, $target, $depth, $context);
            return;
        }
        if ($tag === 'sup' && isset($source['data-footnote'])) {
            $this->footnote($node, $target, $depth, $context);
            return;
        }
        $next = [
            'parent' => $tag,
            'taskList' => false,
            'taskItem' => false,
            'inLink' => $context['inLink'] || $tag === 'a',
            'footnote' => $context['footnote'],
        ];
        $attributes = null;

        switch ($tag) {
            case 'div':
                if (($source['class'] ?? null) === 'vive-embed' && isset($source['data-embed'])) {
                    if ($this->embeds) {
                        $this->embed($source, $node, $target);
                    }
                    return;
                }
                if (isset($source['data-embed-invalid'])) {
                    return;
                }
                $attributes = $context['taskItem'] ? [] : null;
                break;
            case 'input':
                if (!$context['taskItem'] || ($source['type'] ?? null) !== 'checkbox') {
                    return;
                }
                $input = [['type', 'checkbox'], ['disabled', '']];
                if (isset($source['checked'])) {
                    $input[] = ['checked', ''];
                }
                $this->append($target, 'input', $input);
                return;
            case 'ul':
                $next['taskList'] = ($source['data-type'] ?? null) === 'taskList';
                $attributes = $next['taskList'] ? [['data-type', 'taskList']] : [];
                break;
            case 'li':
                $next['taskItem'] = $context['taskList'] && ($source['data-type'] ?? null) === 'taskItem';
                $attributes = $next['taskItem']
                    ? [
                        ['data-type', 'taskItem'],
                        ['data-checked', ($source['data-checked'] ?? null) === 'true' ? 'true' : 'false'],
                    ]
                    : [];
                break;
            case 'ol':
                $start = Values::cleanInteger($source['start'] ?? null, 0, Profile::limit('maxListStart'));
                $attributes = $start !== null && $start !== 1 ? [['start', (string) $start]] : [];
                break;
            case 'pre':
                $language = Values::cleanLanguage($source['data-language'] ?? null);
                $attributes = $language !== null && $language !== '' ? [['data-language', $language]] : [];
                break;
            case 'code':
                $language = null;
                if ($context['parent'] === 'pre' && preg_match('/^language-(.+)\z/', $source['class'] ?? '', $match) === 1) {
                    $language = Values::cleanLanguage($match[1]);
                }
                $attributes = $language !== null && $language !== '' ? [['class', 'language-' . $language]] : [];
                break;
            case 'a':
                $attributes = $context['inLink'] ? null : $this->linkAttributes($source);
                break;
            case 'sup':
                $attributes = null;
                break;
            case 'img':
                $image = $this->imageAttributes($source);
                if ($image !== null) {
                    $this->append($target, 'img', $image);
                }
                return;
            case 'td':
            case 'th':
                $attributes = $this->cellAttributes($source);
                break;
            default:
                $attributes = array_key_exists($tag, Profile::get()['elements']) ? $this->styleOf($tag, $source) : null;
        }

        if ($attributes === null) {
            $this->walk($node, $target, $depth, $context);
            return;
        }
        $created = $this->append($target, $tag, $attributes);
        $this->walk($node, $created, $depth, $next);
    }
}
