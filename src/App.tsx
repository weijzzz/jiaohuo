import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Articulo, SnapshotMeta } from './types'
import { buildCatalog, EMPTY_CATALOG, type ScanMatch } from './lib/catalog'
import { loadSnapshot } from './lib/db'
import { ArticuloDetail } from './components/ArticuloDetail'
import { ImportView } from './components/ImportView'
import { ScanView } from './components/ScanView'
import { SearchView } from './components/SearchView'
import { SnapshotBanner } from './components/SnapshotBanner'
import { TabBar, type Tab } from './components/TabBar'

interface Selection {
  articulo: Articulo
  match?: ScanMatch
}

export default function App() {
  const [tab, setTab] = useState<Tab>('buscar')
  const [articulos, setArticulos] = useState<Articulo[]>([])
  const [meta, setMeta] = useState<SnapshotMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [selection, setSelection] = useState<Selection | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadSnapshot()
      .then((snapshot) => {
        if (cancelled) return
        setArticulos(snapshot.articulos)
        setMeta(snapshot.meta)
        // Land on the import screen when there is nothing to search yet.
        if (snapshot.articulos.length === 0) setTab('datos')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const catalog = useMemo(
    () => (articulos.length === 0 ? EMPTY_CATALOG : buildCatalog(articulos)),
    [articulos],
  )

  const onLoaded = useCallback((next: Articulo[], nextMeta: SnapshotMeta | null) => {
    setArticulos(next)
    setMeta(nextMeta)
    if (next.length > 0) setTab('buscar')
  }, [])

  return (
    <div className="flex h-full flex-col bg-shell">
      <header className="pt-safe bg-panel px-4 pb-2">
        <h1 className="text-base font-semibold text-slate-100">Consulta de artículos</h1>
      </header>

      <SnapshotBanner meta={meta} onImport={() => setTab('datos')} />

      {loading ? (
        <p className="flex-1 px-4 py-10 text-center text-sm text-slate-400">Cargando catálogo…</p>
      ) : tab === 'buscar' ? (
        <SearchView
          catalog={catalog}
          onSelect={(articulo) => setSelection({ articulo })}
        />
      ) : tab === 'escanear' ? (
        <ScanView
          catalog={catalog}
          onSelect={(articulo, match) => setSelection({ articulo, match })}
        />
      ) : (
        <ImportView meta={meta} onLoaded={onLoaded} />
      )}

      <TabBar value={tab} onChange={setTab} />

      {selection && (
        <ArticuloDetail
          articulo={selection.articulo}
          matchedKey={selection.match?.matchedKey}
          derived={selection.match?.derived}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  )
}
