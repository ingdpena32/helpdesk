/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        /* Nocturnal Architect — alineado a referencia visual */
        surface: '#0b1120',
        'surface-dim': '#0b1120',
        'surface-container': '#1e293b',
        'surface-container-high': '#334155',
        'surface-container-highest': '#475569',
        'surface-container-low': '#111827',
        'surface-container-lowest': '#0f172a',
        primary: '#4fd1c5',
        'primary-container': '#2c7a7b',
        'primary-fixed': '#5eead4',
        secondary: '#94a3b8',
        'secondary-container': '#475569',
        tertiary: '#f6ad55',
        error: '#f87171',
        outline: '#64748b',
        'outline-variant': '#334155',
        'on-surface': '#f8fafc',
        'on-surface-variant': '#94a3b8',
        'on-primary-container': '#f0fdfa',
        'on-secondary-container': '#cbd5e1',
      },
      fontFamily: {
        headline: ['Manrope', 'sans-serif'],
      },
      boxShadow: {
        card: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
        'card-soft': '0 10px 30px -10px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
}
