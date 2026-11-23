---
'@viveeditor/ext-format': minor
'@viveeditor/ui': minor
---

New `CleanDocument` extension (part of `formatExtensions`) with the `cleanDocument` command and the `documentCleanup` query: it removes spaces at paragraph edges, repeated spaces, line breaks at paragraph ends and extra empty paragraphs in one transaction, never touching code blocks, and reports `{ extraSpaces, trailingBreaks, emptyParagraphs }`. The File menu gets "Tidy up document", which shows the counts in a notice.
