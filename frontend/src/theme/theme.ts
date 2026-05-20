export type ThemeMode = 'dark' | 'light'

export const THEME_MODES: ThemeMode[] = ['dark', 'light']

export const DEFAULT_THEME_MODE: ThemeMode = 'dark'

export const THEME_STORAGE_KEY = 'helpdesk_theme'

export const THEME_LABELS: Record<ThemeMode, string> = {
  dark: 'Oscuro',
  light: 'Claro',
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light'
}
