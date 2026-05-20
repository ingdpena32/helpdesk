type BrandMarkProps = {
  variant?: 'sidebar' | 'login'
}

export function BrandMark({ variant = 'sidebar' }: BrandMarkProps) {
  const imgClass =
    variant === 'login'
      ? 'mx-auto h-20 w-auto max-w-[min(100%,14rem)] object-contain'
      : 'h-11 w-auto max-w-[11.5rem] object-contain'

  if (variant === 'login') {
    return (
      <div className="mb-8 text-center">
        <img src="/logo.png" alt="NexusDesk" className={imgClass} />
        <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          Acceso
        </p>
      </div>
    )
  }

  return (
    <div className="mb-8 px-6">
      <img src="/logo.png" alt="NexusDesk" className={imgClass} />
    </div>
  )
}
