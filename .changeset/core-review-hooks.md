---
"@viveeditor/core": minor
"@viveeditor/ui": patch
"@viveeditor/ext-character-count": patch
---

Core hooks for comments, track changes and collaboration. An extension can set `replacesHistory: true` so the core history is left out and its own `undo` and `redo` commands are used (both answer false if it registers none). `transformTransaction(transaction, state, context)` lets an extension rewrite a local edit before it is applied, in priority order; it is skipped for remote and selection-only transactions, and a result built for another state is reported as `INVALID_TRANSACTION` and the original edit is kept. `isRemote(transaction)` and `REMOTE_META` mark edits from a peer or a sync, and the `change` event now carries `remote`. Autosave and the character limit ignore remote edits.
