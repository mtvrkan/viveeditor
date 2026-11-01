<?php
$shapes = [
  'attrs' => fn($n) => '<p' . implode('', array_map(fn($i) => ' a' . base_convert((string)$i, 10, 36) . '=1', range(1, $n))) . '>x</p>',
  'divEndUnknown' => fn($n) => str_repeat('<div>', $n) . str_repeat('</y>', $n),
  'distinctB' => fn($n) => implode('', array_map(fn($i) => "<b c=$i>x", range(1, $n))),
  'pDistinct' => fn($n) => implode('', array_map(fn($i) => "<p><b c=$i>x</p>", range(1, $n))),
  'liNest' => fn($n) => str_repeat('<ul>', $n) . str_repeat('<li>', $n),
  'aNest' => fn($n) => str_repeat('<a>x', $n),
];
$doc = Dom\HTMLDocument::createEmpty();
foreach ($shapes as $name => $make) {
  $out = [];
  foreach ([5000, 20000] as $n) {
    $s = $make($n);
    $t = hrtime(true);
    $body = $doc->createElement('body');
    try { $body->innerHTML = $s; } catch (Throwable $e) { $out[] = "$n: ERR " . $e->getMessage(); continue; }
    $out[] = sprintf('%d: %dms mem %dMB', $n, (hrtime(true) - $t) / 1e6, memory_get_peak_usage(true) / 1048576);
  }
  echo str_pad($name, 14), implode('  |  ', $out), "\n";
}
