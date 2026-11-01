import type { UiTheme } from '@viveeditor/ui'

export function siteTheme(): UiTheme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function followSiteTheme(root: HTMLElement): () => void {
  const sync = () => {
    root.dataset.theme = siteTheme()
  }
  addEventListener('ve:theme', sync)
  return () => removeEventListener('ve:theme', sync)
}
