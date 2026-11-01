import { Extension } from "@viveeditor/core";
import { SearchQuery } from "prosemirror-search";
import { Command } from "prosemirror-state";
export interface SearchTerms {
  query: string;
  replace?: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
}
export interface SearchStatus {
  total: number;
  current: number;
}
export interface SearchOptions {
  maxQueryLength: number;
}
declare module "@viveeditor/core" {
  interface CommandRegistry {
    setSearch: (terms: SearchTerms) => Command;
    clearSearch: () => Command;
    findNext: () => Command;
    findPrevious: () => Command;
    replaceNext: () => Command;
    replaceAll: () => Command;
  }
  interface QueryRegistry {
    searchStatus: () => SearchStatus;
  }
}
export declare function caseInsensitivePattern(text: string): string;
export declare function createQuery(terms: SearchTerms, maxLength: number): SearchQuery;
export declare const Search: Extension<SearchOptions>;
//# sourceMappingURL=index.d.ts.map
