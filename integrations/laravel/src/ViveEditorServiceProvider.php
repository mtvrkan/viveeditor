<?php

declare(strict_types=1);

namespace Viveeditor\Laravel;

use Illuminate\Support\Facades\Blade;
use Illuminate\Support\ServiceProvider;

final class ViveEditorServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->mergeConfigFrom(__DIR__ . '/../config/viveeditor.php', 'viveeditor');
        $this->app->singleton(ViveEditor::class, fn ($app) => new ViveEditor($app['config']->get('viveeditor', [])));
    }

    public function boot(): void
    {
        $this->loadViewsFrom(__DIR__ . '/../resources/views', 'viveeditor');
        Blade::directive('viveeditorScripts', fn (): string => '<?php echo app(\\' . ViveEditor::class . '::class)->scripts(); ?>');
        Blade::directive(
            'viveHtml',
            fn (string $expression): string => '<?php echo app(\\' . ViveEditor::class . '::class)->sanitize(' . $expression . '); ?>',
        );

        if ($this->app->runningInConsole()) {
            $this->publishes([__DIR__ . '/../config/viveeditor.php' => config_path('viveeditor.php')], 'viveeditor-config');
            $this->publishes([__DIR__ . '/../resources/dist' => public_path('vendor/viveeditor')], ['viveeditor-assets', 'laravel-assets']);
        }
    }
}
