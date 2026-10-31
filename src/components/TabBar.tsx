export type Tab = 'buscar' | 'escanear' | 'datos'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'buscar', label: 'Buscar', icon: 'M10 4a6 6 0 104.47 10.03l4.25 4.25 1.41-1.41-4.25-4.25A6 6 0 0010 4zm0 2a4 4 0 110 8 4 4 0 010-8z' },
  { id: 'escanear', label: 'Escanear', icon: 'M3 5h2v14H3V5zm3 0h1v14H6V5zm2 0h2v14H8V5zm3 0h1v14h-1V5zm2 0h2v14h-2V5zm3 0h1v14h-1V5zm2 0h2v14h-2V5z' },
  { id: 'datos', label: 'Datos', icon: 'M12 3C7.58 3 4 4.57 4 6.5V17.5C4 19.43 7.58 21 12 21s8-1.57 8-3.5V6.5C20 4.57 16.42 3 12 3zm0 2c3.87 0 6 1.29 6 1.5S15.87 8 12 8 6 6.71 6 6.5 8.13 5 12 5zm6 12.5c0 .21-2.13 1.5-6 1.5s-6-1.29-6-1.5v-2.36C7.53 15.68 9.68 16 12 16s4.47-.32 6-.86v2.36zm0-5c0 .21-2.13 1.5-6 1.5s-6-1.29-6-1.5v-2.36C7.53 10.68 9.68 11 12 11s4.47-.32 6-.86v2.36z' },
]

export function TabBar({ value, onChange }: { value: Tab; onChange: (tab: Tab) => void }) {
  return (
    <nav className="pb-safe sticky bottom-0 z-20 flex border-t border-edge bg-panel/95 pt-1 backdrop-blur">
      {TABS.map((tab) => {
        const active = tab.id === value
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-current={active ? 'page' : undefined}
            className={`flex flex-1 flex-col items-center gap-1 px-2 py-2 text-xs font-medium transition-colors ${
              active ? 'text-accent' : 'text-slate-400'
            }`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 fill-current">
              <path d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}
