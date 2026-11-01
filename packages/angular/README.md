# @viveeditor/angular

Angular component for viveEditor with ngModel and reactive forms, toolbar and every feature included.

Part of [viveEditor](https://github.com/mtvrkan/viveeditor#readme), a free, open-source rich text editor.

## Install

```sh
npm install @viveeditor/angular viveeditor
```

## Usage

```ts
import { Component } from '@angular/core'
import { FormControl, ReactiveFormsModule } from '@angular/forms'
import { ViveEditorComponent } from '@viveeditor/angular'

@Component({
  selector: 'app-article-form',
  imports: [ViveEditorComponent, ReactiveFormsModule],
  template: `<vive-ng-editor [formControl]="body" locale="tr" label="Article body" />`,
})
export class ArticleForm {
  body = new FormControl('')
}
```

Angular 21 and 22, with `ngModel` or reactive forms. Add `node_modules/viveeditor/dist/viveeditor.css` to the `styles` in `angular.json`.

## License

MIT
