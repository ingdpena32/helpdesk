/** Añade query `v` para forzar recarga de la imagen cuando cambia el bust (p. ej. nueva foto). */
export function withPhotoCacheBust(url: string | null | undefined, bust?: number | null): string | null {
  if (!url?.trim()) return null
  const u = url.trim()
  if (bust == null || bust === 0) return u
  const sep = u.includes('?') ? '&' : '?'
  return `${u}${sep}v=${bust}`
}
