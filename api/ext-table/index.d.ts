import { Extension } from "@viveeditor/core";
import { Command } from "prosemirror-state";
export interface TableOptions {
  resizable: boolean;
  cellMinWidth: number;
  maxSize: number;
}
export type CellVerticalAlign = "middle" | "bottom";
export type CellTextAlign = "center" | "right" | "justify";
export interface CellStyle {
  background: string | null;
  verticalAlign: CellVerticalAlign | null;
  textAlign: CellTextAlign | null;
}
export type TableWidth = "full";
export type TableAlign = "center";
export type TableBorder = "rows" | "none";
export interface TableStyle {
  width: TableWidth | null;
  align: TableAlign | null;
  border: TableBorder | null;
  striped: boolean;
  borderColor: string | null;
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
    setCellTextAlign: (align: CellTextAlign | null) => Command;
    setTableWidth: (width: TableWidth | null) => Command;
    setTableAlign: (align: TableAlign | null) => Command;
    setTableBorder: (border: TableBorder | null) => Command;
    setTableStriped: (striped: boolean) => Command;
    setTableBorderColor: (color: string | null) => Command;
    selectRow: () => Command;
    selectColumn: () => Command;
    selectTable: () => Command;
    distributeColumns: () => Command;
  }
  interface QueryRegistry {
    inTable: () => boolean;
    cellStyle: () => CellStyle | null;
    tableStyle: () => TableStyle | null;
  }
}
export declare const Table: Extension<TableOptions>;
