import { Extension } from "@viveeditor/core";
import { Command } from "prosemirror-state";
export interface TableOptions {
  resizable: boolean;
  cellMinWidth: number;
  maxSize: number;
}
export type CellVerticalAlign = "middle" | "bottom";
export interface CellStyle {
  background: string | null;
  verticalAlign: CellVerticalAlign | null;
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
    setCellBackground: (color: string | null) => Command;
    setCellVerticalAlign: (align: CellVerticalAlign | null) => Command;
  }
  interface QueryRegistry {
    inTable: () => boolean;
    cellStyle: () => CellStyle | null;
  }
}
export declare const Table: Extension<TableOptions>;
