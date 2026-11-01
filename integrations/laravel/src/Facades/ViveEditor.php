<?php

declare(strict_types=1);

namespace Viveeditor\Laravel\Facades;

use Illuminate\Support\Facades\Facade;

final class ViveEditor extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return \Viveeditor\Laravel\ViveEditor::class;
    }
}
