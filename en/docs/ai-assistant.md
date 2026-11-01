# AI assistant

> Connect the AI assistant to your own server through a provider function; answers are shown and inserted as plain text.

URL: https://editor.vivepdf.com/en/docs/ai-assistant/
Last updated: 2026-11-01

The AI assistant gives writers actions such as "Improve writing" or "Summarize" on selected text. viveEditor provides the panel and the rules for showing and inserting answers. It sends nothing anywhere itself: you pass a provider function that calls your own server, and your server talks to the AI service.

The AI assistant ships as an npm package only. The one-script build does not include it.

## Set it up

1. Install the UI: `npm install @viveeditor/ui @viveeditor/core`.
2. Write a `generate` function that sends the request to your own endpoint.
3. Add `aiAssistant` to the `plugins` of `createUI`.

```ts
import { createUI } from '@viveeditor/ui'
import { type AiRequest, aiAssistant } from '@viveeditor/ui/extras'

async function generate(request: AiRequest): Promise<string> {
  const response = await fetch('/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({
      action: request.action,
      instruction: request.instruction,
      text: request.text,
      context: request.context,
      locale: request.locale,
    }),
    signal: request.signal,
  })
  if (!response.ok) throw new Error('AI request failed')
  const { text } = await response.json()
  return text
}

createUI(editor, { plugins: [aiAssistant({ provider: { generate } })] })
```

`/ai` is a placeholder for your own endpoint, and `csrfToken` is the token your site already uses. The response shape is up to you.

## Opening the assistant

- Select text and press the AI button in the selection bubble.
- Press `Ctrl+J` (`⌘+J` on a Mac).
- Type `/ai` and pick "AI" from the `/` menu.

The panel lists the actions, a field for a custom instruction and, once an answer arrives, the buttons Replace selection, Insert below, Try again and Discard. Stop ends a running request and `Esc` closes the panel.

## The provider contract

`provider.generate(request)` returns either a promise of a string or an async iterable of strings. Return an async iterable to stream the answer as it arrives.

| Field | Meaning |
| --- | --- |
| `action` | `improve`, `fix`, `shorten`, `expand`, `tone`, `translate`, `summarize`, `continue`, or `custom` for a typed instruction. |
| `instruction` | The writer's own instruction, only for `custom`. |
| `text` | The selected text. |
| `context` | `before` and `after`: up to 2,000 characters of text on each side of the selection. |
| `locale` | The editor's language, `tr` or `en`. |
| `signal` | An `AbortSignal`. Pass it to `fetch`; it fires when the writer stops, closes the panel or the time limit is reached. |

The `actions` option chooses which actions the panel shows and in what order, for example `actions: ['fix', 'shorten', 'summarize']`. "Continue writing" and a custom instruction work without a selection; the other actions need selected text.

A streaming provider can read the response body piece by piece:

```ts
import type { AiRequest } from '@viveeditor/ui/extras'

async function* stream(request: AiRequest): AsyncIterable<string> {
  const response = await fetch('/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify({ action: request.action, text: request.text }),
    signal: request.signal,
  })
  if (!response.ok || !response.body) throw new Error('AI request failed')
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return
    yield value
  }
}
```

## Limits

| Limit | Value |
| --- | --- |
| Selected text | 20,000 characters; a longer selection is not sent and the panel asks for a shorter one |
| Context | 2,000 characters on each side |
| Custom instruction | 1,000 characters |
| Answer | 20,000 characters; the rest is cut off |
| Time | 2 minutes per request, then it is stopped |

Only one request runs at a time. Starting a new one cancels the last, and pieces that arrive late are dropped.

## How answers are inserted

The AI answer is untrusted text. It is shown in the panel as plain text and inserted as plain paragraphs, never as HTML. Nothing changes in the document until the writer picks Replace selection or Insert below, and one undo removes it. If the selected text changed while the answer was being written, Replace selection is turned off and the answer can only be inserted below.

If you want headings and lists from the answer, the `markdown` option takes a loader for a Markdown renderer. Its HTML loses images, media and scripts, and also links unless you pass `links: true`, and then goes through the editor schema:

```ts
import { aiAssistant } from '@viveeditor/ui/extras'

aiAssistant({
  provider: { generate },
  markdown: async () => (await import('@viveeditor/markdown')).markdownToHtml,
})
```

## AI server checklist

The provider should call your own endpoint, never an AI vendor directly from the browser.

- Keep the API key on the server. Require a signed-in session and a CSRF token.
- Fix the system prompt, the model and `max_tokens` on the server. Accept only the actions you allow and limit the input size again.
- Set a quota and rate limit per user, and a spending cap at the AI vendor.
- Keep document text out of your logs, or mask it. Tell writers that their text is sent to a third party, as your privacy rules (KVKK, GDPR) require.
- If you later give the model tools or retrieval, prompt injection from the document becomes a serious risk; review that design separately.

## Related pages

- [Security and CSP](https://editor.vivepdf.com/en/docs/security-and-csp/)
- [Toolbar and shortcuts](https://editor.vivepdf.com/en/docs/toolbar-and-shortcuts/)

## Which AI service does viveEditor use?

None. viveEditor sends nothing anywhere itself. Your provider function decides where the request goes, and it should go to your own server.

## Can the AI answer change the document without the writer?

No. The answer is shown first, and nothing is applied until the writer chooses Replace selection or Insert below. One undo removes it.
