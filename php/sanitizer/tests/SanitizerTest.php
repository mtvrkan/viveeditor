<?php

declare(strict_types=1);

namespace Viveeditor\Sanitizer\Tests;

use Dom\HTMLDocument;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
use Viveeditor\Sanitizer\SanitizeException;
use Viveeditor\Sanitizer\Sanitizer;

final class SanitizerTest extends TestCase
{
    private const FIXTURES = __DIR__ . '/../../../tests/fixtures/sanitize/';

    private static function corpus(string $file): array
    {
        $cases = json_decode((string) file_get_contents(self::FIXTURES . $file), true, 64, JSON_THROW_ON_ERROR);
        $result = [];
        foreach ($cases as $case) {
            if (isset($case['error'])) {
                continue;
            }
            $result[$case['name']] = [$case['input'], $case['options'] ?? [], $case['expected']];
        }
        return $result;
    }

    private static function tree(string $html): string
    {
        $body = HTMLDocument::createEmpty()->createElement('body');
        $body->innerHTML = $html;
        return $body->innerHTML;
    }

    public static function cases(): array
    {
        return self::corpus('cases.json');
    }

    public static function refusedCases(): array
    {
        $cases = json_decode((string) file_get_contents(self::FIXTURES . 'cases.json'), true, 64, JSON_THROW_ON_ERROR);
        $result = [];
        foreach ($cases as $case) {
            if (isset($case['error'])) {
                $result[$case['name']] = [$case['input'], $case['options'] ?? [], $case['error']];
            }
        }
        return $result;
    }

    #[DataProvider('refusedCases')]
    public function testRefusesTheSameInputAsTheNodeSanitizer(string $input, array $options, string $error): void
    {
        try {
            Sanitizer::sanitize($input, $options);
            $this->fail('Expected SanitizeException');
        } catch (SanitizeException $exception) {
            $this->assertSame($error, $exception->reason);
        }
    }

    public static function parity(): array
    {
        return self::corpus('parity.json');
    }

    #[DataProvider('cases')]
    #[DataProvider('parity')]
    public function testMatchesTheNodeSanitizer(string $input, array $options, string $expected): void
    {
        $clean = Sanitizer::sanitize($input, $options);

        $again = Sanitizer::sanitize($clean, $options);

        $this->assertSame(self::tree($expected), self::tree($clean));
        $this->assertSame($clean, $again);
    }

    public function testKeepsTheEditorKitchenSinkWithEmbeds(): void
    {
        $html = rtrim((string) file_get_contents(self::FIXTURES . 'kitchen-sink.html'));

        $clean = Sanitizer::sanitize($html, ['embeds' => true]);

        $expected = rtrim((string) file_get_contents(self::FIXTURES . 'kitchen-sink.sanitized.html'));
        $this->assertSame(self::tree($expected), self::tree($clean));
        $this->assertSame($clean, Sanitizer::sanitize($clean, ['embeds' => true]));
    }

    public static function badFontFamilies(): array
    {
        return [
            'markup' => [['Arial</style>']],
            'a CSS function' => [['var(--font)']],
            'an empty entry' => [['']],
            'a name with a double quote' => [['"Inter", sans-serif']],
            'an entry longer than 64 bytes' => [[str_repeat('A', 70) . ', serif']],
            'a value that is not a string' => [[12]],
        ];
    }

    #[DataProvider('badFontFamilies')]
    public function testRefusesAHostFontFamilyListItCannotRead(array $fontFamilies): void
    {
        $this->expectException(\InvalidArgumentException::class);

        Sanitizer::sanitize('<p>a</p>', ['fontFamilies' => $fontFamilies]);
    }

    public function testThrowsTooLargeAboveTheByteLimit(): void
    {
        $input = str_repeat('<p>ğ</p>', 10);

        try {
            Sanitizer::sanitize($input, ['maxBytes' => 50]);
            $this->fail('Expected SanitizeException');
        } catch (SanitizeException $error) {
            $this->assertSame(SanitizeException::TOO_LARGE, $error->reason);
        }
    }

    public static function tooComplex(): array
    {
        $paragraphs = '';
        for ($index = 0; $index < 600; $index++) {
            $paragraphs .= "<p><b c={$index}>x</p>";
        }
        $distinct = '';
        for ($index = 0; $index < 200; $index++) {
            $distinct .= "<b c={$index}>";
        }
        $plain = '';
        foreach (['b', 'big', 'code', 'em', 'font', 'i', 'nobr', 's', 'small', 'strike', 'strong', 'tt', 'u'] as $tag) {
            $plain .= str_repeat("<{$tag}>", 3);
        }
        return [
            'one tag with many attributes' => ['<p' . str_repeat(' a=1', 65) . '>x</p>'],
            'attributes hidden behind a quoted >' => ['<p a=">"' . str_repeat(' b', 70) . '>x</p>'],
            'deep nesting' => [str_repeat('<div>', 600)],
            'nested unknown end tags' => [str_repeat('<span>', 20000) . str_repeat('</y>', 20000)],
            'formatting rebuilt in every paragraph' => [$paragraphs],
            'formatting without attributes rebuilt in every paragraph' => ['<p>' . $plain . 'x</p>' . str_repeat('<p>x</p>', 20000)],
            'formatting rebuilt by a closing br' => [str_repeat('<div>', 2000) . $distinct . str_repeat('</br></div>', 2000)],
            'formatting kept behind an object marker' => ['<section><div>' . $distinct . '</div><object>' . str_repeat('</b>', 200) . '</object></section>' . str_repeat('<p>x</p>', 2000)],
            'many closing paragraphs without an opening one' => [str_repeat('</p>', 100001)],
            'formatting inside a template' => ['<template>' . $paragraphs],
            'formatting hidden in a comment-like attribute' => ['<p title="<!--">' . $paragraphs . '</p>'],
            'more tags than maxTags' => [str_repeat('<br>', 100001)],
            'nesting deep enough to crash when freed' => [str_repeat('<div>', 99000)],
            'tables nested in cells' => [str_repeat('<table><td>', 49000)],
            'list items under deep inline elements' => [str_repeat('<span>', 510) . str_repeat('<li></li>', 99000)],
            'unknown end tags under deep nesting' => ['</x>' . str_repeat('<span>', 4000) . str_repeat('</zz>', 380000)],
            'paragraphs under deep nesting' => ['</x>' . str_repeat('<div>', 4000) . str_repeat('<p></p>', 95000)],
            'cells after foster-parented blocks' => ['</x>' . str_repeat('<table><div><td>', 1360)],
        ];
    }

    #[DataProvider('tooComplex')]
    public function testThrowsTooComplexQuickly(string $input): void
    {
        $started = hrtime(true);

        try {
            Sanitizer::sanitize($input);
            $this->fail('Expected SanitizeException');
        } catch (SanitizeException $error) {
            $this->assertSame(SanitizeException::TOO_COMPLEX, $error->reason);
        }
        $this->assertLessThan(2000, (hrtime(true) - $started) / 1e6);
    }

    public function testAcceptsExactlyMaxTagsOpeningTags(): void
    {
        $input = str_repeat('<p>a</p>', 10);

        $clean = Sanitizer::sanitize($input, ['maxTags' => 10]);

        $this->assertSame($input, $clean);
    }

    public function testKeepsWellNestedDocumentsWithMarkupInsideAttributes(): void
    {
        $input = '<p><img src="https://images.example.com/a.png" alt="<svg> <math> <style> <!--">'
            . str_repeat('<strong>kalın</strong> <em>italik</em> ', 400) . '</p>'
            . str_repeat('<ul><li><p>madde <a href="https://example.com">bağlantı</a></p></li></ul>', 300)
            . '<table><tbody><tr><td><p>a</p></td><td><p><strong>b</strong></p></td></tr></tbody></table>';

        $clean = Sanitizer::sanitize($input);

        $this->assertStringContainsString('<strong>kalın</strong>', $clean);
        $this->assertSame(300, substr_count($clean, '<ul>'));
    }

    public function testCleansLooselyNestedOldHtmlWithoutRefusingIt(): void
    {
        $input = str_repeat('<p>bir <b>kalın</b><p>iki<li>madde', 200) . '<table><tr><td>a<td>b</table>';

        $clean = Sanitizer::sanitize($input);

        $this->assertSame(200, substr_count($clean, '<p>bir kalın</p>'));
    }

    public function testAcceptsATagWithExactly64Attributes(): void
    {
        $clean = Sanitizer::sanitize('<p' . str_repeat(' a=1', 64) . '>x</p>');

        $this->assertSame('<p>x</p>', $clean);
    }

    public function testCleansManySiblingParagraphsInLinearTime(): void
    {
        $input = str_repeat('<p>Merhaba <strong>dünya</strong></p>', 30000);
        $started = hrtime(true);

        $clean = Sanitizer::sanitize($input);

        $this->assertSame($input, $clean);
        $this->assertLessThan(3000, (hrtime(true) - $started) / 1e6);
    }

    public static function unstable(): array
    {
        return [
            'heading inside superscript' => ['<h6><sup><h2>x', '<h6><sup><h2>x</h2></sup></h6>'],
            'heading inside heading' => ['<h6><font><h2>x', '<h6></h6><h2>x</h2>'],
            'paragraph inside paragraph' => ['<p><applet><p>x</p></applet></p>', '<p></p><p>x</p><p></p>'],
        ];
    }

    #[DataProvider('unstable')]
    public function testReturnsMarkupThatStaysTheSameWhenSanitizedAgain(string $input, string $expected): void
    {
        $clean = Sanitizer::sanitize($input);

        $this->assertSame($expected, $clean);
        $this->assertSame($clean, Sanitizer::sanitize($clean));
    }

    public function testReplacesInvalidUtf8AndNul(): void
    {
        $clean = Sanitizer::sanitize("<p>a\xffb\0c</p>");

        $this->assertSame("<p>a\u{FFFD}bc</p>", $clean);
    }
}
