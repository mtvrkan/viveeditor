import { a as Messages, n as Locale, t as CommandAccess } from "./commands.chunk.js";
import { Editor } from "@viveeditor/core";
type IconName = "strike" | "code" | "bulletList" | "orderedList" | "blockquote" | "link" | "undo" | "redo" | "more" | "paragraph" | "heading" | "horizontalRule" | "chevron" | "check" | "alert" | "video" | "unlink" | "alignLeft" | "alignCenter" | "alignRight" | "alignJustify" | "textColor" | "highlight" | "clear" | "taskList" | "codeBlock" | "table" | "search" | "arrowUp" | "arrowDown" | "image" | "upload" | "source" | "file" | "folder" | "download" | "print";
interface SlashEntry {
  id: string;
  label: string;
  keywords: string;
  icon?: IconName | Node;
  hint?: string;
  run(): void;
}
interface UiPluginHost {
  readonly editor: Editor;
  readonly commands: CommandAccess;
  readonly messages: Messages;
  readonly locale: Locale;
  readonly root: HTMLElement;
  announce(text: string): void;
  report(error: unknown): void;
  closeFloating(): void;
}
interface UiPluginInstance {
  slash?: readonly SlashEntry[];
  bubble?: readonly HTMLButtonElement[];
  handleKey?(event: KeyboardEvent): boolean;
  update?(focused: boolean): void;
  isOpen?(): boolean;
  destroy?(): void;
}
type UiPlugin = (host: UiPluginHost) => UiPluginInstance;
export { UiPluginInstance as i, UiPlugin as n, UiPluginHost as r, SlashEntry as t };
//# sourceMappingURL=plugins-CRBg2l2m.d.ts.map
