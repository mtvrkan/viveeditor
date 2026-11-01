<?php

declare(strict_types=1);

namespace Viveeditor\Laravel\Tests;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Blade;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Viveeditor\Laravel\Casts\ViveHtml;
use Viveeditor\Laravel\Facades\ViveEditor;
use Viveeditor\Laravel\ViveEditorServiceProvider;
use Viveeditor\Sanitizer\SanitizeException;

final class Article extends Model
{
    protected $guarded = [];

    protected function casts(): array
    {
        return ['body' => ViveHtml::class];
    }
}

final class ViveEditorTest extends TestCase
{
    public function testEditorComponentRendersAnEscapedTextarea(): void
    {
        $html = Blade::render(
            '<x-viveeditor::editor name="body" :value="$value" label="Makale" required id="body" />',
            ['value' => '</textarea><script>alert(1)</script>'],
        );

        $this->assertStringContainsString('name="body"', $html);
        $this->assertStringContainsString('data-editor', $html);
        $this->assertStringContainsString('aria-label="Makale"', $html);
        $this->assertStringContainsString('required="required"', $html);
        $this->assertStringContainsString('&lt;/textarea&gt;&lt;script&gt;', $html);
        $this->assertStringNotContainsString('<script>', $html);
    }

    public function testEditorComponentKeepsEntitiesAsText(): void
    {
        $html = Blade::render('<x-viveeditor::editor name="body" :value="$value" />', ['value' => '<p>a &amp; b</p>']);

        $this->assertStringContainsString('&lt;p&gt;a &amp;amp; b&lt;/p&gt;</textarea>', $html);
    }

    public function testScriptsDirectivePointsAtThePublishedAssets(): void
    {
        $html = Blade::render('@viveeditorScripts');

        $this->assertStringContainsString('href="http://localhost/vendor/viveeditor/viveeditor.css"', $html);
        $this->assertStringContainsString('<script src="http://localhost/vendor/viveeditor/viveeditor.classic.iife.js" defer></script>', $html);
    }

    public function testScriptsDirectiveCopiesTheCspNonce(): void
    {
        Vite::useCspNonce('n0nce"x');

        $html = Blade::render('@viveeditorScripts');

        $this->assertSame(2, substr_count($html, 'nonce="n0nce&quot;x"'));
    }

    public function testViveHtmlDirectiveCleansOnOutput(): void
    {
        $html = Blade::render('<div>@viveHtml($body)</div>', ['body' => '<p onclick="x()">Merhaba</p><script>alert(1)</script>']);

        $this->assertSame('<div><p>Merhaba</p></div>', $html);
    }

    public function testViveHtmlDirectiveTreatsNullAsEmpty(): void
    {
        $html = Blade::render('<div>@viveHtml($body)</div>', ['body' => null]);

        $this->assertSame('<div></div>', $html);
    }

    public function testCastCleansOnSave(): void
    {
        $article = new Article();

        $article->body = '<p>Metin <a href="javascript:alert(1)">bağlantı</a></p><img src="x" onerror="alert(1)">';

        $this->assertSame('<p>Metin <a rel="noopener noreferrer nofollow">bağlantı</a></p>', $article->getAttributes()['body']);
        $this->assertSame($article->getAttributes()['body'], $article->body);
    }

    public function testCastCleansOnReadForRowsSavedWithoutIt(): void
    {
        $article = (new Article())->setRawAttributes(['body' => '<p onclick="alert(1)">Eski</p><script>alert(1)</script>']);

        $body = $article->body;

        $this->assertSame('<p>Eski</p>', $body);
    }

    public function testCastReadsHtmlItCannotCleanAsEmpty(): void
    {
        $article = (new Article())->setRawAttributes(['body' => '<p' . str_repeat(' a=1', 65) . '>x</p>']);

        $body = $article->body;

        $this->assertSame('', $body);
    }

    public function testCastKeepsNull(): void
    {
        $article = new Article();

        $article->body = null;

        $this->assertNull($article->getAttributes()['body']);
    }

    public function testFacadeUsesConfiguredOptionsAndPerCallOverrides(): void
    {
        $embed = '<div class="vive-embed" data-embed="youtube" data-id="dQw4w9WgXcQ"></div>';

        config()->set('viveeditor.sanitize.embeds', true);

        $with = ViveEditor::sanitize($embed);
        $without = ViveEditor::sanitize($embed, ['embeds' => false]);

        $this->assertSame('', $without);
        $this->assertStringContainsString('src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"', $with);
    }

    public function testFacadeThrowsWhenTheHtmlIsTooLarge(): void
    {
        $this->expectException(SanitizeException::class);

        ViveEditor::sanitize(str_repeat('a', 100), ['maxBytes' => 10]);
    }

    public function testConfigAndAssetsArePublishable(): void
    {
        $config = ServiceProvider::pathsToPublish(ViveEditorServiceProvider::class, 'viveeditor-config');

        $assets = ServiceProvider::pathsToPublish(ViveEditorServiceProvider::class, 'viveeditor-assets');

        $this->assertSame([config_path('viveeditor.php')], array_values($config));
        $this->assertFileExists(array_key_first($config));
        $this->assertSame([public_path('vendor/viveeditor')], array_values($assets));
    }
}
