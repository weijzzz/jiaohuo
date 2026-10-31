import { useCallback, useState } from 'react'
import type { Articulo } from '../types'
import { lookupByScan, type Catalog, type ScanMatch } from '../lib/catalog'
import { formatGtin, lookupKeys } from '../lib/ean'
import { formatPrice } from '../lib/format'
import { useScanner } from '../lib/scan/useScanner'

interface Miss {
  code: string
}

export function ScanView({
  catalog,
  onSelect,
  paused = false,
}: {
  catalog: Catalog
  onSelect: (articulo: Articulo, match: ScanMatch) => void
  /** True while the article sheet covers the viewfinder. */
  paused?: boolean
}) {
  const [miss, setMiss] = useState<Miss | null>(null)
  const [manual, setManual] = useState('')

  const resolve = useCallback(
    (code: string) => {
      const match = lookupByScan(catalog, code)
      if (match) {
        setMiss(null)
        onSelect(match.articulos[0], match)
      } else {
        setMiss({ code })
        // A miss is easy to overlook while looking at the product, not the
        // screen, so it is also signalled by touch where that is available.
        navigator.vibrate?.(180)
      }
    },
    [catalog, onSelect],
  )

  // useScanner releases the camera on unmount, so nothing to clean up here.
  const { videoRef, state, engine, error, torch, start, stop } = useScanner({
    onScan: resolve,
    paused,
  })

  const submitManual = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = manual.trim()
    if (trimmed) resolve(trimmed)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          aria-label="Vista de la cámara"
        />

        {state === 'running' && (
          <>
            {/* The band the decoder actually reads, so people know where to aim. */}
            <div className="pointer-events-none absolute inset-x-6 top-1/4 h-1/2 rounded-xl border-2 border-accent/70" />
            <div className="pointer-events-none absolute inset-x-6 top-1/2 h-px bg-rose-400/80" />
          </>
        )}

        {state !== 'running' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-shell/80 px-6 text-center">
            {state === 'starting' ? (
              <p className="text-sm text-slate-300">Abriendo la cámara…</p>
            ) : (
              <>
                {error && <p className="text-sm text-rose-300">{error}</p>}
                <button
                  type="button"
                  onClick={() => void start()}
                  className="rounded-xl bg-accent px-6 py-3 text-base font-semibold text-slate-900"
                >
                  {error ? 'Reintentar' : 'Activar cámara'}
                </button>
              </>
            )}
          </div>
        )}

        {state === 'running' && torch.supported && (
          <button
            type="button"
            onClick={() => void torch.toggle()}
            aria-pressed={torch.on}
            className={`absolute right-3 top-3 rounded-full px-3 py-2 text-xs font-semibold ${
              torch.on ? 'bg-amber-300 text-slate-900' : 'bg-black/60 text-slate-100'
            }`}
          >
            Linterna
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-edge bg-panel px-4 py-2 text-xs text-slate-400">
        <span>
          {state === 'running'
            ? `Escaneando · ${engine === 'native' ? 'detector del navegador' : 'ZXing'}`
            : 'Cámara detenida'}
        </span>
        {state === 'running' && (
          <button type="button" onClick={stop} className="font-semibold text-slate-300">
            Detener
          </button>
        )}
      </div>

      {miss && (
        <div className="border-b border-rose-500/40 bg-rose-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-rose-200">Código no encontrado</p>
          <p className="tabular mt-1 text-sm text-rose-100/90">{formatGtin(miss.code)}</p>
          <p className="mt-2 text-xs text-rose-100/70">
            Se han probado {lookupKeys(miss.code).length} variantes (unidad y caja). Puede que el
            artículo no esté en el catálogo o que el catálogo esté desactualizado.
          </p>
        </div>
      )}

      <form onSubmit={submitManual} className="flex gap-2 px-4 py-3">
        <input
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          inputMode="numeric"
          placeholder="Introducir código a mano"
          aria-label="Introducir código a mano"
          className="min-w-0 flex-1 rounded-xl border border-edge bg-panel-raised px-4 py-3 text-base text-slate-100 placeholder:text-slate-500 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-panel-raised px-4 py-3 text-sm font-semibold text-slate-200"
        >
          Buscar
        </button>
      </form>

      {catalog.articulos.length === 0 && (
        <p className="px-4 pb-6 text-center text-sm text-slate-400">
          No hay catálogo cargado, así que ningún código se encontrará todavía.
        </p>
      )}

      <p className="px-4 pb-6 text-center text-xs text-slate-500">
        Precio mostrado al escanear: {formatPrice(null)} significa que el origen no traía precio.
      </p>
    </div>
  )
}
