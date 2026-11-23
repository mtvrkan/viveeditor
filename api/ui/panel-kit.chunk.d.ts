import { a as Messages, i as MessageKey, t as CommandAccess } from "./commands.chunk.js";
import "@viveeditor/core";
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
interface ImagePanelOptions {
  commands: CommandAccess;
  messages: Messages;
  place: (element: HTMLElement, anchor: HTMLElement) => void;
  returnToEditor: () => void;
  onClose: () => void;
}
declare function createImagePanel(options: ImagePanelOptions): Popover;
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
  export { createCharPanel, createCheckPanel, createEmbedPanel, createImagePanel, createOutlinePanel, createSearchPanel, createShortcutsPanel, createSwatchPanel, createTablePanel, documentMessages };
}
export { createImagePanel as a, createOutlinePanel as c, DocumentMessages as d, documentMessages as f, createSearchPanel as i, createShortcutsPanel as l, createTablePanel as n, createEmbedPanel as o, createSwatchPanel as r, createCheckPanel as s, panel_kit_d_exports as t, createCharPanel as u };
