import type { JSONContent } from '@viveeditor/core'
import { h, placeAtRect } from '../dom.js'
import type { Locale } from '../messages.js'
import type { UiPlugin, UiPluginHost } from '../plugins.js'
import { type ExtrasMessages, extrasMessages } from './messages.js'
import { cleanGeneratedText } from './text.js'

export type AiAction =
  | 'improve'
  | 'fix'
  | 'shorten'
  | 'expand'
  | 'tone'
  | 'translate'
  | 'summarize'
  | 'continue'
  | 'custom'

export interface AiRequest {
  action: AiAction
  instruction?: string
  text: string
  context: { before: string; after: string }
  locale: Locale
  signal: AbortSignal
}

export interface AiProvider {
  generate(request: AiRequest): AsyncIterable<string> | Promise<string>
}

export type MarkdownRenderer = (markdown: string) => string

export interface AiAssistantOptions {
  provider: AiProvider
  actions?: readonly Exclude<AiAction, 'custom'>[]
  markdown?: () => Promise<MarkdownRenderer>
  links?: boolean
  messages?: Partial<ExtrasMessages>
}

const ACTIONS: readonly Exclude<AiAction, 'custom'>[] = [
  'improve',
  'fix',
  'shorten',
  'expand',
  'tone',
  'translate',
  'summarize',
  'continue',
]
const ACTION_LABEL = {
  improve: 'aiImprove',
  fix: 'aiFix',
  shorten: 'aiShorten',
  expand: 'aiExpand',
  tone: 'aiTone',
  translate: 'aiTranslate',
  summarize: 'aiSummarize',
  continue: 'aiContinue',
} as const
const MAX_SELECTION = 20_000
const MAX_CONTEXT = 2000
const MAX_OUTPUT = 20_000
const MAX_INSTRUCTION = 1000
const TIME_LIMIT = 120_000
const STRIPPED =
  'img, picture, source, video, audio, iframe, object, embed, svg, math, script, style'

interface Target {
  from: number
  to: number
  text: string
}

const paragraphs = (text: string): JSONContent => ({
  type: 'doc',
  content: text
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean)
    .map((block) => ({ type: 'paragraph', content: [{ type: 'text', text: block }] })),
})

function abortion(signal: AbortSignal): Promise<never> {
  const stopped = new Promise<never>((_, reject) => {
    if (signal.aborted) reject(signal.reason)
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
  stopped.catch(() => undefined)
  return stopped
}

function inertHtml(html: string, links: boolean): string {
  const page = document.implementation.createHTMLDocument('')
  page.body.innerHTML = html
  for (const element of page.body.querySelectorAll(STRIPPED)) element.remove()
  if (!links) {
    for (const link of page.body.querySelectorAll('a')) link.replaceWith(...link.childNodes)
  }
  return page.body.innerHTML
}

function readContext(host: UiPluginHost, target: Target): AiRequest['context'] {
  const read = (from: number, to: number): string =>
    String(host.commands.query('textBetween', from, to) ?? '')
  return {
    before: read(0, target.from).slice(-MAX_CONTEXT),
    after: read(target.to, Number.MAX_SAFE_INTEGER).slice(0, MAX_CONTEXT),
  }
}

export function aiAssistant(options: AiAssistantOptions): UiPlugin {
  return (host) => {
    const { editor, commands } = host
    const messages = extrasMessages(host.locale, options.messages)
    const actions = (options.actions ?? ACTIONS).filter((action) => ACTIONS.includes(action))
    const status = h('p', { class: 've-hint', role: 'status' })
    const preview = h('div', { class: 've-ai-preview', 'aria-live': 'polite', tabindex: '0' })
    const instruction = h('input', {
      class: 've-input',
      type: 'text',
      maxlength: String(MAX_INSTRUCTION),
      'aria-label': messages.aiInstruction,
      placeholder: messages.aiInstruction,
    })
    const button = (label: string, className = 've-btn'): HTMLButtonElement =>
      h('button', { type: 'button', class: className }, [label])
    const send = button(messages.aiSend, 've-primary')
    const stop = button(messages.aiStop)
    const replace = button(messages.aiReplace, 've-primary')
    const insert = button(messages.aiInsert)
    const retry = button(messages.aiRetry)
    const discard = button(messages.aiDiscard)
    const actionButtons = actions.map((action) => {
      const element = button(messages[ACTION_LABEL[action]], 've-item')
      element.addEventListener('click', () => start(action))
      return element
    })
    const actionList = h('div', { class: 've-ai-actions', role: 'group' }, actionButtons)
    const result = h('div', { class: 've-ai-result', hidden: '' }, [
      preview,
      h('div', { class: 've-field-row' }, [replace, insert, retry, discard, stop]),
    ])
    const element = h(
      'div',
      {
        class: 've-panel ve-ai ve-glass ve-solid',
        role: 'dialog',
        'aria-label': messages.aiTitle,
        hidden: '',
      },
      [
        h('div', { class: 've-eyebrow' }, [messages.aiTitle]),
        actionList,
        h('div', { class: 've-field-row' }, [instruction, send]),
        result,
        status,
      ],
    )
    host.root.append(element)

    let target: Target = { from: 0, to: 0, text: '' }
    let output = ''
    let sequence = 0
    let controller: AbortController | null = null
    let last: { action: AiAction; instruction?: string | undefined } | null = null

    const isOpen = (): boolean => !element.hidden

    const say = (text: string): void => {
      status.textContent = text
    }

    const stale = (): boolean => {
      const selection = editor.getSelection()
      return (
        selection.from !== target.from ||
        selection.to !== target.to ||
        commands.query('selectedText') !== target.text
      )
    }

    const refreshButtons = (working: boolean): void => {
      stop.hidden = !working
      for (const control of [replace, insert, retry]) control.disabled = working || output === ''
      replace.disabled ||= target.text === '' || stale()
      retry.disabled = working || last === null
      send.disabled = working
      for (const control of actionButtons) control.disabled = working
    }

    const cancel = (): void => {
      sequence++
      controller?.abort()
      controller = null
    }

    const close = (refocus = true): void => {
      cancel()
      if (!isOpen()) return
      element.hidden = true
      if (refocus) editor.focus()
    }

    const append = (chunk: string): boolean => {
      output = (output + cleanGeneratedText(chunk.slice(0, MAX_OUTPUT - output.length))).slice(
        0,
        MAX_OUTPUT,
      )
      preview.textContent = output
      return output.length < MAX_OUTPUT
    }

    async function consume(id: number, request: AiRequest): Promise<void> {
      const stopped = abortion(request.signal)
      const response = options.provider.generate(request)
      if (typeof (response as AsyncIterable<string>)[Symbol.asyncIterator] !== 'function') {
        const text = await Promise.race([response as Promise<string>, stopped])
        if (id !== sequence) return
        if (typeof text !== 'string') throw new TypeError('AI provider returned a non-string.')
        append(text)
        return
      }
      const iterator = (response as AsyncIterable<string>)[Symbol.asyncIterator]()
      try {
        for (;;) {
          const step = await Promise.race([iterator.next(), stopped])
          if (id !== sequence || step.done) return
          if (typeof step.value !== 'string') throw new TypeError('AI provider sent a non-string.')
          if (!append(step.value)) return
        }
      } finally {
        await Promise.race([Promise.resolve(iterator.return?.()), stopped]).catch(() => undefined)
      }
    }

    async function start(action: AiAction, text?: string): Promise<void> {
      if (!editor.isEditable) return
      if (action !== 'continue' && action !== 'custom' && target.text === '') {
        say(messages.aiEmptySelection)
        return
      }
      cancel()
      const id = sequence
      const request = new AbortController()
      controller = request
      last = { action, instruction: text }
      output = ''
      preview.textContent = ''
      result.hidden = false
      refreshButtons(true)
      say(messages.aiWorking)
      const timer = window.setTimeout(() => request.abort(), TIME_LIMIT)
      try {
        await consume(id, {
          action,
          ...(text ? { instruction: text.slice(0, MAX_INSTRUCTION) } : {}),
          text: target.text,
          context: readContext(host, target),
          locale: host.locale,
          signal: request.signal,
        })
        if (id !== sequence) return
        say(output === '' ? messages.aiFailed : messages.aiDone)
      } catch (error) {
        if (id !== sequence) return
        host.report(error)
        say(messages.aiFailed)
      } finally {
        window.clearTimeout(timer)
        if (id === sequence) {
          controller = null
          refreshButtons(false)
        }
      }
    }

    async function content(): Promise<JSONContent | string | null> {
      if (!options.markdown) return paragraphs(output)
      try {
        const render = await options.markdown()
        return inertHtml(render(output), options.links === true)
      } catch (error) {
        host.report(error)
        return paragraphs(output)
      }
    }

    async function apply(mode: 'replace' | 'insert'): Promise<void> {
      if (!editor.isEditable || output === '') return
      if (mode === 'replace' && stale()) {
        say(messages.aiChanged)
        refreshButtons(false)
        return
      }
      const value = await content()
      if (value === null || !editor.isEditable) return
      if (mode === 'insert') commands.run('setTextSelection', target.to)
      const single = typeof value !== 'string' && value.content?.length === 1 && mode === 'replace'
      const text = single ? (value.content?.[0]?.content?.[0]?.text ?? '') : ''
      const done = single ? commands.run('insertText', text) : commands.run('insertContent', value)
      if (done) close()
    }

    const open = (): void => {
      if (!editor.isEditable) return
      const selection = editor.getSelection()
      const text = String(commands.query('selectedText') ?? '')
      host.closeFloating()
      target = { from: selection.from, to: selection.to, text }
      output = ''
      last = null
      preview.textContent = ''
      result.hidden = true
      instruction.value = ''
      element.hidden = false
      if (text.length > MAX_SELECTION) {
        target = { ...target, text: '' }
        say(messages.aiTooLong)
      } else {
        say('')
      }
      refreshButtons(false)
      const rect = editor.getSelectionRect()
      if (rect) placeAtRect(element, rect, host.root, 'below')
      ;(actionButtons.find((control) => !control.disabled) ?? instruction).focus()
    }

    send.addEventListener('click', () => {
      const text = instruction.value.trim()
      if (text) start('custom', text)
    })
    instruction.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        send.click()
      }
    })
    stop.addEventListener('click', () => {
      cancel()
      refreshButtons(false)
      say(messages.aiDone)
    })
    retry.addEventListener('click', () => {
      if (last) start(last.action, last.instruction)
    })
    replace.addEventListener('click', () => apply('replace'))
    insert.addEventListener('click', () => apply('insert'))
    discard.addEventListener('click', () => close())
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    })

    const trigger = h(
      'button',
      {
        type: 'button',
        class: 've-btn',
        'data-tool': 'ai',
        'aria-label': messages.ai,
        title: messages.ai,
      },
      [h('b', { class: 've-glyph' }, ['AI'])],
    )
    trigger.addEventListener('mousedown', (event) => event.preventDefault())
    trigger.addEventListener('click', open)

    return {
      bubble: [trigger],
      slash: [
        {
          id: 'ai',
          label: messages.ai,
          keywords: 'ai yz yapay zeka assistant asistan',
          icon: h('b', { class: 've-glyph' }, ['AI']),
          run: open,
        },
      ],
      handleKey: (event) => {
        if (event.key.toLowerCase() !== 'j' || !(event.metaKey || event.ctrlKey) || event.altKey) {
          return false
        }
        open()
        return true
      },
      update: () => {
        if (isOpen() && controller === null) refreshButtons(false)
      },
      isOpen,
      destroy: () => {
        close(false)
        element.remove()
      },
    }
  }
}
