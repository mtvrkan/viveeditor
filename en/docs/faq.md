# Frequently asked questions

> Short answers about viveEditor's licence, setup, frameworks, safety, Word support, languages, extras and versions.

URL: https://editor.vivepdf.com/en/docs/faq/
Last updated: 2026-11-01

These are the questions people ask most often before they add viveEditor to a site. Each answer is short; the linked pages have the details.

## Where to read more

- Setup: [Installation](https://editor.vivepdf.com/en/docs/installation/) and [Your first editor](https://editor.vivepdf.com/en/docs/first-editor/).
- Frameworks and server rendering: [Frameworks](https://editor.vivepdf.com/en/docs/frameworks/).
- Safe storage: [Server sanitizing](https://editor.vivepdf.com/en/docs/server-sanitizing/) and [Security and CSP](https://editor.vivepdf.com/en/docs/security-and-csp/).
- Images: [Images and uploads](https://editor.vivepdf.com/en/docs/images-and-uploads/).
- Word: [Paste from Office](https://editor.vivepdf.com/en/docs/paste-from-office/) and [Open, save and print](https://editor.vivepdf.com/en/docs/open-save-print/).
- Extras: [Mentions](https://editor.vivepdf.com/en/docs/mentions/), [Formulas](https://editor.vivepdf.com/en/docs/formulas/) and [AI assistant](https://editor.vivepdf.com/en/docs/ai-assistant/).
- Keyboard and screen readers: [Accessibility](https://editor.vivepdf.com/en/docs/accessibility/).
- Updates: [Versioning](https://editor.vivepdf.com/en/docs/versioning/).
- Something not working: [Troubleshooting](https://editor.vivepdf.com/en/docs/troubleshooting/).

If your question is not here, search the [issues on GitHub](https://github.com/mtvrkan/viveeditor/issues) or open a new one. Report security problems privately, as described on [Security and CSP](https://editor.vivepdf.com/en/docs/security-and-csp/).

## Is viveEditor free?

Yes. viveEditor is open source under the MIT licence. Image uploads, tables, embeds and Word import and export are all included; there is no paid tier.

## Do I need a build step?

No. One stylesheet, one script and a textarea with the data-editor attribute are enough. If you use a bundler, install the viveeditor package from npm instead.

## Which frameworks are supported?

There are components for React 18 and 19, Vue 3.5, Svelte 5 and Angular 21 and 22. The vive-editor custom element works as a form field on any other page.

## Can I store the HTML the editor sends as it is?

No. The editor only produces a known set of HTML, but anyone can post any HTML to your server. Clean it there with @viveeditor/sanitize for Node or viveeditor/sanitizer for PHP before you store or show it.

## Can writers upload images?

Yes, once you give the Image extension your own upload function. The editor checks every file and address, but your server must still re-validate and re-encode each upload.

## Does it work with Word?

Yes. Paste from Word, Google Docs and LibreOffice keeps real nested lists, and the File menu opens and saves .docx files. The older .doc, .odt and .rtf formats are not supported.

## Which languages does the interface speak?

Turkish and English. Choose one with the locale option; without it, the editor follows the page's lang attribute and then the browser language.

## Are mentions, emoji, formulas and the AI assistant in the CDN script?

No. Mentions, emoji, formulas, footnotes, templates and the AI assistant ship as npm packages only and plug into the toolbar through @viveeditor/ui/extras.

## Does viveEditor send my text to an AI service?

No. viveEditor sends nothing anywhere itself. The AI assistant calls only the provider function you write, which should call your own server.

## Is it accessible?

viveEditor targets WCAG 2.2 AA, with full keyboard control and screen reader announcements. Every editor still needs a label from you.

## Will an update break my stored content?

No. HTML and JSON saved by any 0.x version stay readable by every later 0.x version. The API itself can still change in a minor version before 1.0.

## Is there a Laravel package?

Yes. viveeditor/laravel works with Laravel 12 or newer and PHP 8.4 or newer. It adds a Blade component, serves the editor files from your own site and includes the PHP sanitizer.
