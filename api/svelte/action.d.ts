import { type Editor, type MountOptions } from 'viveeditor';
export interface ViveEditorOptions extends Pick<MountOptions, 'extensions' | 'ui' | 'locale' | 'label' | 'onError'> {
    value?: string;
    editable?: boolean;
    onChange?: (html: string, editor: Editor) => void;
    onReady?: (editor: Editor) => void;
    onFocus?: (editor: Editor) => void;
    onBlur?: (editor: Editor) => void;
}
export interface ViveEditorAction {
    update(options: ViveEditorOptions): void;
    destroy(): void;
}
export declare function viveEditor(host: HTMLElement, options?: ViveEditorOptions): ViveEditorAction;
