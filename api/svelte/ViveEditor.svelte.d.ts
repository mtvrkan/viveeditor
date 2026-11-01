import type { Editor } from 'viveeditor';
import { type ViveEditorOptions } from './action.js';
interface Props extends Pick<ViveEditorOptions, 'extensions' | 'ui' | 'locale' | 'label' | 'editable'> {
    value?: string;
    editor?: Editor | null;
    id?: string;
    class?: string;
    onchange?: (html: string, editor: Editor) => void;
    onready?: (editor: Editor) => void;
    onfocus?: (editor: Editor) => void;
    onblur?: (editor: Editor) => void;
    onerror?: (error: unknown) => void;
}
declare const ViveEditor: import("svelte").Component<Props, {}, "value" | "editor">;
type ViveEditor = ReturnType<typeof ViveEditor>;
export default ViveEditor;
