import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

interface Case {
  name: string
  expected: string
}

const cases = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/sanitize/cases.json', import.meta.url)), 'utf8'),
) as Case[]
const kitchenSink = readFileSync(
  fileURLToPath(new URL('../fixtures/sanitize/kitchen-sink.html', import.meta.url)),
  'utf8',
)

const ALLOWED = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'hr',
  'br',
  'strong',
  'em',
  'u',
  's',
  'code',
  'a',
  'ul',
  'ol',
  'li',
  'input',
  'div',
  'pre',
  'table',
  'colgroup',
  'col',
  'tbody',
  'tr',
  'td',
  'th',
  'span',
  'mark',
  'sup',
  'img',
  'iframe',
]

const PAGE = `<!doctype html><html lang="tr"><head><meta charset="utf-8"></head><body><main>${cases
  .map((item) => `<section>${item.expected}</section>`)
  .join('')}</main></body></html>`

test('sanitized output runs no script and keeps only allowed elements in the browser', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const record = (): void => {
      Reflect.set(window, 'xssFired', (Number(Reflect.get(window, 'xssFired')) || 0) + 1)
    }
    window.alert = record
    Reflect.set(window, 'msgbox', record)
  })
  await page.route('**/*', (route) => route.abort())

  await page.setContent(PAGE)
  await page.waitForTimeout(300)

  const report = await page.evaluate((allowed) => {
    const elements = [...document.querySelectorAll('main *')]
    return {
      fired: Number(Reflect.get(window, 'xssFired')) || 0,
      unknown: elements
        .map((element) => element.localName)
        .filter((name) => name !== 'section' && !allowed.includes(name)),
      handlers: elements.flatMap((element) =>
        [...element.attributes]
          .filter((attribute) => attribute.name.startsWith('on'))
          .map((attribute) => attribute.name),
      ),
      foreign: elements.filter((element) => element.namespaceURI !== 'http://www.w3.org/1999/xhtml')
        .length,
    }
  }, ALLOWED)

  expect(report).toEqual({ fired: 0, unknown: [], handlers: [], foreign: 0 })
})

test('the kitchen-sink document keeps its structure in the browser', async ({ page }) => {
  await page.route('**/*', (route) => route.abort())

  await page.setContent(`<!doctype html><html><body><main>${kitchenSink}</main></body></html>`)

  await expect(page.locator('main iframe')).toHaveCount(4)
  await expect(page.locator('main input[type="checkbox"][disabled]')).toHaveCount(2)
  await expect(page.locator('main table th[colspan="2"]')).toHaveCount(1)
})
