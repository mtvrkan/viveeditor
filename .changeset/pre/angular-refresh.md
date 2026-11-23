---
"@viveeditor/angular": patch
---

The component marks its host for checking when the text changes and when it loses focus, so bindings such as `{{ form.value }}` or `[disabled]="form.invalid"` update while typing in zoneless and OnPush apps, which `ng new` creates by default in Angular 22. Before, a reactive form value shown in the template stopped updating after the first keystroke.
