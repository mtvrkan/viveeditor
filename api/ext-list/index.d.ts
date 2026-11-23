import { Extension } from "@viveeditor/core";
import { Command } from "prosemirror-state";
export type OrderedListType = "1" | "a" | "A" | "i" | "I";
export type BulletStyle = "disc" | "circle" | "square";
export type ListStyle = {
  kind: "ordered";
  type: OrderedListType;
  start: number;
} | {
  kind: "bullet";
  style: BulletStyle | null;
};
declare module "@viveeditor/core" {
  interface CommandRegistry {
    toggleBulletList: () => Command;
    toggleOrderedList: () => Command;
    sinkListItem: () => Command;
    liftListItem: () => Command;
    setListType: (type: OrderedListType) => Command;
    setListStart: (start: number) => Command;
    setBulletStyle: (style: BulletStyle | null) => Command;
  }
  interface QueryRegistry {
    listStyle: () => ListStyle | null;
  }
}
type NoOptions = Record<string, never>;
export declare const MAX_LIST_START = 99999;
export declare const ListItem: Extension<NoOptions>;
export declare const BulletList: Extension<NoOptions>;
export declare const OrderedList: Extension<NoOptions>;
export declare const listExtensions: readonly Extension[];
export {};
