import { useDeferredValue, useMemo, useState } from 'react'
import type { Articulo } from '../types'
import { search, type Catalog } from '../lib/catalog'
import { ArticuloRow } from './ArticuloRow'

export function SearchView({
  catalog,
  onSelect,
}: {
  catalog: Catalog
  onSelect: (articulo: Articulo) => void
}) {
  const [query, setQuery] = useState('')
  // Typing stays responsive on a low-end phone: the field updates immediately
  // and the (heavier) result list catches up.
  const deferred = useDeferredValue(query)
  const hits = useMemo(() => search(catalog, deferred, 60), [catalog, deferred])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-edge bg-panel px-4 py-3">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Descripción, código o EAN"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          aria-label="Buscar artículos"
          className="w-full rounded-xl border border-edge bg-panel-raised px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-accent focus:outline-none"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {catalog.articulos.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            Importa un catálogo desde la pestaña <strong className="text-slate-200">Datos</strong>{' '}
            para poder buscar.
          </p>
        ) : deferred.trim() === '' ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            {catalog.articulos.length.toLocaleString('es-ES')} artículos disponibles.
          </p>
        ) : hits.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            Ningún artículo coincide con «{deferred}».
          </p>
        ) : (
          <ul>
            {hits.map((hit) => (
              <ArticuloRow key={hit.articulo.codigo} articulo={hit.articulo} onSelect={onSelect} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
