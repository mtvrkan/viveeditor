import { defineExtension, type Extension } from '@viveeditor/core'
import { Plugin } from 'prosemirror-state'
import { cleanOffice, type OfficeSource } from './clean.js'

export {
  cleanOffice,
  cleanOfficeHtml,
  detectOffice,
  type OfficeCleanResult,
  type OfficeSource,
} from './clean.js'

export interface OfficeDropInfo {
  source: OfficeSource
  images: number
}

export interface OfficePasteOptions {
  onDropped: ((info: OfficeDropInfo) => void) | null
}

export const OfficePaste: Extension<OfficePasteOptions> = defineExtension<OfficePasteOptions>({
  name: 'officePaste',
  defaultOptions: { onDropped: null },
  plugins: ({ options }) => [
    new Plugin({
      props: {
        transformPastedHTML: (html) => {
          const result = cleanOffice(html)
          if (result.source && result.droppedImages > 0) {
            options.onDropped?.({ source: result.source, images: result.droppedImages })
          }
          return result.html
        },
      },
    }),
  ],
})
