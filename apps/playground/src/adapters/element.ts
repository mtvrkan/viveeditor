import { defineViveEditor } from '@viveeditor/element'
import 'viveeditor/style.css'
import '../ui-page.css'

defineViveEditor()

const form = document.querySelector<HTMLFormElement>('[data-testid="form"]')
const output = document.querySelector<HTMLElement>('[data-testid="output"]')
if (!form || !output) throw new Error('Element page markup is incomplete.')

form.addEventListener('submit', (event) => {
  event.preventDefault()
  output.textContent = String(new FormData(form).get('body') ?? '')
  output.dataset.submits = String(Number(output.dataset.submits ?? '0') + 1)
})
