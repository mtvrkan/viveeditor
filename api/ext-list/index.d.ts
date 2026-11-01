import { Extension } from "@viveeditor/core";
import { Command } from "prosemirror-state";
declare module "@viveeditor/core" {
  interface CommandRegistry {
    toggleBulletList: () => Command;
    toggleOrderedList: () => Command;
    sinkListItem: () => Command;
    liftListItem: () => Command;
  }
}
type NoOptions = Record<string, never>;
export declare const ListItem: Extension<NoOptions>;
export declare const BulletList: Extension<NoOptions>;
export declare const OrderedList: Extension<NoOptions>;
export declare const listExtensions: readonly Extension[];
export {};
//# sourceMappingURL=index.d.ts.map
