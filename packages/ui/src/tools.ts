import type { IconName } from './icons.js'
import type { MessageKey } from './messages.js'

export { ariaShortcut, displayShortcut } from './shortcut.js'

export interface ToolSpec {
  id: string
  command: string
  args?: readonly unknown[]
  active?: string
  activeQuery?: string
  label: MessageKey
  glyph?: MessageKey
  glyphTag?: 'b' | 'i' | 'u'
  icon?: IconName
  shortcut?: string
  narrow: boolean
  collapse?: number
  popup?: 'menu' | 'dialog'
  enabledQuery?: string
}

export interface BlockSpec {
  id: string
  command: string
  args?: Record<string, unknown>
  active?: string
  activeAttrs?: Record<string, unknown>
  label: MessageKey
  labelValues?: Record<string, number>
  icon: IconName
  hint: string
  keywords: string
  menu: boolean
  slash: boolean
  panel?: boolean
}

export const TOOL_GROUPS: readonly (readonly ToolSpec[])[] = [
  [
    {
      id: 'fontFamily',
      command: 'unsetFontFamily',
      label: 'fontFamily',
      glyph: 'fontFamilyUnset',
      narrow: false,
      collapse: 5,
      popup: 'menu',
    },
    {
      id: 'fontSize',
      command: 'setFontSize',
      args: [12],
      label: 'fontSize',
      glyph: 'glyphFontSize',
      narrow: false,
      collapse: 6,
      popup: 'dialog',
    },
  ],
  [
    {
      id: 'bold',
      command: 'toggleBold',
      active: 'bold',
      label: 'bold',
      glyph: 'glyphBold',
      glyphTag: 'b',
      shortcut: 'Mod-B',
      narrow: true,
    },
    {
      id: 'italic',
      command: 'toggleItalic',
      active: 'italic',
      label: 'italic',
      glyph: 'glyphItalic',
      glyphTag: 'i',
      shortcut: 'Mod-I',
      narrow: true,
    },
    {
      id: 'underline',
      command: 'toggleUnderline',
      active: 'underline',
      label: 'underline',
      glyph: 'glyphUnderline',
      glyphTag: 'u',
      shortcut: 'Mod-U',
      narrow: false,
      collapse: 6,
    },
    {
      id: 'strike',
      command: 'toggleStrike',
      active: 'strike',
      label: 'strike',
      icon: 'strike',
      shortcut: 'Mod-Shift-S',
      narrow: false,
      collapse: 3,
    },
    {
      id: 'code',
      command: 'toggleCode',
      active: 'code',
      label: 'code',
      icon: 'code',
      shortcut: 'Mod-E',
      narrow: false,
      collapse: 2,
    },
    {
      id: 'clearFormatting',
      command: 'clearFormatting',
      label: 'clearFormatting',
      icon: 'clearFormatting',
      shortcut: 'Mod-\\',
      narrow: false,
      collapse: 1,
    },
    {
      id: 'formatPainter',
      command: 'copyFormat',
      activeQuery: 'isPaintingFormat',
      label: 'formatPainter',
      icon: 'formatPainter',
      narrow: false,
      collapse: 1,
    },
  ],
  [
    {
      id: 'textColor',
      command: 'setTextColor',
      args: ['#000000'],
      active: 'textColor',
      label: 'textColor',
      icon: 'textColor',
      narrow: false,
      collapse: 7,
      popup: 'dialog',
    },
    {
      id: 'highlight',
      command: 'setHighlight',
      active: 'highlight',
      label: 'highlight',
      icon: 'highlight',
      shortcut: 'Mod-Shift-H',
      narrow: false,
      collapse: 5,
      popup: 'dialog',
    },
    {
      id: 'textStyle',
      command: 'setFontSize',
      args: ['big'],
      label: 'textStyle',
      icon: 'textStyle',
      narrow: false,
      collapse: 3,
      popup: 'menu',
    },
  ],
  [
    {
      id: 'bulletList',
      command: 'toggleBulletList',
      active: 'bulletList',
      label: 'bulletList',
      icon: 'bulletList',
      shortcut: 'Mod-Shift-8',
      narrow: false,
      collapse: 9,
    },
    {
      id: 'orderedList',
      command: 'toggleOrderedList',
      active: 'orderedList',
      label: 'orderedList',
      icon: 'orderedList',
      shortcut: 'Mod-Shift-7',
      narrow: false,
      collapse: 8,
    },
    {
      id: 'listStyle',
      command: 'setListType',
      args: ['1'],
      label: 'listStyle',
      icon: 'listStyle',
      narrow: false,
      collapse: 3,
      popup: 'dialog',
      enabledQuery: 'listStyle',
    },
    {
      id: 'taskList',
      command: 'toggleTaskList',
      active: 'taskList',
      label: 'taskList',
      icon: 'taskList',
      shortcut: 'Mod-Shift-9',
      narrow: false,
      collapse: 4,
    },
    {
      id: 'blockquote',
      command: 'toggleBlockquote',
      active: 'blockquote',
      label: 'blockquote',
      icon: 'blockquote',
      shortcut: 'Mod-Shift-B',
      narrow: false,
      collapse: 4,
    },
    {
      id: 'table',
      command: 'insertTable',
      active: 'table',
      label: 'table',
      icon: 'table',
      narrow: false,
      collapse: 5,
      popup: 'dialog',
      enabledQuery: 'inTable',
    },
    {
      id: 'image',
      command: 'insertImage',
      args: [{ src: 'https://example.com/image.png' }],
      active: 'image',
      label: 'image',
      icon: 'image',
      narrow: false,
      collapse: 4,
      popup: 'dialog',
      enabledQuery: 'selectedImage',
    },
    {
      id: 'embed',
      command: 'insertEmbed',
      args: ['https://youtu.be/aaaaaaaaaaa'],
      active: 'embed',
      label: 'embed',
      icon: 'video',
      narrow: false,
      collapse: 4,
      popup: 'dialog',
      enabledQuery: 'selectedEmbed',
    },
    {
      id: 'specialCharacters',
      command: 'insertText',
      args: ['Ω'],
      label: 'specialCharacters',
      icon: 'specialCharacters',
      narrow: false,
      collapse: 1,
      popup: 'dialog',
    },
  ],
  [
    {
      id: 'align',
      command: 'setTextAlign',
      args: ['left'],
      label: 'align',
      icon: 'alignLeft',
      narrow: false,
      collapse: 6,
      popup: 'menu',
    },
    {
      id: 'lineHeight',
      command: 'setLineHeight',
      args: ['1.5'],
      label: 'lineHeight',
      icon: 'lineHeight',
      narrow: false,
      collapse: 3,
      popup: 'menu',
    },
  ],
  [
    {
      id: 'link',
      command: 'setLink',
      active: 'link',
      label: 'link',
      icon: 'link',
      shortcut: 'Mod-K',
      narrow: true,
      popup: 'dialog',
    },
    {
      id: 'search',
      command: 'setSearch',
      args: [{ query: '' }],
      label: 'search',
      icon: 'search',
      shortcut: 'Mod-F',
      narrow: false,
      collapse: 2,
      popup: 'dialog',
    },
  ],
  [
    {
      id: 'undo',
      command: 'undo',
      label: 'undo',
      icon: 'undo',
      shortcut: 'Mod-Z',
      narrow: false,
      collapse: 1,
    },
    {
      id: 'redo',
      command: 'redo',
      label: 'redo',
      icon: 'redo',
      shortcut: 'Mod-Shift-Z',
      narrow: false,
      collapse: 1,
    },
    {
      id: 'file',
      command: 'replaceContent',
      args: [''],
      label: 'file',
      icon: 'file',
      narrow: false,
      collapse: 1,
      popup: 'menu',
    },
    {
      id: 'source',
      command: 'replaceContent',
      args: [''],
      label: 'source',
      icon: 'source',
      narrow: false,
      collapse: 0,
    },
    {
      id: 'outline',
      command: 'selectAll',
      label: 'outline',
      icon: 'outline',
      narrow: false,
      collapse: 0,
      popup: 'dialog',
    },
    {
      id: 'accessibility',
      command: 'selectAll',
      label: 'accessibilityCheck',
      icon: 'accessibility',
      narrow: false,
      collapse: 0,
      popup: 'dialog',
    },
    {
      id: 'shortcuts',
      command: 'selectAll',
      label: 'shortcuts',
      icon: 'keyboard',
      shortcut: 'Alt-0',
      narrow: false,
      collapse: 0,
      popup: 'dialog',
    },
    {
      id: 'fullscreen',
      command: 'selectAll',
      label: 'fullscreen',
      icon: 'fullscreen',
      narrow: false,
      collapse: 1,
    },
  ],
]

const heading = (level: 1 | 2 | 3, hint: string): BlockSpec => ({
  id: `heading${level}`,
  command: 'toggleHeading',
  args: { level },
  active: 'heading',
  activeAttrs: { level },
  label: 'heading',
  labelValues: { level },
  icon: `heading${level}`,
  hint,
  keywords: `baslik heading h${level} title`,
  menu: true,
  slash: true,
})

export const BLOCKS: readonly BlockSpec[] = [
  {
    id: 'paragraph',
    command: 'setParagraph',
    label: 'paragraph',
    icon: 'paragraph',
    hint: '',
    keywords: 'paragraf paragraph metin text',
    menu: true,
    slash: false,
  },
  heading(1, '#'),
  heading(2, '##'),
  heading(3, '###'),
  {
    id: 'bulletList',
    command: 'toggleBulletList',
    active: 'bulletList',
    label: 'bulletList',
    icon: 'bulletList',
    hint: '-',
    keywords: 'madde liste bullet list ul',
    menu: true,
    slash: true,
  },
  {
    id: 'orderedList',
    command: 'toggleOrderedList',
    active: 'orderedList',
    label: 'orderedList',
    icon: 'orderedList',
    hint: '1.',
    keywords: 'numarali liste numbered ordered list ol',
    menu: true,
    slash: true,
  },
  {
    id: 'taskList',
    command: 'toggleTaskList',
    active: 'taskList',
    label: 'taskList',
    icon: 'taskList',
    hint: '[ ]',
    keywords: 'gorev yapilacak liste kontrol todo task checklist',
    menu: true,
    slash: true,
  },
  {
    id: 'blockquote',
    command: 'toggleBlockquote',
    active: 'blockquote',
    label: 'blockquote',
    icon: 'blockquote',
    hint: '>',
    keywords: 'alinti quote blockquote',
    menu: true,
    slash: true,
  },
  {
    id: 'codeBlock',
    command: 'toggleCodeBlock',
    active: 'codeBlock',
    label: 'codeBlock',
    icon: 'codeBlock',
    hint: '```',
    keywords: 'kod blogu code block pre snippet program',
    menu: true,
    slash: true,
  },
  {
    id: 'table',
    command: 'insertTable',
    args: { rows: 3, cols: 3, headerRow: true },
    label: 'table',
    icon: 'table',
    hint: '',
    keywords: 'tablo table izgara grid satir sutun row column',
    menu: false,
    slash: true,
  },
  {
    id: 'image',
    command: 'insertImage',
    label: 'image',
    icon: 'image',
    hint: '',
    keywords: 'gorsel resim foto fotograf image picture photo img',
    menu: false,
    slash: true,
    panel: true,
  },
  {
    id: 'embed',
    command: 'insertEmbed',
    label: 'embed',
    icon: 'video',
    hint: '',
    keywords: 'video youtube vimeo spotify muzik podcast embed medya media',
    menu: false,
    slash: true,
    panel: true,
  },
  {
    id: 'horizontalRule',
    command: 'setHorizontalRule',
    label: 'horizontalRule',
    icon: 'horizontalRule',
    hint: '---',
    keywords: 'yatay cizgi ayirici divider rule hr',
    menu: false,
    slash: true,
  },
]

const FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }

export function foldText(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, (letter) => FOLD[letter] ?? letter)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export interface ToolFilter {
  has(command: string): boolean
  source: boolean
  files: boolean
  exclude?: readonly string[]
}

export function availableTools(filter: ToolFilter): (readonly ToolSpec[])[] {
  return TOOL_GROUPS.map((group) =>
    group.filter(
      (tool) =>
        filter.has(tool.command) &&
        !filter.exclude?.includes(tool.id) &&
        (tool.id !== 'outline' || filter.has('toggleHeading')) &&
        (tool.id !== 'source' || filter.source) &&
        (tool.id !== 'file' || filter.files),
    ),
  )
}
