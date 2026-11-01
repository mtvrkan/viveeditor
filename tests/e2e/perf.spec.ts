import { expect, type Page, test } from '@playwright/test'
import { articleHtml, tableHtml, wordPasteHtml } from '../../scripts/perf-doc.mjs'

const BUDGET = {
  loadMs: 1500,
  typingP95Ms: 50,
  pasteMs: 1000,
  exportMs: 2000,
  refreshMs: 16,
  pauseTaskMs: 50,
}

const KEYSTROKES = 60
const UNREPORTED_EVENT_MS = 16

interface PerfApi {
  loadMs: number
  documentSize(): number
  paste(html: string): Promise<number>
  refreshTimes(samples: number): number[]
  markdownMs(): Promise<number>
  docxMs(): Promise<number>
}

interface PerfWindow {
  perf: PerfApi
  perfContent?: string
  perfEvents?: { id: number; duration: number }[]
  perfTasks?: number[]
  viveEditor: {
    dom: HTMLElement
    focus(): void
    getText(): string
    commands: { setTextSelection(from: number): boolean }
  }
}

test.skip(!process.env.PERF, 'set PERF=1 to run the performance budgets')

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'performance budgets are measured in Chromium only')
})

const percentile = (values: readonly number[], rank: number): number => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.ceil((rank / 100) * sorted.length) - 1)] ?? 0
}

function report(name: string, value: number, budget: number): void {
  const line = `${name}: ${value.toFixed(1)} ms (budget ${budget} ms)`
  test.info().annotations.push({ type: 'perf', description: line })
  console.log(line)
}

const CPU_SLOWDOWN = Number(process.env.PERF_CPU) || 1

async function openWith(page: Page, content: string): Promise<void> {
  if (CPU_SLOWDOWN > 1) {
    const session = await page.context().newCDPSession(page)
    await session.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN })
  }
  await page.addInitScript((html) => {
    ;(window as unknown as PerfWindow).perfContent = html
  }, content)
  await page.goto('/perf.html')
  await expect(page.locator('body[data-ready="true"]')).toBeAttached({ timeout: 30_000 })
}

async function typingDurations(page: Page, fraction: number): Promise<number[]> {
  await page.evaluate((at) => {
    const target = window as unknown as PerfWindow
    target.perfEvents = []
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEventTiming[]) {
        if (entry.interactionId) {
          target.perfEvents?.push({ id: entry.interactionId, duration: entry.duration })
        }
      }
    }).observe({ type: 'event', durationThreshold: 16 } as PerformanceObserverInit)
    target.viveEditor.focus()
    target.viveEditor.commands.setTextSelection(Math.floor(target.perf.documentSize() * at))
  }, fraction)

  await page.keyboard.type('hızlı yazı testi '.repeat(4).slice(0, KEYSTROKES), { delay: 40 })
  await page.waitForTimeout(300)

  const events = await page.evaluate(() => (window as unknown as PerfWindow).perfEvents ?? [])
  const slowest = new Map<number, number>()
  for (const { id, duration } of events) slowest.set(id, Math.max(slowest.get(id) ?? 0, duration))
  const reported = [...slowest.values()]
  const unreported = Math.max(0, KEYSTROKES - reported.length)
  return [...reported, ...Array.from({ length: unreported }, () => UNREPORTED_EVENT_MS)]
}

const textLength = (page: Page) =>
  page.evaluate(() => (window as unknown as PerfWindow).viveEditor.getText().length)

const perf = (page: Page) => ({
  loadMs: () => page.evaluate(() => (window as unknown as PerfWindow).perf.loadMs),
  markdownMs: () => page.evaluate(() => (window as unknown as PerfWindow).perf.markdownMs()),
  docxMs: () => page.evaluate(() => (window as unknown as PerfWindow).perf.docxMs()),
  refreshTimes: (samples: number) =>
    page.evaluate((count) => (window as unknown as PerfWindow).perf.refreshTimes(count), samples),
  paste: (html: string) =>
    page.evaluate((data) => (window as unknown as PerfWindow).perf.paste(data), html),
})

test('loads a 1 MB article within budget', async ({ page }) => {
  await openWith(page, articleHtml())

  const loadMs = await perf(page).loadMs()

  report('load 1 MB article', loadMs, BUDGET.loadMs)
  expect(await textLength(page)).toBeGreaterThan(500_000)
  expect(loadMs).toBeLessThan(BUDGET.loadMs)
})

test('keeps typing latency in a 1 MB article within budget', async ({ page }) => {
  await openWith(page, articleHtml())

  const durations = await typingDurations(page, 0.5)

  const p95 = percentile(durations, 95)
  report('typing p95 in 1 MB article', p95, BUDGET.typingP95Ms)
  await expect(page.getByTestId('perf-editor')).toContainText('hızlı yazı testi')
  expect(p95).toBeLessThan(BUDGET.typingP95Ms)
})

test('loads a 200 row table and types in it within budget', async ({ page }) => {
  await openWith(page, tableHtml())
  const loadMs = await perf(page).loadMs()

  const durations = await typingDurations(page, 0.5)

  const p95 = percentile(durations, 95)
  report('load 200 row table', loadMs, BUDGET.loadMs)
  report('typing p95 in 200 row table', p95, BUDGET.typingP95Ms)
  await expect(page.getByTestId('perf-editor').locator('tr')).toHaveCount(201)
  await expect(page.getByTestId('perf-editor')).toContainText('hızlı yazı testi')
  expect(loadMs).toBeLessThan(BUDGET.loadMs)
  expect(p95).toBeLessThan(BUDGET.typingP95Ms)
})

test('pastes 500 KB of Word HTML within budget', async ({ page }) => {
  await openWith(page, '')

  const pasteMs = await perf(page).paste(wordPasteHtml())

  report('paste 500 KB Word HTML', pasteMs, BUDGET.pasteMs)
  expect(await textLength(page)).toBeGreaterThan(100_000)
  expect(pasteMs).toBeLessThan(BUDGET.pasteMs)
})

test('exports a 1 MB article to Markdown and Word within budget', async ({ page }) => {
  await openWith(page, articleHtml())

  const markdownMs = await perf(page).markdownMs()
  const docxMs = await perf(page).docxMs()

  report('Markdown export of 1 MB article', markdownMs, BUDGET.exportMs)
  report('Word export of 1 MB article', docxMs, BUDGET.exportMs)
  expect(markdownMs).toBeLessThan(BUDGET.exportMs)
  expect(docxMs).toBeLessThan(BUDGET.exportMs)
})

test('refreshes the toolbar within one frame in a 1 MB article', async ({ page }) => {
  await openWith(page, articleHtml())

  const times = await perf(page).refreshTimes(40)

  const p95 = percentile(times, 95)
  report('toolbar refresh p95 in 1 MB article', p95, BUDGET.refreshMs)
  expect(p95).toBeLessThan(BUDGET.refreshMs)
})

test('updates the word count after typing pauses without long tasks in a 1 MB article', async ({
  page,
}) => {
  await openWith(page, articleHtml())
  await page.evaluate(() => {
    const target = window as unknown as PerfWindow
    target.perfTasks = []
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) target.perfTasks?.push(entry.duration)
    }).observe({ type: 'longtask' })
    target.viveEditor.focus()
    target.viveEditor.commands.setTextSelection(Math.floor(target.perf.documentSize() / 2))
  })
  const counter = page.getByRole('button', { name: /kelime\. Metin ölçümü$/ })
  const before = await counter.getAttribute('aria-label')

  for (const word of ['bir ', 'iki ', 'üç ', 'dört ', 'beş ']) {
    await page.keyboard.type(word)
    await page.waitForTimeout(250)
  }

  await expect(counter).not.toHaveAttribute('aria-label', before ?? '')
  const tasks = await page.evaluate(() => (window as unknown as PerfWindow).perfTasks ?? [])
  const longest = Math.max(0, ...tasks)
  report('longest task while typing with pauses', longest, BUDGET.pauseTaskMs)
  expect(longest).toBeLessThan(BUDGET.pauseTaskMs)
})
