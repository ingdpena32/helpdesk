import type { ThemeMode } from './theme'

export function applyThemeToDocument(mode: ThemeMode): void {
  const body = document.body
  const root = document.documentElement

  for (const cls of ['dark', 'light'] as const) {
    body.classList.toggle(cls, mode === cls)
    root.classList.toggle(cls, mode === cls)
  }

  root.style.colorScheme = mode
}
