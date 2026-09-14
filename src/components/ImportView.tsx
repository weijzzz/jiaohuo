import { useMemo, useRef, useState } from 'react'
import type { Articulo, SnapshotMeta } from '../types'
import { buildSnapshot, guessMapping, readTable, type Field, type ParsedTable } from '../lib/import'
import { clearSnapshot, replaceSnapshot } from '../lib/db'
import { formatDateTime, formatPrice } from '../lib/format'

const FIELD_LABELS: Record<Field, string> = {
  codigo: 'Código',
  descripcion: 'Descripción',
  ean: 'EAN / código de barras',
  precio: 'Precio venta',
  precioCoste: 'Precio coste',
  iva: 'IVA',
  unidadesPorCaja: 'Uds. por caja',
  proveedor: 'Proveedor',
  familia: 'Familia',
}

const FIELDS = Object.keys(FIELD_LABELS) as Field[]

function Stat({ label, value, tone = 'normal' }: { label: string; value: string; tone?: 'normal' | 'warn' }) {
  return (
    <div className="rounded-lg bg-panel-raised px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`tabular text-sm font-semibold ${tone === 'warn' ? 'text-amber-300' : 'text-slate-100'}`}>
        {value}
      </p>
    </div>
  )
}

export function ImportView({
  meta,
  onLoaded,
}: {
  meta: SnapshotMeta | null
  onLoaded: (articulos: Articulo[], meta: SnapshotMeta | null) => void
}) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [table, setTable] = useState<ParsedTable | null>(null)
  const [mapping, setMapping] = useState<Record<string, Field>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preview = useMemo(() => {
    if (!table) return null
    return buildSnapshot({ ...table, rows: table.rows.slice(0, 200) }, mapping)
  }, [table, mapping])

  const mappedFields = new Set(Object.values(mapping))
  const missingCodigo = table !== null && !mappedFields.has('codigo')

  const onPick = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const parsed = await readTable(file)
      setTable(parsed)
      setMapping(guessMapping(parsed.headers))
    } catch (cause) {
      setTable(null)
      setError(cause instanceof Error ? cause.message : 'No se ha podido leer el archivo.')
    } finally {
      setBusy(false)
    }
  }

  const onConfirm = async () => {
    if (!table) return
    setBusy(true)
    setError(null)
    try {
      const { articulos, report } = buildSnapshot(table, mapping)
      await replaceSnapshot(articulos, report.meta)
      onLoaded(articulos, report.meta)
      setTable(null)
      if (fileRef.current) fileRef.current.value = ''
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se ha podido guardar el catálogo.')
    } finally {
      setBusy(false)
    }
  }

  const onClear = async () => {
    if (!window.confirm('¿Borrar el catálogo guardado en este dispositivo?')) return
    setBusy(true)
    await clearSnapshot()
    onLoaded([], null)
    setBusy(false)
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Catálogo actual
        </h2>
        {meta ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Stat label="Artículos" value={meta.articleCount.toLocaleString('es-ES')} />
            <Stat label="Códigos de barras" value={meta.eanCount.toLocaleString('es-ES')} />
            <Stat label="Importado" value={formatDateTime(meta.importedAt)} />
            <Stat label="Origen" value={meta.label} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-400">No hay ningún catálogo en este dispositivo.</p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
          Importar archivo
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Exportación en CSV, o la respuesta JSON del panel. El archivo no sale del dispositivo.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.tsv,.json,text/csv,application/json"
          disabled={busy}
          onChange={(event) => void onPick(event.target.files?.[0])}
          className="mt-3 block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-900"
        />
        {error && (
          <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
      </section>

      {table && preview && (
        <>
          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Columnas detectadas
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {table.rows.length.toLocaleString('es-ES')} filas · {table.encoding}
              {table.delimiter && ` · separador «${table.delimiter}»`}
            </p>
            <ul className="mt-3 space-y-2">
              {table.headers.map((header) => (
                <li key={header} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200" title={header}>
                    {header}
                  </span>
                  <select
                    value={mapping[header] ?? ''}
                    onChange={(event) =>
                      setMapping((previous) => {
                        const next = { ...previous }
                        const value = event.target.value as Field | ''
                        if (value === '') delete next[header]
                        else next[header] = value
                        return next
                      })
                    }
                    aria-label={`Campo para la columna ${header}`}
                    className="shrink-0 rounded-lg border border-edge bg-panel-raised px-2 py-1.5 text-sm text-slate-100"
                  >
                    <option value="">(ignorar)</option>
                    {FIELDS.map((field) => (
                      <option key={field} value={field}>
                        {FIELD_LABELS[field]}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            {missingCodigo && (
              <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                Hay que asignar una columna a «Código»: es la clave de cada artículo.
              </p>
            )}
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Vista previa
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Comprobado sobre las primeras {Math.min(200, table.rows.length)} filas.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Stat label="Artículos" value={preview.articulos.length.toLocaleString('es-ES')} />
              <Stat label="Códigos de barras" value={preview.report.meta.eanCount.toLocaleString('es-ES')} />
              <Stat
                label="Filas sin código"
                value={preview.report.skipped.toLocaleString('es-ES')}
                tone={preview.report.skipped > 0 ? 'warn' : 'normal'}
              />
              <Stat
                label="EAN no válidos"
                value={preview.report.invalidEans.length.toLocaleString('es-ES')}
                tone={preview.report.invalidEans.length > 0 ? 'warn' : 'normal'}
              />
            </div>

            {preview.report.invalidEans.length > 0 && (
              <details className="mt-3 rounded-lg bg-panel-raised px-3 py-2">
                <summary className="cursor-pointer text-xs font-semibold text-amber-300">
                  Ver códigos de barras descartados
                </summary>
                <ul className="tabular mt-2 space-y-1 text-xs text-slate-300">
                  {preview.report.invalidEans.slice(0, 20).map((invalid, index) => (
                    <li key={`${invalid.codigo}-${index}`}>
                      {invalid.codigo}: {invalid.value}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <ul className="mt-3 divide-y divide-edge rounded-lg bg-panel-raised">
              {preview.articulos.slice(0, 5).map((articulo) => (
                <li key={articulo.codigo} className="flex items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-100">
                      {articulo.descripcion || '(sin descripción)'}
                    </span>
                    <span className="tabular block truncate text-xs text-slate-400">
                      {articulo.codigo} · {articulo.eans.join(' / ') || 'sin EAN'}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-sm font-semibold">
                    {formatPrice(articulo.precio)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <button
            type="button"
            disabled={busy || missingCodigo}
            onClick={() => void onConfirm()}
            className="mt-6 w-full rounded-xl bg-accent py-3 text-base font-semibold text-slate-900 disabled:opacity-40"
          >
            {busy ? 'Guardando…' : `Reemplazar catálogo (${table.rows.length.toLocaleString('es-ES')} filas)`}
          </button>
        </>
      )}

      {meta && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onClear()}
          className="mt-8 mb-4 w-full rounded-xl border border-rose-500/40 py-3 text-sm font-semibold text-rose-300 disabled:opacity-40"
        >
          Borrar catálogo del dispositivo
        </button>
      )}
    </div>
  )
}
