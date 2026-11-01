import { n as Locale } from "../commands.chunk.js";
import { n as UiPlugin, r as UiPluginHost } from "../plugins.chunk.js";
import { EditorContent } from "@viveeditor/core";
interface ExtrasMessages {
  mentionTitle: string;
  emojiTitle: string;
  loading: string;
  noResults: string;
  results: string;
  template: string;
  math: string;
  mathBlock: string;
  footnote: string;
  ai: string;
  aiTitle: string;
  aiInstruction: string;
  aiSend: string;
  aiStop: string;
  aiReplace: string;
  aiInsert: string;
  aiRetry: string;
  aiDiscard: string;
  aiWorking: string;
  aiDone: string;
  aiFailed: string;
  aiTooLong: string;
  aiEmptySelection: string;
  aiChanged: string;
  aiImprove: string;
  aiFix: string;
  aiShorten: string;
  aiExpand: string;
  aiTone: string;
  aiTranslate: string;
  aiSummarize: string;
  aiContinue: string;
}
export declare const extrasMessages: (locale: Locale, overrides?: Partial<ExtrasMessages>) => ExtrasMessages;
type AiAction = "improve" | "fix" | "shorten" | "expand" | "tone" | "translate" | "summarize" | "continue" | "custom";
interface AiRequest {
  action: AiAction;
  instruction?: string;
  text: string;
  context: {
    before: string;
    after: string;
  };
  locale: Locale;
  signal: AbortSignal;
}
interface AiProvider {
  generate(request: AiRequest): AsyncIterable<string> | Promise<string>;
}
type MarkdownRenderer = (markdown: string) => string;
interface AiAssistantOptions {
  provider: AiProvider;
  actions?: readonly Exclude<AiAction, "custom">[];
  markdown?: () => Promise<MarkdownRenderer>;
  links?: boolean;
  messages?: Partial<ExtrasMessages>;
}
export declare function aiAssistant(options: AiAssistantOptions): UiPlugin;
interface MentionItem {
  id: string;
  label: string;
  description?: string;
}
interface MentionMenuOptions {
  items(query: string, signal: AbortSignal): readonly MentionItem[] | Promise<readonly MentionItem[]>;
  messages?: Partial<ExtrasMessages>;
}
export declare function mentionMenu(options: MentionMenuOptions): UiPlugin;
type EmojiRow = readonly [emoji: string, name: string, keywords: readonly string[]];
interface EmojiMenuOptions {
  load(): Promise<readonly EmojiRow[] | {
    default: readonly EmojiRow[];
  }>;
  messages?: Partial<ExtrasMessages>;
}
export declare function emojiMenu(options: EmojiMenuOptions): UiPlugin;
interface Template {
  id: string;
  label: string;
  description?: string;
  content: EditorContent;
}
export declare function templateMenu(templates: readonly Template[], overrides?: Partial<ExtrasMessages>): UiPlugin;
export declare function mathTools(overrides?: Partial<ExtrasMessages>): UiPlugin;
export declare function footnoteTools(overrides?: Partial<ExtrasMessages>): UiPlugin;
interface SuggestionItem {
  label: string;
  description?: string;
  icon?: string;
}
interface SuggestionConfig<Item extends SuggestionItem> {
  char: string;
  query: string;
  title: string;
  loading: string;
  empty: string;
  delay?: number;
  items(query: string, signal: AbortSignal): readonly Item[] | Promise<readonly Item[]>;
  select(item: Item, host: UiPluginHost): void;
}
export declare function suggestionMenu<Item extends SuggestionItem>(config: SuggestionConfig<Item>): UiPlugin;
export type { AiAction, AiAssistantOptions, AiProvider, AiRequest, EmojiMenuOptions, EmojiRow, ExtrasMessages, MarkdownRenderer, MentionItem, MentionMenuOptions, SuggestionConfig, SuggestionItem, Template };
//# sourceMappingURL=index.d.ts.map
