function SettingsPage() {
  return (
    <section className="space-y-10">
      <div>
        <h2 className="font-architectural text-4xl font-extrabold tracking-tight text-on-surface">Ajustes</h2>
        <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-on-surface-variant">
          Preferencias de la aplicación. Las secciones aparecerán cuando exista configuración guardada.
        </p>
      </div>

      <div className="dashboard-panel p-8">
        <p className="text-sm text-on-surface-variant">Sin secciones de ajustes por ahora.</p>
      </div>
    </section>
  )
}

export default SettingsPage
