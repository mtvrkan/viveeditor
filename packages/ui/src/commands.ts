import type { Editor } from '@viveeditor/core'

type LooseCommand = (...args: unknown[]) => boolean

export interface CommandAccess {
  has(name: string): boolean
  run(name: string, ...args: unknown[]): boolean
  can(name: string, ...args: unknown[]): boolean
  query(name: string, ...args: unknown[]): unknown
}

function call(table: Record<string, LooseCommand>, name: string, args: unknown[]): boolean {
  if (!(name in table)) return false
  const command = table[name]
  return command ? command(...args) : false
}

export function commandAccess(editor: Editor): CommandAccess {
  const execute = editor.commands as unknown as Record<string, LooseCommand>
  const dryRun = editor.can as unknown as Record<string, LooseCommand>
  const queries = editor.query as unknown as Record<string, (...args: unknown[]) => unknown>
  return {
    has: (name) => !editor.isDestroyed && name in execute,
    run: (name, ...args) => !editor.isDestroyed && call(execute, name, args),
    can: (name, ...args) => !editor.isDestroyed && call(dryRun, name, args),
    query: (name, ...args) =>
      !editor.isDestroyed && name in queries ? queries[name]?.(...args) : undefined,
  }
}
