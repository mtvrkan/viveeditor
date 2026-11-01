# Templates

> Offer ready-made content blocks in the slash menu with templateMenu; every template goes through the editor schema before it lands.

URL: https://editor.vivepdf.com/en/docs/templates/
Last updated: 2026-11-01

Templates give writers a quick start: a memo layout, a meeting note, a product page skeleton. `templateMenu` adds one entry per template to the `/` menu, and picking it inserts the template's content at the cursor.

Templates ship as an npm package only. The one-script build does not include them.

## Set it up

1. Install the UI: `npm install @viveeditor/ui @viveeditor/core`.
2. Write your templates as a list of entries.
3. Pass the list to `templateMenu` and add it to the `plugins` of `createUI`.

```ts
import { createUI } from '@viveeditor/ui'
import { type Template, templateMenu } from '@viveeditor/ui/extras'

const templates: Template[] = [
  {
    id: 'memo',
    label: 'Memo',
    description: 'Subject, summary and next steps',
    content: '<h2>Subject</h2><p></p><h3>Next steps</h3><ul><li><p></p></li></ul>',
  },
  {
    id: 'meeting',
    label: 'Meeting notes',
    content: '<h2>Meeting notes</h2><p><strong>Attendees:</strong> </p><p></p>',
  },
]

createUI(editor, { plugins: [templateMenu(templates)] })
```

## Template entries

| Field | Meaning |
| --- | --- |
| `id` | A unique name for the entry. |
| `label` | The text shown in the `/` menu, after "Template:". |
| `description` | Optional. Extra words the menu search matches. |
| `content` | The content to insert, as an HTML string or as editor JSON. |

The menu search also matches the label and the words "template" and "sablon". The second argument of `templateMenu` overrides menu labels, for example `templateMenu(templates, { template: 'Layout' })`.

When the editor is read-only, picking a template inserts nothing.

## Schema filtering

Template content goes through the editor schema, the same way as pasted content. Anything the schema does not know is dropped: scripts, event handlers, unknown elements and attributes. A template can only use the blocks and formatting the editor has extensions for. If a template has a table but the table extension is not loaded, it is not kept as a table.

## Size limit

A template whose HTML is over 2 MB is skipped and does not appear in the menu.

## Trust

The schema removes unsafe markup, but it cannot judge the words and links in a template. Only offer templates you wrote or trust. If writers can create templates for each other, store them through [the server sanitizer](https://editor.vivepdf.com/en/docs/server-sanitizing/) and check who may publish a template for whom.

## Related pages

- [Toolbar and shortcuts](https://editor.vivepdf.com/en/docs/toolbar-and-shortcuts/)
- [Server sanitizing](https://editor.vivepdf.com/en/docs/server-sanitizing/)

## Can a template carry scripts or custom markup?

No. Template content goes through the editor schema like pasted content, so scripts and unknown markup are dropped.

## Is there a size limit?

Yes. Templates over 2 MB are skipped and do not appear in the menu.
