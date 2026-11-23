const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)

export function displayShortcut(shortcut: string): string {
  const keys = shortcut.split('-')
  if (isApple) {
    return keys
      .map((key) => (key === 'Mod' ? '⌘' : key === 'Shift' ? '⇧' : key === 'Alt' ? '⌥' : key))
      .join('')
  }
  return keys.map((key) => (key === 'Mod' ? 'Ctrl' : key)).join('+')
}

export function ariaShortcut(shortcut: string): string {
  return shortcut
    .split('-')
    .map((key) => (key === 'Mod' ? (isApple ? 'Meta' : 'Control') : key))
    .join('+')
}
