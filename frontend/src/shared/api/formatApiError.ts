/** Extrae mensaje legible de errores API (JSON {"error":"..."} o texto plano). */
export function formatApiError(err: unknown): string | null {
  if (!err) return null
  const msg = err instanceof Error ? err.message : String(err)
  try {
    const parsed = JSON.parse(msg) as { error?: string }
    if (typeof parsed.error === 'string' && parsed.error.trim()) {
      return parsed.error.trim()
    }
  } catch {
    /* no es JSON */
  }
  return msg || null
}
