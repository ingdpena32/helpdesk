import { DEFAULT_THEME_MODE, THEME_STORAGE_KEY, isThemeMode, type ThemeMode } from './theme'

export function getStoredThemeMode(): ThemeMode | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    return isThemeMode(raw) ? raw : null
  } catch {
    return null
  }
}

export function persistThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    /* noop */
  }
}

export function resolveThemeMode(): ThemeMode {
  return getStoredThemeMode() ?? DEFAULT_THEME_MODE
}

export async function fetchUserThemePreference(_userId: number): Promise<ThemeMode | null> {
  return null
}
