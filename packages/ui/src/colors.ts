import type { Swatch } from './popover.js'

export const TEXT_COLORS: readonly Swatch[] = [
  { color: '#c62828', value: '#c62828', name: 'colorRed' },
  { color: '#b45309', value: '#b45309', name: 'colorOrange' },
  { color: '#2e7d32', value: '#2e7d32', name: 'colorGreen' },
  { color: '#00796b', value: '#00796b', name: 'colorTeal' },
  { color: '#1565c0', value: '#1565c0', name: 'colorBlue' },
  { color: '#6a1b9a', value: '#6a1b9a', name: 'colorPurple' },
  { color: '#ad1457', value: '#ad1457', name: 'colorPink' },
  { color: '#546e7a', value: '#546e7a', name: 'colorGray' },
]

export const HIGHLIGHT_DEFAULT = '#fff2a8'

export const HIGHLIGHT_COLORS: readonly Swatch[] = [
  { color: null, value: HIGHLIGHT_DEFAULT, name: 'colorYellow' },
  { color: '#c8f2c2', value: '#c8f2c2', name: 'colorGreen' },
  { color: '#cde8ff', value: '#cde8ff', name: 'colorBlue' },
  { color: '#ffd6e7', value: '#ffd6e7', name: 'colorPink' },
  { color: '#ffe0b2', value: '#ffe0b2', name: 'colorOrange' },
  { color: '#e6d9ff', value: '#e6d9ff', name: 'colorPurple' },
]
