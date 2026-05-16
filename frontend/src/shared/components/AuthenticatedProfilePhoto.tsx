import { useEffect, useRef, useState, type ReactNode } from 'react'

import { apiGetBlob } from '../api/client'

export type AuthenticatedProfilePhotoProps = {
  /** Ruta relativa del API, p. ej. `/api/uploads/profiles/uuid.jpg` (puede incluir `?v=` para bust). */
  path: string | null | undefined
  alt?: string
  className?: string
  /** Mientras carga o si falla la petición autenticada. */
  fallback: ReactNode
}

/**
 * Las etiquetas `<img src="/api/...">` no envían `Authorization`; este componente descarga la imagen con el cliente API
 * y la muestra vía object URL.
 */
export function AuthenticatedProfilePhoto({
  path,
  alt = '',
  className = '',
  fallback,
}: AuthenticatedProfilePhotoProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    setFailed(false)

    const revokeCurrent = () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }

    revokeCurrent()

    const trimmed = path?.trim()
    if (!trimmed) {
      setObjectUrl(null)
      return
    }
    if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
      setObjectUrl(trimmed)
      return () => {
        setObjectUrl(null)
      }
    }

    let cancelled = false

    void apiGetBlob(trimmed)
      .then((blob) => {
        if (cancelled) return
        revokeCurrent()
        const u = URL.createObjectURL(blob)
        objectUrlRef.current = u
        setObjectUrl(u)
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true)
          revokeCurrent()
          setObjectUrl(null)
        }
      })

    return () => {
      cancelled = true
      revokeCurrent()
      setObjectUrl(null)
    }
  }, [path])

  if (!path?.trim() || failed) {
    return <>{fallback}</>
  }

  if (!objectUrl) {
    return <>{fallback}</>
  }

  return <img src={objectUrl} alt={alt} className={className} />
}
