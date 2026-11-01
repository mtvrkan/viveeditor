import { Editor, EditorOptions, Extension } from "@viveeditor/core";
import { EditorUI, UiOptions } from "@viveeditor/ui";
import { MarkdownConverter } from "@viveeditor/markdown/paste";
export * from "@viveeditor/core";
export * from "@viveeditor/ext-basic";
export * from "@viveeditor/ext-code-block";
export * from "@viveeditor/ext-embed";
export * from "@viveeditor/ext-format";
export * from "@viveeditor/ext-image";
export * from "@viveeditor/ext-list";
export * from "@viveeditor/ext-office-paste";
export * from "@viveeditor/ext-search";
export * from "@viveeditor/ext-table";
export * from "@viveeditor/ext-task-list";
export * from "@viveeditor/ui";
interface MountOptions {
  value?: string;
  extensions?: readonly Extension[];
  ui?: UiOptions | false;
  locale?: string;
  label?: string;
  editable?: boolean;
  onChange?: (html: string, editor: Editor) => void;
  onReady?: (editor: Editor) => void;
  onFocus?: (editor: Editor) => void;
  onBlur?: (editor: Editor) => void;
  onError?: (error: unknown) => void;
}
interface EditorMount {
  readonly ready: Promise<Editor>;
  readonly editor: Editor | null;
  readonly ui: EditorUI | null;
  getValue(): string;
  setValue(html: string): void;
  setEditable(editable: boolean): void;
  destroy(): void;
}
export declare class MountDestroyedError extends Error {
  constructor();
}
export declare function mountEditor(host: HTMLElement, options?: MountOptions): EditorMount;
interface ClassicPresetOptions {
  markdown?: () => Promise<MarkdownConverter>;
}
export declare function classicPreset(locale?: string, options?: ClassicPresetOptions): readonly Extension[];
export declare const classicExtensions: readonly Extension[];
interface TextareaEditorOptions extends Omit<EditorOptions, "content"> {
  ui?: UiOptions | false;
}
interface TextareaEditor {
  readonly editor: Editor;
  readonly ui: EditorUI | null;
  readonly textarea: HTMLTextAreaElement;
  readonly container: HTMLElement;
  sync(): void;
  destroy(): void;
}
export declare function upgradeTextarea(textarea: HTMLTextAreaElement, options?: TextareaEditorOptions): Promise<TextareaEditor>;
export declare function upgradeAll(root?: ParentNode, options?: TextareaEditorOptions): Promise<TextareaEditor[]>;
export type { ClassicPresetOptions, EditorMount, MountOptions, TextareaEditor, TextareaEditorOptions };
//# sourceMappingURL=index.d.ts.map
