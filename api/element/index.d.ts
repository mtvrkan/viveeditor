import { Editor } from "viveeditor";
export declare class ViveEditorElement extends HTMLElement {
  #private;
  static readonly formAssociated: boolean;
  static readonly observedAttributes: readonly string[];
  constructor();
  get value(): string;
  set value(html: string);
  get editor(): Editor | null;
  get ready(): Promise<Editor>;
  get form(): HTMLFormElement | null;
  get name(): string;
  get validity(): ValidityState;
  get validationMessage(): string;
  checkValidity(): boolean;
  reportValidity(): boolean;
  override focus(options?: FocusOptions): void;
  connectedCallback(): void;
  disconnectedCallback(): void;
  attributeChangedCallback(): void;
  formResetCallback(): void;
  formDisabledCallback(disabled: boolean): void;
  formStateRestoreCallback(state: unknown): void;
}
export declare function defineViveEditor(tag?: string): CustomElementConstructor;
declare global {
  interface HTMLElementTagNameMap {
    "vive-editor": ViveEditorElement;
  }
}
//# sourceMappingURL=index.d.ts.map
