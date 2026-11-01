import type { DemoConfig } from './demo'

function copyButtons() {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy]')) {
    button.addEventListener('click', async () => {
      const status =
        button.parentElement?.querySelector<HTMLElement>('.copy-state') ??
        button.querySelector<HTMLElement>('span')
      try {
        await navigator.clipboard.writeText(button.dataset.copy ?? '')
      } catch {
        return
      }
      if (!status) return
      const before = status.textContent
      status.textContent = button.dataset.copied ?? ''
      button.dataset.done = ''
      setTimeout(() => {
        status.textContent = status.classList.contains('copy-state') ? '' : before
        delete button.dataset.done
      }, 1600)
    })
  }
}

function tabs() {
  for (const list of document.querySelectorAll<HTMLElement>('[role="tablist"]')) {
    const items = [...list.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
    const select = (tab: HTMLButtonElement, focus: boolean) => {
      for (const item of items) {
        const active = item === tab
        item.setAttribute('aria-selected', String(active))
        item.tabIndex = active ? 0 : -1
        const panel = document.getElementById(item.getAttribute('aria-controls') ?? '')
        if (panel) panel.hidden = !active
      }
      if (focus) tab.focus()
    }
    list.addEventListener('click', (event) => {
      const tab = (event.target as Element).closest<HTMLButtonElement>('[role="tab"]')
      if (tab) select(tab, false)
    })
    list.addEventListener('keydown', (event) => {
      const index = items.indexOf(document.activeElement as HTMLButtonElement)
      if (index < 0) return
      const keys: Record<string, number> = {
        ArrowRight: index + 1,
        ArrowLeft: index - 1,
        Home: 0,
        End: items.length - 1,
      }
      const next = keys[event.key]
      if (next === undefined) return
      event.preventDefault()
      const tab = items[(next + items.length) % items.length]
      if (tab) select(tab, true)
    })
  }
}

function whenIdle(run: () => void) {
  if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2500 })
  else setTimeout(run, 1200)
}

function hero() {
  const stage = document.querySelector<HTMLElement>('[data-hero-stage]')
  if (!stage) return
  whenIdle(() => {
    import('./hero-editor').then(({ mountHero }) => mountHero(stage)).catch(() => {})
  })
}

function demo() {
  const root = document.querySelector<HTMLElement>('[data-demo]')
  if (!root) return
  const config = JSON.parse(root.dataset.config ?? '{}') as DemoConfig
  const start = async () => {
    if (root.dataset.state === 'loading' || root.dataset.state === 'ready') return
    root.dataset.state = 'loading'
    try {
      const { mountDemo } = await import('./demo')
      await mountDemo(root, config)
      root.dataset.state = 'ready'
    } catch {
      root.dataset.state = 'error'
    }
  }
  root.querySelector('[data-demo-retry]')?.addEventListener('click', start)
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      start()
    },
    { rootMargin: '600px 0px' },
  )
  whenIdle(() => observer.observe(root))
}

copyButtons()
tabs()
hero()
demo()
