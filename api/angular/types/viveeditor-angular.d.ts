import * as i0 from "@angular/core";
import { InputSignal, InputSignalWithTransform, OutputEmitterRef } from "@angular/core";
import { ControlValueAccessor } from "@angular/forms";
import { Editor, MountOptions } from "viveeditor";
export declare class ViveEditorComponent implements ControlValueAccessor {
  #private;
  readonly extensions: InputSignal<MountOptions['extensions']>;
  readonly ui: InputSignal<MountOptions['ui']>;
  readonly locale: InputSignal<string | undefined>;
  readonly label: InputSignal<string | undefined>;
  readonly readonly: InputSignalWithTransform<boolean, unknown>;
  readonly ready: OutputEmitterRef<Editor>;
  readonly editorFocus: OutputEmitterRef<Editor>;
  readonly editorBlur: OutputEmitterRef<Editor>;
  constructor();
  get editor(): Editor | null;
  writeValue(value: unknown): void;
  registerOnChange(fn: (html: string) => void): void;
  registerOnTouched(fn: () => void): void;
  setDisabledState(disabled: boolean): void;
  static ɵfac: i0.ɵɵFactoryDeclaration<ViveEditorComponent, never>;
  static ɵcmp: i0.ɵɵComponentDeclaration<ViveEditorComponent, "vive-ng-editor", never, {
    "extensions": {
      "alias": "extensions";
      "required": false;
      "isSignal": true;
    };
    "ui": {
      "alias": "ui";
      "required": false;
      "isSignal": true;
    };
    "locale": {
      "alias": "locale";
      "required": false;
      "isSignal": true;
    };
    "label": {
      "alias": "label";
      "required": false;
      "isSignal": true;
    };
    "readonly": {
      "alias": "readonly";
      "required": false;
      "isSignal": true;
    };
  }, {
    "ready": "ready";
    "editorFocus": "editorFocus";
    "editorBlur": "editorBlur";
  }, never, never, true, never>;
}
//# sourceMappingURL=viveeditor-angular.d.ts.map
