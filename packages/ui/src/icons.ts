const DOT = (x: number, y: number): string => `M${x} ${y - 1}a1 1 0 1 1 0 2a1 1 0 1 1 0-2`

export type IconName =
  | 'strike'
  | 'code'
  | 'bulletList'
  | 'orderedList'
  | 'blockquote'
  | 'link'
  | 'undo'
  | 'redo'
  | 'more'
  | 'paragraph'
  | 'heading'
  | 'horizontalRule'
  | 'chevron'
  | 'check'
  | 'alert'
  | 'video'
  | 'unlink'
  | 'alignLeft'
  | 'alignCenter'
  | 'alignRight'
  | 'alignJustify'
  | 'textColor'
  | 'highlight'
  | 'clear'
  | 'taskList'
  | 'codeBlock'
  | 'table'
  | 'search'
  | 'arrowUp'
  | 'arrowDown'
  | 'image'
  | 'upload'
  | 'source'
  | 'file'
  | 'folder'
  | 'download'
  | 'print'

const PATHS: Record<IconName, string> = {
  strike:
    'M16 6.5C15.4 5 13.9 4 12 4c-2.2 0-4 1.3-4 3.2 0 1.3.8 2.2 2.2 2.8M4 12h16M8 17.3c.7 1.6 2.2 2.7 4.2 2.7 2.3 0 4-1.4 4-3.3 0-.7-.2-1.3-.6-1.7',
  code: 'm16 18 6-6-6-6M8 6l-6 6 6 6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14M20 20l-4-4',
  arrowUp: 'M12 19V5M6 11l6-6 6 6',
  image:
    'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1M4 16l4.5-4.5a1.5 1.5 0 0 1 2.1 0L16 17M14 14.5l1.5-1.5a1.5 1.5 0 0 1 2.1 0L20 15.5M15.5 7.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2',
  video:
    'M4 6h11a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1M16 10.5l5-3v9l-5-3',
  source:
    'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M10 12l-2 2 2 2M14 12l2 2-2 2',
  file: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6',
  folder: 'M3 7V5a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 10h18',
  download: 'M12 4v12M7 11l5 5 5-5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
  print:
    'M7 9V3h10v6M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v7H7z',
  upload: 'M12 16V4M7 9l5-5 5 5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
  arrowDown: 'M12 5v14M18 13l-6 6-6-6',
  table:
    'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1M4 9.5h16M4 14.5h16M10 9.5V20',
  codeBlock:
    'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1M10 9.5 7.5 12l2.5 2.5M14 9.5l2.5 2.5-2.5 2.5',
  bulletList: `M9 7h11M9 12h11M9 17h11${DOT(5, 7)}${DOT(5, 12)}${DOT(5, 17)}`,
  orderedList: 'M10 7h10M10 12h10M10 17h10M4 5h1v4M4 9h2M4 14.5c0-1 2-1 2 0s-2 1.5-2 2.5h2',
  blockquote:
    'M7 8H5a1 1 0 0 0-1 1v3h4V9a1 1 0 0 0-1-1zM8 12c0 3-1 4-4 5M17 8h-2a1 1 0 0 0-1 1v3h4V9a1 1 0 0 0-1-1zM18 12c0 3-1 4-4 5',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  undo: 'M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'm15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  more: `${DOT(5, 12)}${DOT(12, 12)}${DOT(19, 12)}`,
  paragraph: 'M13 4v16M17 4v16M19 4H9.5a4.5 4.5 0 0 0 0 9H13',
  heading: 'M5 5v14M15 5v14M5 12h10M19 19v-6l-2 1',
  horizontalRule: 'M4 12h16',
  chevron: 'm6 9 6 6 6-6',
  check: 'm5 12 5 5 9-10',
  alert:
    'M12 9v4M12 17h.01M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  unlink:
    'M18.84 12.25 20 11.1a4 4 0 0 0-5.66-5.66l-1.15 1.15M5.16 11.75 4 12.9a4 4 0 0 0 5.66 5.66l1.15-1.15M8 2v3M2 8h3M16 22v-3M22 16h-3',
  alignLeft: 'M4 6h16M4 10h10M4 14h16M4 18h10',
  alignCenter: 'M4 6h16M7 10h10M4 14h16M7 18h10',
  alignRight: 'M4 6h16M10 10h10M4 14h16M10 18h10',
  alignJustify: 'M4 6h16M4 10h16M4 14h16M4 18h16',
  textColor: 'm6.5 16 5.5-12 5.5 12M8.8 11h6.4',
  highlight: 'm9 11-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4',
  taskList: 'M12 7h8M12 12h8M12 17h8M3.5 6.5l1.5 1.5 3-3M3.5 16.5l1.5 1.5 3-3M4 11h3v3H4z',
  clear: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8',
}

const SVG = 'http://www.w3.org/2000/svg'

export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg')
  svg.setAttribute('class', 've-icon')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')
  const path = document.createElementNS(SVG, 'path')
  path.setAttribute('d', PATHS[name])
  svg.append(path)
  return svg
}
