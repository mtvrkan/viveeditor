<?php

declare(strict_types=1);

namespace Viveeditor\Laravel\Tests;

use Orchestra\Testbench\TestCase as Testbench;
use Viveeditor\Laravel\ViveEditorServiceProvider;

abstract class TestCase extends Testbench
{
    protected function getPackageProviders($app): array
    {
        return [ViveEditorServiceProvider::class];
    }
}
