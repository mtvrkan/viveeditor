import { Component, signal } from '@angular/core'
import { type ComponentFixture, TestBed } from '@angular/core/testing'
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { ViveEditorComponent } from '@viveeditor/angular'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Editor } from 'viveeditor'

@Component({
  imports: [ViveEditorComponent, ReactiveFormsModule],
  template: `<vive-ng-editor [formControl]="control" locale="tr" (ready)="onReady($event)" />`,
})
class ReactiveHost {
  readonly control: FormControl<string | null> = new FormControl('<p>Merhaba</p>')
  readonly onReady: (editor: Editor) => void = vi.fn()
}

@Component({
  imports: [ViveEditorComponent, FormsModule],
  template: `<vive-ng-editor [(ngModel)]="text" [readonly]="locked()" (ready)="onReady($event)" />`,
})
class ModelHost {
  text = '<p>a</p>'
  readonly locked: ReturnType<typeof signal<boolean>> = signal(false)
  readonly onReady: (editor: Editor) => void = vi.fn()
}

async function create<T extends { onReady: (editor: Editor) => void }>(
  host: new () => T,
): Promise<{ fixture: ComponentFixture<T>; editor: Editor }> {
  const fixture = TestBed.createComponent(host)
  await fixture.whenStable()
  const onReady = vi.mocked(fixture.componentInstance.onReady)
  await vi.waitFor(() => expect(onReady).toHaveBeenCalled())
  const editor = onReady.mock.calls[0]?.[0]
  if (!editor) throw new Error('Missing editor')
  await fixture.whenStable()
  return { fixture, editor }
}

const content = (fixture: ComponentFixture<unknown>): Element | null =>
  (fixture.nativeElement as HTMLElement).querySelector('.vive-content')

afterEach(() => {
  TestBed.resetTestingModule()
})

describe('ViveEditorComponent', () => {
  it('starts from the form control value with the toolbar', async () => {
    const { fixture } = await create(ReactiveHost)

    const root = fixture.nativeElement as HTMLElement

    expect(root.querySelectorAll('.vive-content')).toHaveLength(1)
    expect(root.querySelector('[role="toolbar"]')).not.toBeNull()
    expect(content(fixture)?.innerHTML).toBe('<p>Merhaba</p>')
  })

  it('writes typed text back into the form control and marks it touched on blur', async () => {
    const { fixture, editor } = await create(ReactiveHost)

    editor.setContent('<p>yeni</p>')
    editor.dom.dispatchEvent(new FocusEvent('blur'))

    expect(fixture.componentInstance.control.value).toBe('<p>yeni</p>')
    expect(fixture.componentInstance.control.touched).toBe(true)
  })

  it('follows a value set on the control without marking it dirty', async () => {
    const { fixture } = await create(ReactiveHost)

    fixture.componentInstance.control.setValue('<p>dışarıdan</p>')

    expect(content(fixture)?.innerHTML).toBe('<p>dışarıdan</p>')
    expect(fixture.componentInstance.control.dirty).toBe(false)
  })

  it('stops editing when the control is disabled', async () => {
    const { fixture, editor } = await create(ReactiveHost)

    fixture.componentInstance.control.disable()
    await fixture.whenStable()

    expect(editor.isEditable).toBe(false)
  })

  it('keeps ngModel in step and honours readonly', async () => {
    const { fixture, editor } = await create(ModelHost)

    editor.setContent('<p>b</p>')
    fixture.componentInstance.locked.set(true)
    await fixture.whenStable()

    expect(fixture.componentInstance.text).toBe('<p>b</p>')
    expect(editor.isEditable).toBe(false)
  })

  it('destroys the editor with the component', async () => {
    const { fixture, editor } = await create(ReactiveHost)

    fixture.destroy()

    expect(editor.isDestroyed).toBe(true)
  })
})
