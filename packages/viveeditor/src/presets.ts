import type { Extension } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { CodeBlock } from '@viveeditor/ext-code-block'
import { Embed } from '@viveeditor/ext-embed'
import { formatExtensions } from '@viveeditor/ext-format'
import { Image } from '@viveeditor/ext-image'
import { listExtensions } from '@viveeditor/ext-list'
import { OfficePaste } from '@viveeditor/ext-office-paste'
import { Search } from '@viveeditor/ext-search'
import { Table } from '@viveeditor/ext-table'
import { TaskItem, TaskList } from '@viveeditor/ext-task-list'
import { type MarkdownConverter, MarkdownPaste } from '@viveeditor/markdown/paste'
import { type Locale, resolveLocale } from '@viveeditor/ui'

interface PresetLabels {
  checkbox: string
  language: string
  plainText: string
  uploading: string
  failed: string
  missingAlt: string
  play: string
  invalid: string
}

const LABELS: Record<Locale, PresetLabels> = {
  tr: {
    checkbox: 'Tamamlandı',
    language: 'Dil',
    plainText: 'Düz metin',
    uploading: 'Yükleniyor',
    failed: 'Görsel eklenemedi',
    missingAlt: 'Alt metin yok',
    play: 'Oynat',
    invalid: 'Bu içerik desteklenmiyor',
  },
  en: {
    checkbox: 'Done',
    language: 'Language',
    plainText: 'Plain text',
    uploading: 'Uploading',
    failed: 'Image could not be added',
    missingAlt: 'No alt text',
    play: 'Play',
    invalid: 'This embed is not supported',
  },
}

export interface ClassicPresetOptions {
  markdown?: () => Promise<MarkdownConverter>
}

export function classicPreset(
  locale?: string,
  options: ClassicPresetOptions = {},
): readonly Extension[] {
  const labels = LABELS[resolveLocale(locale)]
  const extensions: Extension[] = [
    ...basicExtensions,
    ...listExtensions,
    ...formatExtensions,
    TaskItem.configure({ checkboxLabel: labels.checkbox }),
    TaskList,
    CodeBlock.configure({ languageLabel: labels.language, plainTextLabel: labels.plainText }),
    Table,
    Search,
    Image.configure({
      labels: {
        uploading: labels.uploading,
        failed: labels.failed,
        missingAlt: labels.missingAlt,
      },
    }),
    Embed.configure({ labels: { play: labels.play, invalid: labels.invalid } }),
    OfficePaste,
  ]
  if (options.markdown) extensions.push(MarkdownPaste.configure({ load: options.markdown }))
  return extensions
}

export const classicExtensions: readonly Extension[] = classicPreset('en')
