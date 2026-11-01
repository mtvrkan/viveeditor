import { a as Messages, i as MessageKey, t as CommandAccess } from "./commands.chunk.js";
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
  export { createEmbedPanel, createImagePanel, createSearchPanel, createSwatchPanel, createTablePanel };
}
export { createImagePanel as a, createSearchPanel as i, createTablePanel as n, createEmbedPanel as o, createSwatchPanel as r, panel_kit_d_exports as t };
//# sourceMappingURL=panel-kit--5Jepcmd.d.ts.map
