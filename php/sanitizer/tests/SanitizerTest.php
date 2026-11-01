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
        return [
            'one tag with many attributes' => ['<p' . str_repeat(' a=1', 65) . '>x</p>'],
            'attributes hidden behind a quoted >' => ['<p a=">"' . str_repeat(' b', 70) . '>x</p>'],
            'deep nesting' => [str_repeat('<div>', 600)],
            'nested unknown end tags' => [str_repeat('<span>', 20000) . str_repeat('</y>', 20000)],
            'formatting rebuilt in every paragraph' => [$paragraphs],
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
            'heading inside heading' => ['<h6><sup><h2>x', '<h6></h6><h2>x</h2>'],
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
