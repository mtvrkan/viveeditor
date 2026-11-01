import { Editor } from '@viveeditor/core'
import { exportDocx } from '@viveeditor/docx'
import { toMarkdown } from '@viveeditor/markdown'
import { createUI } from '@viveeditor/ui'
import { classicPreset } from 'viveeditor'
import 'viveeditor/style.css'
import './ui-page.css'

interface PerfWindow {
  perfContent?: string
}

const host = document.querySelector<HTMLElement>('#article')
if (!host) throw new Error('Playground markup is incomplete.')

const nextPaint = (): Promise<number> =>
  new Promise((resolve) =>
    requestAnimationFrame(() => setTimeout(() => resolve(performance.now()), 0)),
  )

const timed = async (task: () => unknown): Promise<number> => {
  const started = performance.now()
  await task()
  return (await nextPaint()) - started
}

const content = (window as PerfWindow).perfContent ?? ''
const started = performance.now()
const editor = await Editor.create(host, {
  extensions: classicPreset('tr'),
  label: 'Makale metni',
  content,
})
const ui = createUI(editor, { locale: 'tr' })
const loadMs = (await nextPaint()) - started

const paste = (html: string): Promise<number> =>
  timed(() => {
    const transfer = new DataTransfer()
    transfer.setData('text/html', html)
    transfer.setData('text/plain', 'yedek')
    editor.dom.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }),
    )
  })

const documentSize = (): number => {
  editor.commands.selectAll()
  return editor.getSelection().to
}

const refreshTimes = (samples: number): number[] => {
  const size = documentSize()
  return Array.from({ length: samples }, (_, index) => {
    editor.commands.setTextSelection(Math.max(1, Math.floor((size * index) / samples)))
    const begin = performance.now()
    ui.refresh()
    return performance.now() - begin
  })
}

Object.assign(window, {
  viveEditor: editor,
  perf: {
    loadMs,
    documentSize,
    paste,
    refreshTimes,
    markdownMs: () => timed(() => toMarkdown(editor)),
    docxMs: () => timed(() => exportDocx(editor)),
  },
})
document.body.dataset.ready = 'true'
