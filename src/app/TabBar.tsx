/**
 * TabBar.tsx — Barre d'onglets en bas de l'écran.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4)
 *
 * Scanner, À racheter (avec le nombre de produits à racheter) et Stock.
 * L'onglet Historique arrive au jalon 3.
 */

export type Tab = 'scanner' | 'shopping' | 'stock'

interface TabBarProps {
  tab: Tab
  shoppingCount: number | null
  onChange: (tab: Tab) => void
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'scanner', label: 'Scanner' },
  { id: 'shopping', label: 'À racheter' },
  { id: 'stock', label: 'Stock' },
]

export default function TabBar({ tab, shoppingCount, onChange }: TabBarProps) {
  return (
    <nav className="tab-bar" aria-label="Onglets">
      {TABS.map(({ id, label }) => {
        const count = id === 'shopping' && shoppingCount !== null && shoppingCount > 0 ? shoppingCount : null
        return (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? 'page' : undefined}
            aria-label={count === null ? undefined : `${label} (${count})`}
            onClick={() => onChange(id)}
          >
            {label}
            {count !== null && (
              <span className="badge" aria-hidden="true">
                {count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
