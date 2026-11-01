import { Editor, MountOptions } from "viveeditor";
import { DefineSetupFnComponent, ShallowRef } from "vue";
export interface ViveEditorOptions extends Pick<MountOptions, "extensions" | "ui" | "locale" | "label" | "onError"> {
  value?: string;
  editable?: boolean;
  onChange?: (html: string, editor: Editor) => void;
  onReady?: (editor: Editor) => void;
  onFocus?: (editor: Editor) => void;
  onBlur?: (editor: Editor) => void;
}
export interface ViveEditorHandle {
  el: ShallowRef<HTMLElement | null>;
  editor: ShallowRef<Editor | null>;
}
export declare function useViveEditor(options: () => ViveEditorOptions): ViveEditorHandle;
export interface ViveEditorProps extends Pick<ViveEditorOptions, "extensions" | "ui" | "locale" | "label" | "editable"> {
  modelValue?: string;
}
export type ViveEditorEmits = {
  "update:modelValue": (html: string) => boolean;
  ready: (editor: Editor) => boolean;
  focus: (editor: Editor) => boolean;
  blur: (editor: Editor) => boolean;
  error: (error: unknown) => boolean;
};
export declare const ViveEditor: DefineSetupFnComponent<ViveEditorProps, ViveEditorEmits>;
//# sourceMappingURL=index.d.ts.map
