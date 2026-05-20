import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'

import { ApiError } from '../../../shared/api/client'
import { CATEGORIES_QUERY_KEY } from '../hooks/useCategoriesQuery'
import { createCategory, deleteCategory, updateCategory } from '../services/categoriesApi'
import type { TicketCategoryRecord } from '../types/category.types'
import DeleteCategoryConfirmModal from './DeleteCategoryConfirmModal'

function parseApiError(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback
  try {
    const body = JSON.parse(err.message) as { error?: string }
    if (typeof body.error === 'string') return body.error
  } catch {
    /* no JSON */
  }
  return err.message || fallback
}

type Props = {
  categories: TicketCategoryRecord[]
  loading: boolean
}

export default function CategoryAdminPanel({ categories, loading }: Props) {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TicketCategoryRecord | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY })
    void queryClient.invalidateQueries({ queryKey: ['tickets'] })
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const createMutation = useMutation({
    mutationFn: (name: string) => createCategory({ name }),
    onSuccess: () => {
      setNewName('')
      setCreateError(null)
      invalidate()
    },
    onError: (e) => setCreateError(parseApiError(e, 'No se pudo crear la categoría.')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => updateCategory(id, { name }),
    onSuccess: () => {
      setEditingId(null)
      setEditName('')
      setEditError(null)
      invalidate()
    },
    onError: (e) => setEditError(parseApiError(e, 'No se pudo actualizar la categoría.')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => {
      setDeleteTarget(null)
      setDeleteError(null)
      invalidate()
    },
    onError: (e) => setDeleteError(parseApiError(e, 'No se pudo eliminar la categoría.')),
  })

  function onCreate(e: FormEvent) {
    e.preventDefault()
    setCreateError(null)
    const name = newName.trim()
    if (name.length < 2) {
      setCreateError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    createMutation.mutate(name)
  }

  function startEdit(cat: TicketCategoryRecord) {
    setEditingId(cat.id)
    setEditName(cat.name)
    setEditError(null)
  }

  function onSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (editingId == null) return
    setEditError(null)
    const name = editName.trim()
    if (name.length < 2) {
      setEditError('El nombre debe tener al menos 2 caracteres.')
      return
    }
    updateMutation.mutate({ id: editingId, name })
  }

  return (
    <>
      <DeleteCategoryConfirmModal
        open={!!deleteTarget}
        name={deleteTarget?.name ?? ''}
        loading={deleteMutation.isPending}
        error={deleteError}
        onClose={() => {
          if (!deleteMutation.isPending) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
        onConfirm={() => {
          if (deleteTarget) {
            setDeleteError(null)
            deleteMutation.mutate(deleteTarget.id)
          }
        }}
      />

      <div className="dashboard-panel space-y-6 p-8">
        <div>
          <h3 className="font-architectural text-lg font-bold text-on-surface">Categorías de tickets</h3>
          <p className="mt-2 text-sm text-on-surface-variant">
            Administra el catálogo usado en creación de tickets y en el panel de gestión. Al renombrar una categoría,
            los tickets existentes se actualizan automáticamente.
          </p>
        </div>

        <form onSubmit={onCreate} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant">Nueva categoría</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={80}
              placeholder="Ej. Seguridad"
              className="w-full rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="btn-primary shrink-0 px-5 py-2.5 text-sm"
          >
            {createMutation.isPending ? 'Creando…' : 'Crear'}
          </button>
        </form>
        {createError ? (
          <p className="text-sm text-red-200" role="alert">
            {createError}
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-on-surface-variant">Cargando categorías…</p>
        ) : (
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
            {categories.map((cat) => (
              <li key={cat.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                {editingId === cat.id ? (
                  <form onSubmit={onSaveEdit} className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      maxLength={80}
                      className="min-w-0 flex-1 rounded-lg border border-white/10 bg-surface-container-low/80 px-3 py-2 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/25"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={updateMutation.isPending}
                        className="btn-primary-sm px-3 py-1.5 text-xs"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        disabled={updateMutation.isPending}
                        onClick={() => {
                          setEditingId(null)
                          setEditError(null)
                        }}
                        className="btn-outline px-3 py-1.5 text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <span className="font-medium text-on-surface">{cat.name}</span>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        className="btn-outline px-3 py-1.5 text-xs"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null)
                          setDeleteTarget(cat)
                        }}
                        className="btn-danger-outline px-3 py-1.5 text-xs font-semibold"
                      >
                        Eliminar
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {editError ? (
          <p className="text-sm text-red-200" role="alert">
            {editError}
          </p>
        ) : null}
        {!loading && categories.length === 0 ? (
          <p className="text-sm text-on-surface-variant">No hay categorías. Crea la primera arriba.</p>
        ) : null}
      </div>
    </>
  )
}
