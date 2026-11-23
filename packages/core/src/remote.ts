import type { Transaction } from 'prosemirror-state'

export const REMOTE_META = 'viveRemote'

export function isRemote(transaction: Transaction): boolean {
  return transaction.getMeta(REMOTE_META) === true
}
