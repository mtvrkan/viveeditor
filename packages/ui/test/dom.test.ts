import { afterEach, describe, expect, it } from 'vitest'
import { placeInDock, replaceDocked } from '../src/dom.js'

const rect = (top: number, height: number, left = 0, width = 40): DOMRect =>
  ({
    top,
    bottom: top + height,
    left,
    right: left + width,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect

function setup(anchorTop: number, panelHeight: number) {
  const dock = document.createElement('div')
  const anchor = document.createElement('button')
  const panel = document.createElement('div')
  dock.append(anchor, panel)
  document.body.append(dock)
  const anchorBox = { top: anchorTop }
  dock.getBoundingClientRect = () => rect(anchorBox.top - 10, 60, 0, 800)
  anchor.getBoundingClientRect = () => rect(anchorBox.top, 40, 300)
  Object.defineProperty(panel, 'offsetWidth', { value: 340 })
  Object.defineProperty(panel, 'offsetHeight', { value: panelHeight })
  return { dock, anchor, panel, anchorBox }
}

describe('placeInDock', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('opens the panel above the anchor when it fits there', () => {
    const { dock, anchor, panel } = setup(600, 125)

    placeInDock(panel, anchor, dock)

    expect(panel.classList.contains('ve-below')).toBe(false)
    expect(panel.style.maxHeight).toBe('')
  })

  it('never squeezes the panel below a usable height when neither side has room', () => {
    Object.defineProperty(window, 'innerHeight', { value: 200, configurable: true })
    const { dock, anchor, panel } = setup(60, 260)

    placeInDock(panel, anchor, dock)

    expect(panel.classList.contains('ve-below')).toBe(true)
    expect(panel.style.maxHeight).toBe('160px')
  })

  it('places an open panel again once its anchor has moved', () => {
    Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
    const { dock, anchor, panel, anchorBox } = setup(80, 125)
    placeInDock(panel, anchor, dock)
    expect(panel.classList.contains('ve-below')).toBe(true)

    anchorBox.top = 600
    replaceDocked()

    expect(panel.classList.contains('ve-below')).toBe(false)
  })
})
