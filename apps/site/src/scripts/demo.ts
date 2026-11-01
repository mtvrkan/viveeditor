import { CodeHighlight, shikiHighlighter } from '@viveeditor/ext-code-block/highlight'
import { Footnote } from '@viveeditor/ext-footnote'
import { MathExtension } from '@viveeditor/ext-math'
import { Mention } from '@viveeditor/ext-mention'
import type { FileImageUploader } from '@viveeditor/ui'
import {
  emojiMenu,
  footnoteTools,
  type MentionItem,
  mathTools,
  mentionMenu,
  templateMenu,
} from '@viveeditor/ui/extras'
import { classicPreset, createUI, Editor, type Extension, type ImageOptions } from 'viveeditor'
import 'viveeditor/style.css'
import '@viveeditor/ext-footnote/style.css'
import '@viveeditor/ext-math/style.css'
import '@viveeditor/ext-mention/style.css'
import 'katex/dist/katex.min.css'
import { loadShiki } from './shiki'
import { followSiteTheme, siteTheme } from './theme'

export type DemoConfig = {
  locale: string
  label: string
  fileName: string
  content: string
  people: MentionItem[]
  templates: Array<{ id: string; label: string; description: string; content: string }>
  showHtml: string
  hideHtml: string
}

const EXTRA_LABELS = {
  tr: {
    footnote: 'Dipnot',
    footnoteEdit: 'Dipnot metni',
    math: 'Formül',
    mathEdit: 'LaTeX formülü',
  },
  en: {
    footnote: 'Footnote',
    footnoteEdit: 'Footnote text',
    math: 'Formula',
    mathEdit: 'LaTeX formula',
  },
}

const readInBrowser: FileImageUploader = (file, { signal }) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    signal.addEventListener(
      'abort',
      () => {
        reader.abort()
        reject(signal.reason)
      },
      { once: true },
    )
    reader.readAsDataURL(file)
  })

function extensions(config: DemoConfig): Extension[] {
  const labels = config.locale === 'tr' ? EXTRA_LABELS.tr : EXTRA_LABELS.en
  const preset = classicPreset(config.locale).map((extension) =>
    extension.name === 'image'
      ? (extension as Extension<ImageOptions>).configure({
          upload: readInBrowser,
          allowBase64: true,
        })
      : extension,
  )
  return [
    ...preset,
    CodeHighlight.configure({ highlighter: shikiHighlighter(loadShiki) }),
    Mention,
    MathExtension.configure({
      load: () => import('katex'),
      labels: { empty: labels.math, edit: labels.mathEdit },
    }),
    Footnote.configure({ labels: { footnote: labels.footnote, edit: labels.footnoteEdit } }),
  ]
}

export async function mountDemo(
  root: HTMLElement,
  config: DemoConfig,
): Promise<{ destroy(): void }> {
  const host = root.querySelector<HTMLElement>('[data-demo-host]')
  const htmlButton = root.querySelector<HTMLButtonElement>('[data-demo-html]')
  const resetButton = root.querySelector<HTMLButtonElement>('[data-demo-reset]')
  const output = root.querySelector<HTMLElement>('[data-demo-output]')
  const panel = output?.parentElement
  if (!host || !htmlButton || !resetButton || !output || !panel) {
    throw new Error('Demo markup is incomplete.')
  }
  const fold = (value: string) => value.toLocaleLowerCase(config.locale)
  const editor = await Editor.create(host, {
    extensions: extensions(config),
    content: config.content,
    label: config.label,
  })
  const ui = createUI(editor, {
    locale: config.locale,
    theme: siteTheme(),
    files: {
      docx: () => import('@viveeditor/docx'),
      markdown: () => import('@viveeditor/markdown'),
      upload: readInBrowser,
      allowBase64: true,
      fileName: config.fileName,
    },
    plugins: [
      mentionMenu({
        items: (query) =>
          config.people.filter((person) => fold(person.label).includes(fold(query))),
      }),
      emojiMenu({ load: () => import('@viveeditor/emoji-data/en') }),
      templateMenu(config.templates),
      mathTools(),
      footnoteTools(),
    ],
  })
  const stopTheme = followSiteTheme(ui.root)
  const render = () => {
    if (!panel.hidden) output.textContent = editor.getHTML()
  }
  const toggleHtml = () => {
    panel.hidden = !panel.hidden
    htmlButton.setAttribute('aria-expanded', String(!panel.hidden))
    htmlButton.textContent = panel.hidden ? config.showHtml : config.hideHtml
    render()
  }
  const reset = () => {
    editor.setContent(config.content)
    render()
  }
  const stopChange = editor.on('change', render)
  htmlButton.addEventListener('click', toggleHtml)
  resetButton.addEventListener('click', reset)
  htmlButton.disabled = false
  resetButton.disabled = false
  return {
    destroy() {
      stopChange()
      stopTheme()
      htmlButton.removeEventListener('click', toggleHtml)
      resetButton.removeEventListener('click', reset)
      htmlButton.disabled = true
      resetButton.disabled = true
      editor.destroy()
    },
  }
}
