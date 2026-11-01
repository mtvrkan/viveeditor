import { Extension } from "@viveeditor/core";
import { Command } from "prosemirror-state";
declare module "@viveeditor/core" {
  interface CommandRegistry {
    toggleTaskList: () => Command;
    toggleTaskChecked: () => Command;
  }
}
export interface TaskListOptions {
  checkboxLabel: string;
}
export declare const TaskItem: Extension<TaskListOptions>;
export declare const TaskList: Extension<Record<string, never>>;
export declare const taskListExtensions: readonly Extension[];
//# sourceMappingURL=index.d.ts.map
