import { a as Messages, i as MessageKey, t as CommandAccess } from "./commands.chunk.js";
import { Editor } from "@viveeditor/core";
interface DocumentMessages {
  outlineEmpty: string;
  outlineUntitled: string;
  checkNone: string;
  checkCount: string;
  checkShow: string;
  checkAgain: string;
  checkImageAlt: string;
  checkHeadingEmpty: string;
  checkHeadingSkip: string;
  checkLinkText: string;
  checkTableHeader: string;
  checkEmbedTitle: string;
  checkContrast: string;
  shortcutsText: string;
  shortcutsParagraph: string;
  shortcutsEditing: string;
  shortcutsMove: string;
  shortcutToolbar: string;
  shortcutLeave: string;
  shortcutSlash: string;
  shortcutBreak: string;
  shortcutCase: string;
  shortcutBigger: string;
  shortcutSmaller: string;
  shortcutHelp: string;
}
declare function documentMessages(locale: string, overrides?: Readonly<Record<string, unknown>>): DocumentMessages;
interface Swatch {
  color: string | null;
  value: string;
  name: MessageKey;
}
interface Popover {
  readonly element: HTMLElement;
  open(anchor: HTMLElement): void;
  close(returnFocus: boolean): void;
  isOpen(): boolean;
}
interface CharPanelOptions {
  commands: CommandAccess;
  messages: Messages;
  place: (element: HTMLElement, anchor: HTMLElement) => void;
  returnToEditor: () => void;
  onClose: () => void;
}
declare function createCharPanel(options: CharPanelOptions): Popover;
type ContextKind = "table" | "image" | "link" | "code" | "embed" | "math" | "text";
interface ContextPoint {
  x: number;
  y: number;
}
interface ContextMenuOptions {
  editor: Editor;
  commands: CommandAccess;
  messages: Messages;
  container: HTMLElement;
  announce: (text: string) => void;
  openPanel: (id: string) => void;
  openLink: () => void;
  onOpen: () => void;
  returnToEditor: () => void;
}
interface ContextMenu {
  open(kind: ContextKind, target: Element | null, point: ContextPoint): void;
  close(returnFocus: boolean): void;
  isOpen(): boolean;
}
declare function createContextMenu(options: ContextMenuOptions): ContextMenu;
interface CropDialogOptions {
  commands: CommandAccess;
  messages: Messages;
  returnToEditor: () => void;
  onClose: () => void;
}
declare function createCropDialog(options: CropDialogOptions): Popover;
interface DocumentPanelOptions {
  commands: CommandAccess;
  messages: Messages;
  text: DocumentMessages;
  place: (element: HTMLElement, anchor: HTMLElement) => void;
  returnToEditor: () => void;
  onClose: () => void;
}
declare function createOutlinePanel(options: DocumentPanelOptions): Popover;
declare function createCheckPanel(options: DocumentPanelOptions): Popover;
declare function createShortcutsPanel(options: DocumentPanelOptions): Popover;
interface EmbedPanelOptions {
  commands: CommandAccess;
  messages: Messages;
  place: (element: HTMLElement, anchor: HTMLElement) => void;
  returnToEditor: () => void;
  onClose: () => void;
}
declare function createEmbedPanel(options: EmbedPanelOptions): Popover;
interface FontSizePanelOptions {
  commands: CommandAccess;
  messages: Messages;
  locale: string;
  place: (element: HTMLElement, anchor: HTMLElement) => void;
  returnToEditor: () => void;
  onClose: () => void;
}
declare function createFontSizePanel(options: FontSizePanelOptions): Popover;
interface ImagePanelOptions {
  commands: CommandAccess;
  messages: Messages;
  place: (element: HTMLElement, anchor: HTMLElement) => void;
  returnToEditor: () => void;
  onClose: () => void;
  openCrop?: (anchor: HTMLElement) => void;
}
declare function createImagePanel(options: ImagePanelOptions): Popover;
interface ListStylePanelOptions {
  commands: CommandAccess;
  messages: Messages;
  place: (element: HTMLElement, anchor: HTMLElement) => void;
  returnToEditor: () => void;
  onClose: () => void;
}
declare function createListStylePanel(options: ListStylePanelOptions): Popover;
interface SearchPanelOptions {
  commands: CommandAccess;
  messages: Messages;
  place: (element: HTMLElement, anchor: HTMLElement) => void;
  returnToEditor: () => void;
  onClose: () => void;
}
declare function createSearchPanel(options: SearchPanelOptions): Popover;
interface SwatchPanelOptions {
  messages: Messages;
  title: string;
  swatches: readonly Swatch[];
  tone: "dark" | "light";
  clearLabel: string;
  current: () => string | null;
  apply: (swatch: Swatch) => void;
  applyColor: (color: string) => void;
  recentKey: string;
  documentColors?: () => readonly string[];
  clear: () => void;
  place: (element: HTMLElement, anchor: HTMLElement) => void;
  onClose: () => void;
}
declare function createSwatchPanel(options: SwatchPanelOptions): Popover;
interface TablePanelOptions {
  commands: CommandAccess;
  messages: Messages;
  place: (element: HTMLElement, anchor: HTMLElement) => void;
  returnToEditor: () => void;
  onClose: () => void;
}
declare function createTablePanel(options: TablePanelOptions): Popover;
declare namespace panel_kit_d_exports {
  export { createCharPanel, createCheckPanel, createContextMenu, createCropDialog, createEmbedPanel, createFontSizePanel, createImagePanel, createListStylePanel, createOutlinePanel, createSearchPanel, createShortcutsPanel, createSwatchPanel, createTablePanel, documentMessages };
}
export { createListStylePanel as a, createEmbedPanel as c, createShortcutsPanel as d, createCropDialog as f, documentMessages as g, DocumentMessages as h, createSearchPanel as i, createCheckPanel as l, createCharPanel as m, createTablePanel as n, createImagePanel as o, createContextMenu as p, createSwatchPanel as r, createFontSizePanel as s, panel_kit_d_exports as t, createOutlinePanel as u };
