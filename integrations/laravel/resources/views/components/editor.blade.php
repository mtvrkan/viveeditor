@props(['name', 'value' => '', 'label' => null])
<textarea name="{{ $name }}" data-editor @if ($label !== null) aria-label="{{ $label }}" @endif {{ $attributes }}>{{ $value }}</textarea>
