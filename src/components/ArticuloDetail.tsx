import { useEffect } from 'react'
import type { Articulo } from '../types'
import { formatGtin } from '../lib/ean'
import { formatNumber, formatPercent, formatPrice } from '../lib/format'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-panel-raised px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="tabular mt-0.5 text-sm font-medium text-slate-100">{value}</dd>
    </div>
  )
}

/**
 * Full detail for one article.
 *
 * The sale price is the largest thing on screen: this is read at arm's length
 * while holding a product in the other hand.
 */
export function ArticuloDetail({
  articulo,
  matchedKey,
  derived,
  onClose,
}: {
  articulo: Articulo
  matchedKey?: string
  derived?: boolean
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const precioSinIva =
    articulo.precio !== null && articulo.iva ? articulo.precio / (1 + articulo.iva / 100) : null

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={articulo.descripcion || articulo.codigo}
        onClick={(event) => event.stopPropagation()}
        className="pb-safe max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-edge bg-panel px-4 pt-3"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-600" />

        <h2 className="text-lg font-semibold text-slate-50">
          {articulo.descripcion || '(sin descripción)'}
        </h2>
        <p className="tabular mt-1 text-sm text-slate-400">{articulo.codigo}</p>

        {derived && (
          <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            El código escaneado no está en el catálogo. Se muestra este artículo porque su código{' '}
            <span className="tabular font-semibold">{matchedKey && formatGtin(matchedKey)}</span>{' '}
            corresponde a la misma referencia (unidad/caja). Comprueba el formato antes de cobrar.
          </p>
        )}

        <p className="tabular mt-4 text-4xl font-bold tracking-tight text-slate-50">
          {formatPrice(articulo.precio)}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-2">
          {precioSinIva !== null && <Field label="Sin IVA" value={formatPrice(precioSinIva)} />}
          <Field label="IVA" value={formatPercent(articulo.iva)} />
          {articulo.precioCoste !== null && (
            <Field label="Coste" value={formatPrice(articulo.precioCoste)} />
          )}
          {articulo.unidadesPorCaja !== null && (
            <Field label="Uds. por caja" value={formatNumber(articulo.unidadesPorCaja)} />
          )}
          {articulo.proveedor && <Field label="Proveedor" value={articulo.proveedor} />}
          {articulo.familia && <Field label="Familia" value={articulo.familia} />}
        </dl>

        <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Códigos de barras
        </h3>
        {articulo.eans.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {articulo.eans.map((ean) => (
              <li
                key={ean}
                className={`tabular rounded-lg px-3 py-2 text-sm ${
                  ean === matchedKey
                    ? 'bg-accent/15 font-semibold text-accent'
                    : 'bg-panel-raised text-slate-200'
                }`}
              >
                {formatGtin(ean)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-400">
            Este artículo no tiene ningún código de barras en el catálogo.
          </p>
        )}

        {Object.keys(articulo.extra).length > 0 && (
          <details className="mt-5">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-400">
              Otros campos del origen
            </summary>
            <dl className="mt-2 grid grid-cols-2 gap-2">
              {Object.entries(articulo.extra).map(([key, value]) => (
                <Field key={key} label={key} value={value} />
              ))}
            </dl>
          </details>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-6 mb-3 w-full rounded-xl bg-panel-raised py-3 text-sm font-semibold text-slate-200"
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
