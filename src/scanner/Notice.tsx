/**
 * Notice.tsx — Message affiché sous la caméra après une action.
 *
 * Référence : docs/superpowers/specs/2026-10-19-scandrinks-design.md (§4.2, §6.7)
 *
 * Après « Valider », une bande verte donne ce qui est enregistré, puis le
 * nouveau stock, et propose « Annuler » pendant 5 secondes (maquette
 * docs/maquettes/J-message.dc.html). Après un inventaire, elle rappelle le
 * nombre compté et l'écart : « Inventaire : 53 comptés (+29) … ».
 */
import { describeInventory } from '../domain/inventory'
import { formatDelta, formatStock } from '../domain/stock'
import { IconCheck } from '../ui/icons'
import { NOT_A_PRODUCT_MESSAGE, type Notice as FlowNotice } from './scanFlow'

interface NoticeProps {
  notice: FlowNotice
  undoing: boolean
  onUndo: () => void
}

export default function Notice({ notice, undoing, onUndo }: NoticeProps) {
  switch (notice.kind) {
    case 'saved': {
      const what = notice.counted === null ? formatDelta(notice.delta) : describeInventory(notice.counted, notice.delta)
      return (
        <div role="status" className="message message-ok notice notice-saved">
          <span className="notice-badge" aria-hidden="true">
            <IconCheck size={18} strokeWidth={2.8} />
          </span>
          <span className="notice-text">
            <span className="notice-title">
              {what} {notice.productName}
            </span>
            <span className="notice-detail">Stock : {formatStock(notice.stock, notice.packSize)}</span>
          </span>
          <button type="button" className="link" disabled={undoing} onClick={onUndo}>
            {undoing ? 'Annulation…' : 'Annuler'}
          </button>
        </div>
      )
    }
    case 'cancelled':
      return (
        <p role="status" className="message notice">
          <span className="notice-title">Annulé — stock : {formatStock(notice.stock, notice.packSize)}</span>
        </p>
      )
    case 'not_a_product':
      return (
        <p role="status" className="message notice">
          {NOT_A_PRODUCT_MESSAGE}
        </p>
      )
    case 'error':
      return (
        <p role="alert" className="message message-error notice">
          {notice.message}
        </p>
      )
  }
}
