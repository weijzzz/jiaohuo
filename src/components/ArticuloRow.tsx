import type { Articulo } from '../types'
import { formatPrice } from '../lib/format'

export function ArticuloRow({
  articulo,
  onSelect,
}: {
  articulo: Articulo
  onSelect: (articulo: Articulo) => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(articulo)}
        className="flex w-full items-center gap-3 border-b border-edge px-4 py-3 text-left active:bg-panel-raised"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-100">
            {articulo.descripcion || '(sin descripción)'}
          </span>
          <span className="tabular mt-0.5 block truncate text-xs text-slate-400">
            {articulo.codigo}
            {articulo.familia ? ` · ${articulo.familia}` : ''}
          </span>
        </span>
        <span className="tabular shrink-0 text-base font-semibold text-slate-50">
          {formatPrice(articulo.precio)}
        </span>
      </button>
    </li>
  )
}
