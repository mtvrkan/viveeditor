import { InputRule } from "prosemirror-inputrules";
import { MarkSpec, MarkType, NodeSpec, NodeType, Schema } from "prosemirror-model";
import { Command, EditorState, Plugin } from "prosemirror-state";
interface JSONMark {
  type: string;
  attrs?: Record<string, unknown>;
}
interface JSONContent {
  type: string;
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
  marks?: JSONMark[];
  text?: string;
}
type EditorContent = string | JSONContent;
interface EditorSelection {
  from: number;
  to: number;
  empty: boolean;
}
interface EditorRect {
  top: number;
  bottom: number;
  left: number;
  right: number;
}
interface EditorOptions {
  extensions?: readonly Extension[];
  content?: EditorContent;
  editable?: boolean;
  label?: string;
}
interface EditorEventMap {
  change: {
    editor: Editor;
  };
  update: {
    editor: Editor;
  };
  focus: {
    editor: Editor;
    event: FocusEvent;
  };
  blur: {
    editor: Editor;
    event: FocusEvent;
  };
  destroy: {
    editor: Editor;
  };
  error: {
    editor: Editor;
    error: unknown;
  };
}
type EditorCommands = { [Name in CommandName]: (...args: Parameters<CommandRegistry[Name]>) => boolean; };
type EditorQueries = { [Name in QueryName]: (...args: Parameters<QueryRegistry[Name]>) => ReturnType<QueryRegistry[Name]>; };
export declare class Editor {
  readonly schema: Schema;
  readonly commands: EditorCommands;
  readonly can: EditorCommands;
  readonly query: EditorQueries;
  private readonly view;
  private readonly commandFactories;
  private readonly queryFactories;
  private readonly events;
  private lastDoc;
  private destroyed;
  private editable;
  static create(element: HTMLElement, options?: EditorOptions): Promise<Editor>;
  private constructor();
  get isDestroyed(): boolean;
  get isEditable(): boolean;
  get isEmpty(): boolean;
  get dom(): HTMLElement;
  getText(): string;
  getSelection(): EditorSelection;
  getSelectionRect(): EditorRect | null;
  getTextBeforeCursor(): string;
  getAttributes(name: string): Record<string, unknown>;
  getJSON(): JSONContent;
  isActive(name: string, attrs?: Record<string, unknown>): boolean;
  getHTML(): string;
  setContent(content: EditorContent): void;
  setEditable(editable: boolean): void;
  focus(): void;
  on<Name extends keyof EditorEventMap>(name: Name, listener: (payload: EditorEventMap[Name]) => void): () => void;
  off<Name extends keyof EditorEventMap>(name: Name, listener: (payload: EditorEventMap[Name]) => void): void;
  destroy(): void;
  private currentDoc;
  private reportListenerError;
  private createCommandProxy;
  private createQueryProxy;
  private run;
  private dispatch;
  private assertAlive;
}
interface CommandRegistry {
  selectAll: () => Command;
  undo: () => Command;
  redo: () => Command;
  setParagraph: () => Command;
  deleteRange: (from: number, to: number) => Command;
  replaceContent: (content: EditorContent) => Command;
  insertContent: (content: EditorContent) => Command;
  insertText: (text: string) => Command;
  setTextSelection: (from: number, to?: number) => Command;
}
type CommandName = keyof CommandRegistry;
type CommandFactory = (...args: never[]) => Command;
type CommandFactories = { [Name in CommandName]?: CommandRegistry[Name]; };
interface QueryRegistry {
  selectedText: () => string;
  textBetween: (from: number, to: number) => string;
}
type QueryName = keyof QueryRegistry;
type QueryFactory = (state: EditorState, ...args: never[]) => unknown;
type QueryFactories = { [Name in QueryName]?: (state: EditorState, ...args: Parameters<QueryRegistry[Name]>) => ReturnType<QueryRegistry[Name]>; };
interface AttributeSpec {
  default: unknown;
  parse(element: HTMLElement): unknown;
  render(value: unknown): Record<string, string> | null;
}
interface GlobalAttributes {
  types: readonly string[];
  attributes: Record<string, AttributeSpec>;
}
interface ExtensionContext<Options> {
  schema: Schema;
  options: Options;
}
interface ExtensionConfig<Options> {
  name: string;
  priority?: number;
  defaultOptions: Options;
  nodes?(options: Options): Record<string, NodeSpec>;
  marks?(options: Options): Record<string, MarkSpec>;
  attributes?(options: Options): GlobalAttributes[];
  commands?(context: ExtensionContext<Options>): CommandFactories;
  queries?(context: ExtensionContext<Options>): QueryFactories;
  keymap?(context: ExtensionContext<Options>): Record<string, Command>;
  inputRules?(context: ExtensionContext<Options>): InputRule[];
  plugins?(context: ExtensionContext<Options>): Plugin[];
}
interface Extension<Options = unknown> {
  readonly name: string;
  readonly priority: number;
  readonly options: Options;
  readonly config: ExtensionConfig<Options>;
  configure(options: Partial<Options>): Extension<Options>;
}
export declare const DEFAULT_PRIORITY = 100;
export declare function defineExtension<Options = Record<string, never>>(config: ExtensionConfig<Options>): Extension<Options>;
export declare const Base: Extension<Record<string, never>>;
type ViveEditorErrorCode = "INVALID_CONTENT" | "DESTROYED" | "DUPLICATE_EXTENSION" | "DUPLICATE_COMMAND" | "DUPLICATE_QUERY" | "SCHEMA_CONFLICT" | "INVALID_SCHEMA" | "MISSING_SCHEMA_ITEM" | "UNKNOWN_COMMAND" | "UNKNOWN_QUERY";
export declare class ViveEditorError extends Error {
  readonly code: ViveEditorErrorCode;
  constructor(code: ViveEditorErrorCode, message: string, options?: {
    cause?: unknown;
  });
}
export declare function markInputRule(pattern: RegExp, markType: MarkType): InputRule;
export declare function cleanPastedHtml(html: string): string;
export declare function getNodeType(schema: Schema, name: string): NodeType;
export declare function getMarkType(schema: Schema, name: string): MarkType;
export declare const DEFAULT_ALLOWED_PROTOCOLS: readonly string[];
export declare function isAllowedUrl(url: string, protocols?: readonly string[]): boolean;
export type { AttributeSpec, CommandFactories, CommandFactory, CommandName, CommandRegistry, EditorCommands, EditorContent, EditorEventMap, EditorOptions, EditorQueries, EditorRect, EditorSelection, Extension, ExtensionConfig, ExtensionContext, GlobalAttributes, JSONContent, JSONMark, QueryFactories, QueryFactory, QueryName, QueryRegistry, ViveEditorErrorCode };
//# sourceMappingURL=index.d.ts.map
