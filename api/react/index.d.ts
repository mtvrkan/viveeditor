import { CSSProperties, ForwardRefExoticComponent, RefAttributes, RefObject } from "react";
import { Editor, MountOptions } from "viveeditor";
export interface ViveEditorOptions extends Pick<MountOptions, "extensions" | "ui" | "locale" | "label" | "onError"> {
  value?: string;
  defaultValue?: string;
  editable?: boolean;
  onChange?: (html: string, editor: Editor) => void;
  onReady?: (editor: Editor) => void;
  onFocus?: (editor: Editor) => void;
  onBlur?: (editor: Editor) => void;
}
export interface ViveEditorProps extends ViveEditorOptions {
  id?: string;
  className?: string;
  style?: CSSProperties;
}
export interface ViveEditorHandle {
  ref: RefObject<HTMLDivElement | null>;
  editor: Editor | null;
}
export declare function useViveEditor(options: ViveEditorOptions): ViveEditorHandle;
export declare const ViveEditor: ForwardRefExoticComponent<ViveEditorProps & RefAttributes<Editor | null>>;
//# sourceMappingURL=index.d.ts.map
