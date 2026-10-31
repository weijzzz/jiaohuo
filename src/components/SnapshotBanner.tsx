import type { SnapshotMeta } from '../types'
import { formatAge, formatDateTime, freshness } from '../lib/format'

const TONE = {
  fresh: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  aging: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  stale: 'bg-rose-500/10 text-rose-200 border-rose-500/40',
} as const

const WORDING = {
  fresh: 'Datos al día',
  aging: 'Datos de hace más de un día',
  stale: 'Datos caducados — vuelve a importar',
} as const

/**
 * Age of the loaded snapshot, always visible.
 *
 * These prices are a copy taken at some point in the past, and the one thing
 * that decides whether they can be quoted to a customer is how old that copy
 * is. It is on screen at all times rather than hidden in a settings page.
 */
export function SnapshotBanner({
  meta,
  onImport,
}: {
  meta: SnapshotMeta | null
  onImport: () => void
}) {
  if (!meta) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-edge bg-panel px-4 py-3">
        <p className="text-sm text-slate-300">Todavía no hay ningún catálogo cargado.</p>
        <button
          type="button"
          onClick={onImport}
          className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-slate-900"
        >
          Importar
        </button>
      </div>
    )
  }

  const level = freshness(meta.importedAt)

  return (
    <button
      type="button"
      onClick={onImport}
      title={`Importado el ${formatDateTime(meta.importedAt)} desde ${meta.label}`}
      className={`flex w-full items-center justify-between gap-3 border-b px-4 py-2 text-left ${TONE[level]}`}
    >
      <span className="text-xs font-medium">{WORDING[level]}</span>
      <span className="tabular text-xs opacity-90">
        {meta.articleCount.toLocaleString('es-ES')} art. · {formatAge(meta.importedAt)}
      </span>
    </button>
  )
}
