import '@angular/compiler'
import { Component, provideZonelessChangeDetection, signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { FormControl, ReactiveFormsModule } from '@angular/forms'
import { bootstrapApplication } from '@angular/platform-browser'
import { ViveEditorComponent } from '@viveeditor/angular'
import { LABEL, SAMPLE_VALUE, START_VALUE } from './page.js'

@Component({
  selector: 'vive-angular-demo',
  imports: [ViveEditorComponent, ReactiveFormsModule],
  template: `
    <header class="site">
      <strong>Angular bileşeni</strong>
      <button type="button" class="action" data-testid="set-value" (click)="load()">
        Örnek metni yükle
      </button>
    </header>
    <vive-ng-editor
      data-testid="editor"
      [formControl]="control"
      locale="tr"
      [label]="label"
      [readonly]="locked()"
    />
    <label class="toggle">
      <input type="checkbox" [checked]="locked()" (change)="locked.set(!locked())" />
      Salt okunur
    </label>
    <h2 class="output-title">Bağlı değer</h2>
    <pre class="output" data-testid="output" aria-live="polite">{{ value() }}</pre>
  `,
})
class AngularDemo {
  readonly label = LABEL
  readonly control = new FormControl(START_VALUE)
  readonly value = toSignal(this.control.valueChanges, { initialValue: START_VALUE })
  readonly locked = signal(false)

  load(): void {
    this.control.setValue(SAMPLE_VALUE)
  }
}

bootstrapApplication(AngularDemo, { providers: [provideZonelessChangeDetection()] }).catch(
  (error: unknown) => console.error(error),
)
