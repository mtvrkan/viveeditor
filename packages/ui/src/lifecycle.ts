export type Listen = (
  target: EventTarget,
  type: string,
  handler: (event: Event) => void,
  options?: AddEventListenerOptions | boolean,
) => void

export interface Lifecycle {
  listen: Listen
  add(cleanup: () => void): void
  dispose(): void
}

export function createLifecycle(): Lifecycle {
  const cleanups: Array<() => void> = []
  return {
    listen: (target, type, handler, options) => {
      target.addEventListener(type, handler, options)
      cleanups.push(() => target.removeEventListener(type, handler, options))
    },
    add: (cleanup) => {
      cleanups.push(cleanup)
    },
    dispose: () => {
      for (const cleanup of cleanups.splice(0)) cleanup()
    },
  }
}

export interface Scheduler {
  schedule(): void
  cancel(): void
}

const nextFrame = (callback: () => void): number =>
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(callback)
    : window.setTimeout(callback, 16)

const cancelFrame = (handle: number): void => {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle)
  else window.clearTimeout(handle)
}

export function createScheduler(callback: () => void): Scheduler {
  let frame = 0
  return {
    schedule: () => {
      if (frame) return
      frame = nextFrame(() => {
        frame = 0
        callback()
      })
    },
    cancel: () => {
      if (frame) cancelFrame(frame)
      frame = 0
    },
  }
}
