import type { Editor, JSONContent } from '@viveeditor/core'
import { createLifecycle } from './lifecycle.js'

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export interface AutosaveOptions {
  key: string
  wait?: number
  storage?: 'local' | 'session' | false
  save?: (editor: Editor, context: { signal: AbortSignal }) => Promise<void> | void
  onError?: (error: unknown) => void
}

export interface AutosaveDraft {
  readonly savedAt: number
}

export interface Autosave {
  draft(): AutosaveDraft | null
  restore(): boolean
  discard(): void
  clear(): void
  status(): AutosaveStatus
  flush(): Promise<void>
  onChange(listener: () => void): () => void
  destroy(): void
}

interface StoredDraft {
  version: 1
  savedAt: number
  content: JSONContent
}

const PREFIX = 'viveeditor:draft:'
const MAX_KEY = 200
const MAX_DRAFT_LENGTH = 4_000_000
const DEFAULT_WAIT = 1000
const EMPTY_HTML = '<p></p>'

function storageOf(kind: AutosaveOptions['storage']): Storage | null {
  if (kind === false) return null
  try {
    return kind === 'session' ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

function readDraft(storage: Storage | null, key: string): StoredDraft | null {
  let raw: string | null = null
  try {
    raw = storage?.getItem(key) ?? null
  } catch {
    return null
  }
  if (!raw || raw.length > MAX_DRAFT_LENGTH) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { version, savedAt, content } = value as Partial<StoredDraft>
    if (version !== 1 || typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return null
    if (typeof content !== 'object' || content === null || Array.isArray(content)) return null
    return { version, savedAt, content }
  } catch {
    return null
  }
}

export function createAutosave(editor: Editor, options: AutosaveOptions): Autosave {
  const { key } = options
  if (typeof key !== 'string' || key === '' || key.length > MAX_KEY) {
    throw new TypeError('autosave.key must be a non-empty string of at most 200 characters.')
  }
  const storageKey = PREFIX + key
  const storage = storageOf(options.storage ?? 'local')
  const wait = Math.max(0, Number(options.wait ?? DEFAULT_WAIT) || 0)
  const report = options.onError ?? ((error: unknown) => console.error(error))
  const lifecycle = createLifecycle()
  const listeners = new Set<() => void>()
  let offered = readDraft(storage, storageKey)
  if (offered && JSON.stringify(offered.content) === JSON.stringify(editor.getJSON())) {
    offered = null
  }
  let current: AutosaveStatus = 'idle'
  let timer: ReturnType<typeof setTimeout> | null = null
  let dirty = false
  let running: Promise<void> | null = null
  let again = false
  let controller: AbortController | null = null
  let destroyed = false

  const notify = (): void => {
    for (const listener of listeners) listener()
  }
  const setStatus = (value: AutosaveStatus): void => {
    if (current === value) return
    current = value
    notify()
  }

  const remove = (): void => {
    try {
      storage?.removeItem(storageKey)
    } catch (error) {
      report(error)
    }
  }

  const writeLocal = (): void => {
    if (!storage || editor.isDestroyed) return
    if (editor.getHTML() === EMPTY_HTML) {
      remove()
      return
    }
    const stored: StoredDraft = { version: 1, savedAt: Date.now(), content: editor.getJSON() }
    const raw = JSON.stringify(stored)
    if (raw.length > MAX_DRAFT_LENGTH) return
    try {
      storage.setItem(storageKey, raw)
    } catch (error) {
      report(error)
    }
  }

  const runSave = (): Promise<void> => {
    const { save } = options
    if (!save) return Promise.resolve()
    if (running) {
      again = true
      return running
    }
    setStatus('saving')
    controller = new AbortController()
    const { signal } = controller
    running = Promise.resolve()
      .then(() => save(editor, { signal }))
      .then(
        () => {
          if (!destroyed) setStatus(again ? 'pending' : 'saved')
        },
        (error: unknown) => {
          if (signal.aborted) return
          setStatus('error')
          report(error)
        },
      )
      .finally(() => {
        running = null
        controller = null
        if (again && !destroyed) {
          again = false
          void runSave()
        }
      })
    return running
  }

  const commit = (): Promise<void> => {
    if (timer !== null) clearTimeout(timer)
    timer = null
    if (!dirty || editor.isDestroyed) return running ?? Promise.resolve()
    dirty = false
    writeLocal()
    if (!options.save) {
      setStatus('saved')
      return Promise.resolve()
    }
    return runSave()
  }

  const schedule = (): void => {
    dirty = true
    setStatus('pending')
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => void commit(), wait)
  }

  const flushLocal = (): void => {
    if (!dirty) return
    writeLocal()
  }

  const unsubscribe = editor.on('change', schedule)
  lifecycle.listen(window, 'pagehide', flushLocal)
  lifecycle.listen(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushLocal()
  })
  lifecycle.listen(window, 'beforeunload', (event) => {
    if (!options.save || (current !== 'pending' && current !== 'saving')) return
    event.preventDefault()
    ;(event as BeforeUnloadEvent).returnValue = ''
  })

  const discard = (): void => {
    if (!offered) return
    if (readDraft(storage, storageKey)?.savedAt === offered.savedAt) remove()
    offered = null
    notify()
  }

  return {
    draft: () => (offered ? { savedAt: offered.savedAt } : null),
    restore: () => {
      if (!offered || editor.isDestroyed) return false
      const restored = editor.commands.replaceContent(offered.content)
      if (!restored) {
        report(new Error('The saved draft no longer fits this editor and was discarded.'))
        discard()
        return false
      }
      offered = null
      notify()
      return true
    },
    discard,
    clear: () => {
      if (timer !== null) clearTimeout(timer)
      timer = null
      dirty = false
      offered = null
      remove()
      setStatus('idle')
      notify()
    },
    status: () => current,
    flush: commit,
    onChange: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    destroy: () => {
      if (destroyed) return
      flushLocal()
      destroyed = true
      if (timer !== null) clearTimeout(timer)
      timer = null
      controller?.abort()
      unsubscribe()
      lifecycle.dispose()
      listeners.clear()
    },
  }
}
