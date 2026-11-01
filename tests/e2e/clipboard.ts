import type { Locator } from '@playwright/test'

export async function dispatchPaste(target: Locator, data: Record<string, string>): Promise<void> {
  await target.evaluate((element, entries) => {
    const transfer = new DataTransfer()
    for (const [type, value] of Object.entries(entries)) transfer.setData(type, value)
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: transfer })
    element.dispatchEvent(event)
  }, data)
}
