/**
 * TabBar.tsx — Barre d'onglets en bas de l'écran.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4)
 *
 * Scanner, À racheter (avec le nombre de produits à racheter), Stock, Ventes
 * (la fin de journée) et Historique, chacun avec son icône ; l'onglet ouvert
 * a son icône dans une pastille vert pâle (§6.7). Les cinq tiennent sur une
 * ligne dès 320 px de large (nom en 11 px) ; le nombre se pose sur le coin de
 * l'icône, sans prendre la place du nom.
 */
import type { ComponentType } from 'react'
import { IconHistory, IconPackage, IconReceiptText, IconScanBarcode, IconShoppingCart, type IconProps } from '../ui/icons'

export type Tab = 'scanner' | 'shopping' | 'stock' | 'sales' | 'history'

interface TabBarProps {
  tab: Tab
  shoppingCount: number | null
  onChange: (tab: Tab) => void
}

const TABS: Array<{ id: Tab; label: string; Icon: ComponentType<IconProps> }> = [
  { id: 'scanner', label: 'Scanner', Icon: IconScanBarcode },
  { id: 'shopping', label: 'À racheter', Icon: IconShoppingCart },
  { id: 'stock', label: 'Stock', Icon: IconPackage },
  { id: 'sales', label: 'Ventes', Icon: IconReceiptText },
  { id: 'history', label: 'Historique', Icon: IconHistory },
]

export default function TabBar({ tab, shoppingCount, onChange }: TabBarProps) {
  return (
    <nav className="tab-bar" aria-label="Onglets">
      {TABS.map(({ id, label, Icon }) => {
        const count = id === 'shopping' && shoppingCount !== null && shoppingCount > 0 ? shoppingCount : null
        return (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? 'page' : undefined}
            aria-label={count === null ? undefined : `${label} (${count})`}
            onClick={() => onChange(id)}
          >
            <span className="tab-icon">
              <Icon size={22} strokeWidth={tab === id ? 2.2 : 1.9} />
              {count !== null && (
                <span className="badge" aria-hidden="true">
                  {count}
                </span>
              )}
            </span>
            <span className="tab-label">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
