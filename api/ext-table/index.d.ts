import { Extension } from "@viveeditor/core";
import { Command } from "prosemirror-state";
export interface TableOptions {
  resizable: boolean;
  cellMinWidth: number;
  maxSize: number;
}
export interface InsertTableOptions {
  rows?: number;
  cols?: number;
  headerRow?: boolean;
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    insertTable: (options?: InsertTableOptions) => Command;
    deleteTable: () => Command;
    addRowBefore: () => Command;
    addRowAfter: () => Command;
    deleteRow: () => Command;
    addColumnBefore: () => Command;
    addColumnAfter: () => Command;
    deleteColumn: () => Command;
    mergeCells: () => Command;
    splitCell: () => Command;
    toggleHeaderRow: () => Command;
    toggleHeaderColumn: () => Command;
    resizeColumn: (delta: number) => Command;
  }
  interface QueryRegistry {
    inTable: () => boolean;
  }
}
export declare const Table: Extension<TableOptions>;
//# sourceMappingURL=index.d.ts.map
