import { useTheme } from '../../../context/ThemeContext'
import { THEME_LABELS, THEME_MODES, type ThemeMode } from '../../../theme/theme'

export default function AppearanceSettings() {
  const { mode, setMode } = useTheme()

  return (
    <div className="dashboard-panel space-y-5 p-8">
      <h3 className="font-architectural text-lg font-bold text-on-surface">Apariencia</h3>

      <div className="max-w-sm space-y-2">
        <label htmlFor="theme-mode" className="block text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Tema
        </label>
        <select
          id="theme-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as ThemeMode)}
          className="w-full rounded-lg border border-overlay/15 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none transition-shadow focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
        >
          {THEME_MODES.map((m) => (
            <option key={m} value={m}>
              {THEME_LABELS[m]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
