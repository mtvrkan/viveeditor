import { Editor } from '@viveeditor/core'
import { basicExtensions } from '@viveeditor/ext-basic'
import { listExtensions } from '@viveeditor/ext-list'
import './style.css'

const host = document.querySelector<HTMLElement>('#editor')
const output = document.querySelector<HTMLElement>('[data-testid="output"]')
const toolbar = document.querySelector<HTMLElement>('.toolbar')

if (!host || !output || !toolbar) {
  throw new Error('Playground markup is incomplete.')
}

const editor = await Editor.create(host, {
  extensions: [...basicExtensions, ...listExtensions],
  label: 'Playground içeriği',
  content: '<p>Merhaba <strong>viveEditor</strong>!</p>',
})

const buttons = [...toolbar.querySelectorAll<HTMLButtonElement>('button')]

function parseJson(value: string | undefined): Record<string, unknown> | undefined {
  return value ? (JSON.parse(value) as Record<string, unknown>) : undefined
}

function runCommand(name: string, args: Record<string, unknown> | undefined): void {
  const command = (editor.commands as unknown as Record<string, (arg?: unknown) => boolean>)[name]
  command?.(args)
}

function refreshToolbar(): void {
  for (const button of buttons) {
    const active = button.dataset.active
    if (active) {
      const pressed = editor.isActive(active, parseJson(button.dataset.activeAttrs))
      button.setAttribute('aria-pressed', String(pressed))
    }
  }
}

const render = (): void => {
  output.textContent = editor.getHTML()
}

editor.on('change', render)
editor.on('update', refreshToolbar)
render()
refreshToolbar()

toolbar.addEventListener('mousedown', (event) => {
  if ((event.target as HTMLElement).closest('button')) event.preventDefault()
})

toolbar.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button')
  if (!button) return
  if (button.dataset.action === 'link') {
    if (editor.isActive('link')) {
      editor.commands.unsetLink()
    } else {
      const href = window.prompt('Bağlantı adresi')
      if (href) editor.commands.setLink({ href })
    }
  } else if (button.dataset.command) {
    runCommand(button.dataset.command, parseJson(button.dataset.args))
  }
  editor.focus()
})

Object.assign(window, { viveEditor: editor })
