import type { CommandAccess } from './commands.js'
import type { MenuItem } from './menu.js'
import type { MessageKey, Messages } from './messages.js'

export interface TableAction {
  id: string
  label: MessageKey
  command: string
  args?: readonly unknown[]
  group: number
  destructive?: boolean
}

export const RESIZE_STEP = 40

export const ROW_RESIZE_STEP = 16

export const TABLE_CELL_ACTIONS: readonly TableAction[] = [
  { id: 'mergeCells', label: 'mergeCells', command: 'mergeCells', group: 0 },
  { id: 'splitCell', label: 'splitCell', command: 'splitCell', group: 0 },
  { id: 'selectRow', label: 'selectRow', command: 'selectRow', group: 0 },
  { id: 'selectColumn', label: 'selectColumn', command: 'selectColumn', group: 0 },
  { id: 'rowAbove', label: 'rowAbove', command: 'addRowBefore', group: 1 },
  { id: 'rowBelow', label: 'rowBelow', command: 'addRowAfter', group: 1 },
  { id: 'columnLeft', label: 'columnLeft', command: 'addColumnBefore', group: 1 },
  { id: 'columnRight', label: 'columnRight', command: 'addColumnAfter', group: 1 },
  { id: 'deleteRow', label: 'deleteRow', command: 'deleteRow', group: 2 },
  { id: 'deleteColumn', label: 'deleteColumn', command: 'deleteColumn', group: 2 },
  { id: 'headerRow', label: 'headerRow', command: 'toggleHeaderRow', group: 3 },
  { id: 'headerColumn', label: 'headerColumn', command: 'toggleHeaderColumn', group: 3 },
]

export const TABLE_ACTIONS: readonly TableAction[] = [
  { id: 'distributeColumns', label: 'distributeColumns', command: 'distributeColumns', group: 4 },
  {
    id: 'widenColumn',
    label: 'widenColumn',
    command: 'resizeColumn',
    args: [RESIZE_STEP],
    group: 4,
  },
  {
    id: 'narrowColumn',
    label: 'narrowColumn',
    command: 'resizeColumn',
    args: [-RESIZE_STEP],
    group: 4,
  },
  {
    id: 'tallerRow',
    label: 'tallerRow',
    command: 'resizeRow',
    args: [ROW_RESIZE_STEP],
    group: 4,
  },
  {
    id: 'shorterRow',
    label: 'shorterRow',
    command: 'resizeRow',
    args: [-ROW_RESIZE_STEP],
    group: 4,
  },
  {
    id: 'resetRowHeight',
    label: 'resetRowHeight',
    command: 'setRowHeight',
    args: [null],
    group: 4,
  },
  { id: 'selectTable', label: 'selectTable', command: 'selectTable', group: 4 },
  {
    id: 'deleteTable',
    label: 'deleteTable',
    command: 'deleteTable',
    group: 5,
    destructive: true,
  },
]

export const canRunTableAction = (commands: CommandAccess, action: TableAction): boolean =>
  commands.can(action.command, ...(action.args ?? []))

export const runTableAction = (commands: CommandAccess, action: TableAction): boolean =>
  commands.run(action.command, ...(action.args ?? []))

const toMenuItems = (
  actions: readonly TableAction[],
  commands: CommandAccess,
  messages: Messages,
): MenuItem[] =>
  actions.map((action) => ({
    id: `table-${action.id}`,
    label: messages[action.label],
    role: 'menuitem',
    group: action.group,
    disabled: () => !canRunTableAction(commands, action),
    action: () => {
      runTableAction(commands, action)
    },
  }))

export const tableCellActions = (commands: CommandAccess, messages: Messages): MenuItem[] =>
  toMenuItems(TABLE_CELL_ACTIONS, commands, messages)

export const tableActions = (commands: CommandAccess, messages: Messages): MenuItem[] =>
  toMenuItems(TABLE_ACTIONS, commands, messages)
