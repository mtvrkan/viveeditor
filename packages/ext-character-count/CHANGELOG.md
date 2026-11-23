# @viveeditor/ext-character-count

## 1.0.0-rc.0

### Patch Changes

- e8c82d0: Core hooks for comments, track changes and collaboration. An extension can set `replacesHistory: true` so the core history is left out and its own `undo` and `redo` commands are used (both answer false if it registers none). `transformTransaction(transaction, state, context)` lets an extension rewrite a local edit before it is applied, in priority order; it is skipped for remote and selection-only transactions, and a result built for another state is reported as `INVALID_TRANSACTION` and the original edit is kept. `isRemote(transaction)` and `REMOTE_META` mark edits from a peer or a sync, and the `change` event now carries `remote`. Autosave and the character limit ignore remote edits.
- Updated dependencies [9f59c19]
- Updated dependencies [e8c82d0]
- Updated dependencies [96ea657]
- Updated dependencies [1a1a861]
- Updated dependencies [96ea657]
- Updated dependencies [96ea657]
- Updated dependencies [319b968]
- Updated dependencies [96ea657]
- Updated dependencies [96ea657]
- Updated dependencies [96ea657]
- Updated dependencies [095b69b]
- Updated dependencies [96ea657]
  - @viveeditor/core@1.0.0-rc.0

## 0.1.0

### Minor Changes

- 7f36bb3: First public release of viveEditor: the one-script editor, the core engine and its extensions, the toolbar, React, Vue, Svelte, Angular and custom-element components, Markdown and Word conversion, and the Node sanitizer.

### Patch Changes

- Updated dependencies [7f36bb3]
  - @viveeditor/core@0.1.0
