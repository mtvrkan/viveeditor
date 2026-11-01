export type Listener<Payload> = (payload: Payload) => void

export class Emitter<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<Listener<never>>>()
  private readonly onListenerError: (error: unknown, name: keyof Events) => void

  constructor(onListenerError: (error: unknown, name: keyof Events) => void) {
    this.onListenerError = onListenerError
  }

  on<Name extends keyof Events>(name: Name, listener: Listener<Events[Name]>): () => void {
    let set = this.listeners.get(name)
    if (!set) {
      set = new Set()
      this.listeners.set(name, set)
    }
    set.add(listener as Listener<never>)
    return () => this.off(name, listener)
  }

  off<Name extends keyof Events>(name: Name, listener: Listener<Events[Name]>): void {
    this.listeners.get(name)?.delete(listener as Listener<never>)
  }

  emit<Name extends keyof Events>(name: Name, payload: Events[Name]): void {
    const set = this.listeners.get(name)
    if (!set) return
    for (const listener of [...set]) {
      try {
        ;(listener as Listener<Events[Name]>)(payload)
      } catch (error) {
        this.onListenerError(error, name)
      }
    }
  }

  has<Name extends keyof Events>(name: Name): boolean {
    return (this.listeners.get(name)?.size ?? 0) > 0
  }

  clear(): void {
    this.listeners.clear()
  }
}
