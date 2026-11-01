import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

const SITE = 'http://localhost:4174'
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

test.use({ baseURL: SITE, locale: 'en-US' })

test.beforeEach(async ({ page, browserName }) => {
  if (browserName !== 'webkit' || process.platform !== 'linux') return
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 2 })
  })
})

async function watchCsp(page: Page): Promise<string[]> {
  const violations: string[] = []
  await page.exposeFunction('reportCspViolation', (entry: string) => violations.push(entry))
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (event) => {
      const report = (window as unknown as { reportCspViolation(entry: string): void })
        .reportCspViolation
      report(`${event.violatedDirective} ${event.blockedURI}`)
    })
  })
  return violations
}

async function expectNoAxeViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  const summary = violations.map((violation) => ({
    rule: violation.id,
    targets: violation.nodes.map((node) => node.target.join(' ')).slice(0, 5),
    detail: violation.nodes[0]?.failureSummary,
  }))
  expect(summary).toEqual([])
}

async function openDemo(page: Page) {
  const demo = page.locator('[data-demo]')
  await demo.scrollIntoViewIfNeeded()
  await expect(demo).toHaveAttribute('data-state', 'ready', { timeout: 20_000 })
  return demo
}

test.describe('site home', () => {
  test('opens in English at the root with a live readability score', async ({ page }) => {
    const csp = await watchCsp(page)

    await page.goto('/')

    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.locator('.num[data-k="score"]')).toHaveText(/^\d+$/)
    expect(csp).toEqual([])
  })

  test('sends a Turkish browser to the Turkish home page', async ({ browser }) => {
    const context = await browser.newContext({ locale: 'tr-TR' })
    const page = await context.newPage()

    await page.goto(`${SITE}/`)

    await expect(page).toHaveURL(`${SITE}/tr/`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
    await context.close()
  })

  test('re-scores the hero text as the visitor types', async ({ page }) => {
    await page.goto('/')
    const editor = page.locator('[data-hero-editor] [contenteditable="true"]')
    await expect(editor).toBeVisible({ timeout: 15_000 })
    const words = page.locator('.stats [data-k="words"]')
    const before = await words.textContent()

    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' One more short line here.')

    await expect(words).not.toHaveText(before ?? '')
  })
})

test.describe('site demo', () => {
  test('loads every extra and writes clean HTML', async ({ page }) => {
    const csp = await watchCsp(page)
    await page.goto('/')
    const demo = await openDemo(page)

    await expect(demo.locator('.katex').first()).toBeVisible()
    await expect(demo.locator('table')).toBeVisible()
    await demo.getByRole('heading', { name: 'Weekly newsletter' }).click()
    await page.keyboard.press('ControlOrMeta+b')
    await page.keyboard.type('Bold from the test')
    await demo.getByRole('button', { name: 'Show HTML' }).click()

    const html = demo.locator('[data-demo-output]')
    await expect(html).toContainText('<strong>Bold from the test</strong>')
    await expect(html).not.toContainText('<script')
    expect(csp).toEqual([])
  })

  test('reset brings back the starting article', async ({ page }) => {
    await page.goto('/')
    const demo = await openDemo(page)
    const editor = demo.getByRole('textbox', { name: 'Demo editor' })
    await demo.getByRole('heading', { name: 'Weekly newsletter' }).click()
    await page.keyboard.type('Zqx')
    await expect(editor).toContainText('Zqx')

    await demo.getByRole('button', { name: 'Reset' }).click()

    await expect(editor).not.toContainText('Zqx')
    await expect(demo.getByRole('heading', { name: 'Weekly newsletter' })).toBeVisible()
  })
})

test.describe('site docs', () => {
  test('finds a page through search', async ({ page }) => {
    const csp = await watchCsp(page)
    await page.goto('/en/docs/')

    await page.locator('[data-search-open]:visible').first().click()
    await page.locator('#dsInput').fill('table')

    await expect(page.locator('#dsList li').first()).toBeVisible({ timeout: 10_000 })
    expect(csp).toEqual([])
  })

  test('serves a Markdown copy next to each page', async ({ request }) => {
    const response = await request.get(`${SITE}/llms.txt`)

    expect(response.ok()).toBe(true)
    expect(await response.text()).toMatch(/^# viveEditor/)
  })
})

test.describe('site accessibility', () => {
  for (const theme of ['light', 'dark'] as const)
    for (const path of ['/', '/tr/', '/en/docs/'])
      test(`${path} passes WCAG 2.2 AA in the ${theme} theme`, async ({ page }) => {
        await page.goto(`${path}?theme=${theme}&still`)
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

        await expectNoAxeViolations(page)
      })
})
